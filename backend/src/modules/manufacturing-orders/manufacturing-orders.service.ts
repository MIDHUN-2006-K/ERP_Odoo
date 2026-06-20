import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../common/services/sequence.service';

@Injectable()
export class ManufacturingOrdersService {
  constructor(private prisma: PrismaService, private sequenceService: SequenceService) {}

  async findAll(query?: { status?: string; search?: string }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.search) {
      where.OR = [
        { orderNo: { contains: query.search, mode: 'insensitive' } },
        { product: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.manufacturingOrder.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, uom: true } },
        bom: { select: { id: true, version: true } },
        createdByUser: { select: { id: true, name: true } },
        components: { include: { product: { select: { id: true, name: true, sku: true, uom: true, onHandQty: true, reservedQty: true } } } },
        workOrders: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const mo = await this.prisma.manufacturingOrder.findUnique({
      where: { id },
      include: {
        product: true,
        bom: { include: { components: { include: { componentProduct: true } }, operations: { include: { workCenter: true } } } },
        createdByUser: { select: { id: true, name: true } },
        components: { include: { product: { select: { id: true, name: true, sku: true, uom: true, onHandQty: true, reservedQty: true } } } },
        workOrders: { include: { workCenter: { select: { id: true, name: true } } }, orderBy: { sequence: 'asc' } },
      },
    });
    if (!mo) throw new NotFoundException('Manufacturing Order not found');
    return mo;
  }

  async create(data: any, userId: number) {
    const orderNo = await this.sequenceService.getNext('MO');
    const bom = await this.prisma.bom.findUnique({
      where: { id: data.bomId },
      include: { components: true, operations: { include: { workCenter: true } } },
    });
    if (!bom) throw new BadRequestException('BoM not found');

    // Snapshot BoM into MO components and work orders
    return this.prisma.manufacturingOrder.create({
      data: {
        orderNo, productId: data.productId, bomId: data.bomId, quantity: data.quantity,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        assigneeId: data.assigneeId || null,
        source: data.source || 'MANUAL', sourceReferenceId: data.sourceReferenceId || null,
        createdBy: userId,
        components: {
          create: bom.components.map(c => ({
            productId: c.componentProductId,
            requiredQty: Number(c.quantityPerUnit) * data.quantity,
          })),
        },
        workOrders: {
          create: bom.operations.map(op => ({
            sequence: op.sequence, operationName: op.operationName,
            workCenterId: op.workCenterId, durationMinutes: op.durationMinutes,
          })),
        },
      },
      include: {
        product: { select: { id: true, name: true } },
        components: { include: { product: { select: { id: true, name: true } } } },
        workOrders: { orderBy: { sequence: 'asc' } },
      },
    });
  }

  async confirm(id: number, userId: number) {
    const mo = await this.findOne(id);
    if (mo.status !== 'DRAFT') throw new BadRequestException('Can only confirm DRAFT orders');

    return this.prisma.$transaction(async (tx) => {
      for (const comp of mo.components) {
        const product = await tx.product.findUnique({ where: { id: comp.productId } });
        if (!product) throw new BadRequestException(`Component ${comp.productId} not found`);
        const freeQty = Number(product.onHandQty) - Number(product.reservedQty);
        const reqQty = Number(comp.requiredQty);

        if (freeQty < reqQty) {
          throw new BadRequestException(`Insufficient stock for "${product.name}": available ${freeQty}, required ${reqQty}`);
        }

        await tx.product.update({ where: { id: product.id }, data: { reservedQty: { increment: reqQty } } });
        await tx.stockReservation.create({
          data: { productId: product.id, referenceType: 'MO_COMPONENT', referenceId: comp.id, quantity: reqQty },
        });
      }

      await tx.manufacturingOrder.update({ where: { id }, data: { status: 'CONFIRMED' } });
      await tx.auditLog.create({
        data: { entityType: 'MANUFACTURING_ORDER', entityId: id, action: 'CONFIRM', after: { status: 'CONFIRMED' }, userId },
      });
      return this.findOne(id);
    });
  }

  async startWorkOrder(moId: number, workOrderId: number, userId: number) {
    const mo = await this.findOne(moId);
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(mo.status)) throw new BadRequestException('MO must be CONFIRMED or IN_PROGRESS');

    const wo = mo.workOrders.find(w => w.id === workOrderId);
    if (!wo) throw new BadRequestException('Work Order not found');
    if (wo.status !== 'PENDING') throw new BadRequestException('Work Order is not PENDING');

    // Check previous WO is done (sequential)
    const prevWO = mo.workOrders.find(w => w.sequence === wo.sequence - 1);
    if (prevWO && prevWO.status !== 'DONE') throw new BadRequestException('Previous Work Order must be completed first');

    await this.prisma.workOrder.update({ where: { id: workOrderId }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
    if (mo.status === 'CONFIRMED') {
      await this.prisma.manufacturingOrder.update({ where: { id: moId }, data: { status: 'IN_PROGRESS' } });
    }
    return this.findOne(moId);
  }

  async completeWorkOrder(moId: number, workOrderId: number, userId: number) {
    const mo = await this.findOne(moId);
    const wo = mo.workOrders.find(w => w.id === workOrderId);
    if (!wo) throw new BadRequestException('Work Order not found');
    if (wo.status !== 'IN_PROGRESS') throw new BadRequestException('Work Order is not IN_PROGRESS');

    await this.prisma.workOrder.update({ where: { id: workOrderId }, data: { status: 'DONE', completedAt: new Date() } });

    // Check if ALL work orders are done — if so, complete the MO
    const updatedMO = await this.prisma.manufacturingOrder.findUnique({
      where: { id: moId }, include: { workOrders: true, components: true },
    });

    const allDone = updatedMO!.workOrders.every(w => w.id === workOrderId ? true : w.status === 'DONE');

    if (allDone) {
      // Atomic: consume components + produce finished good
      await this.prisma.$transaction(async (tx) => {
        for (const comp of updatedMO!.components) {
          const product = await tx.product.findUnique({ where: { id: comp.productId } });
          const consumeQty = Number(comp.requiredQty);
          const newOnHand = Number(product!.onHandQty) - consumeQty;

          await tx.product.update({
            where: { id: comp.productId },
            data: { onHandQty: { decrement: consumeQty }, reservedQty: { decrement: consumeQty } },
          });

          await tx.moComponent.update({ where: { id: comp.id }, data: { consumedQty: consumeQty } });

          await tx.stockLedger.create({
            data: {
              productId: comp.productId, movementType: 'MO_CONSUMPTION', quantity: -consumeQty,
              balanceAfter: newOnHand, referenceType: 'MANUFACTURING_ORDER', referenceId: moId, createdBy: userId,
            },
          });

          // Release reservation
          await tx.stockReservation.updateMany({
            where: { referenceType: 'MO_COMPONENT', referenceId: comp.id, status: 'ACTIVE' },
            data: { status: 'CONSUMED', releasedAt: new Date() },
          });
        }

        // Produce finished good
        const finishedProduct = await tx.product.findUnique({ where: { id: updatedMO!.productId } });
        const produceQty = Number(updatedMO!.quantity);
        const newOnHand = Number(finishedProduct!.onHandQty) + produceQty;

        await tx.product.update({
          where: { id: updatedMO!.productId },
          data: { onHandQty: { increment: produceQty } },
        });

        await tx.stockLedger.create({
          data: {
            productId: updatedMO!.productId, movementType: 'MO_PRODUCTION', quantity: produceQty,
            balanceAfter: newOnHand, referenceType: 'MANUFACTURING_ORDER', referenceId: moId, createdBy: userId,
          },
        });

        await tx.manufacturingOrder.update({ where: { id: moId }, data: { status: 'DONE' } });
        await tx.auditLog.create({
          data: { entityType: 'MANUFACTURING_ORDER', entityId: moId, action: 'COMPLETE', after: { status: 'DONE' }, userId },
        });
      });
    }

    return this.findOne(moId);
  }

  async cancel(id: number, userId: number) {
    const mo = await this.findOne(id);
    if (['DONE', 'CANCELLED'].includes(mo.status)) throw new BadRequestException('Cannot cancel this order');

    return this.prisma.$transaction(async (tx) => {
      for (const comp of mo.components) {
        const reservations = await tx.stockReservation.findMany({
          where: { referenceType: 'MO_COMPONENT', referenceId: comp.id, status: 'ACTIVE' },
        });
        for (const res of reservations) {
          await tx.product.update({ where: { id: res.productId }, data: { reservedQty: { decrement: Number(res.quantity) } } });
          await tx.stockReservation.update({ where: { id: res.id }, data: { status: 'RELEASED', releasedAt: new Date() } });
        }
      }
      await tx.manufacturingOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.auditLog.create({
        data: { entityType: 'MANUFACTURING_ORDER', entityId: id, action: 'CANCEL', after: { status: 'CANCELLED' }, userId },
      });
      return this.findOne(id);
    });
  }

  async remove(id: number) {
    const mo = await this.findOne(id);
    if (mo.status !== 'DRAFT') throw new BadRequestException('Can only delete DRAFT orders');
    return this.prisma.manufacturingOrder.delete({ where: { id } });
  }
}
