import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../common/services/sequence.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SalesOrdersService {
  constructor(
    private prisma: PrismaService,
    private sequenceService: SequenceService,
  ) {}

  async findAll(query?: { status?: string; search?: string }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.search) {
      where.OR = [
        { orderNo: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.salesOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        lines: {
          include: { product: { select: { id: true, name: true, sku: true, uom: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const so = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        createdByUser: { select: { id: true, name: true } },
        lines: {
          include: {
            product: { select: { id: true, name: true, sku: true, uom: true, salesPrice: true } },
          },
        },
        deliveries: {
          include: {
            lines: {
              include: { salesOrderLine: { include: { product: { select: { name: true } } } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!so) throw new NotFoundException('Sales Order not found');
    return so;
  }

  async create(data: { customerId: number; lines: { productId: number; quantity: number; unitPrice: number }[]; expectedDeliveryDate?: string }, userId: number) {
    const orderNo = await this.sequenceService.getNext('SO');

    return this.prisma.salesOrder.create({
      data: {
        orderNo,
        customerId: data.customerId,
        createdBy: userId,
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        lines: {
          create: data.lines.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        lines: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });
  }

  async update(id: number, data: any) {
    const so = await this.findOne(id);
    if (so.status !== 'DRAFT') throw new BadRequestException('Can only edit DRAFT orders');

    // If lines are being updated, delete old and create new
    if (data.lines) {
      await this.prisma.salesOrderLine.deleteMany({ where: { salesOrderId: id } });
      await this.prisma.salesOrderLine.createMany({
        data: data.lines.map((l: any) => ({
          salesOrderId: id,
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
    }

    const updateData: any = {};
    if (data.customerId) updateData.customerId = data.customerId;
    if (data.expectedDeliveryDate) updateData.expectedDeliveryDate = new Date(data.expectedDeliveryDate);

    if (Object.keys(updateData).length > 0) {
      await this.prisma.salesOrder.update({ where: { id }, data: updateData });
    }

    return this.findOne(id);
  }

  async confirm(id: number, userId: number) {
    const so = await this.findOne(id);
    if (so.status !== 'DRAFT') throw new BadRequestException('Can only confirm DRAFT orders');
    if (so.lines.length === 0) throw new BadRequestException('Cannot confirm an order with no lines');

    // Atomic transaction: reserve stock + update status
    return this.prisma.$transaction(async (tx) => {
      for (const line of so.lines) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) throw new BadRequestException(`Product ${line.productId} not found`);

        const freeQty = Number(product.onHandQty) - Number(product.reservedQty);
        const reqQty = Number(line.quantity);

        if (freeQty >= reqQty) {
          // Reserve stock
          await tx.product.update({
            where: { id: product.id },
            data: { reservedQty: { increment: reqQty } },
          });

          await tx.stockReservation.create({
            data: {
              productId: product.id,
              referenceType: 'SALES_ORDER_LINE',
              referenceId: line.id,
              quantity: reqQty,
            },
          });
        } else if (product.procureOnDemand && product.procurementType) {
          // MTO — reserve what's available, auto-procure the rest
          if (freeQty > 0) {
            await tx.product.update({
              where: { id: product.id },
              data: { reservedQty: { increment: freeQty } },
            });
            await tx.stockReservation.create({
              data: {
                productId: product.id,
                referenceType: 'SALES_ORDER_LINE',
                referenceId: line.id,
                quantity: freeQty,
              },
            });
          }

          // Auto procurement will be handled separately
        } else {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}": available ${freeQty}, required ${reqQty}`
          );
        }
      }

      // Update SO status
      const updated = await tx.salesOrder.update({
        where: { id },
        data: { status: 'CONFIRMED' },
        include: {
          customer: { select: { id: true, name: true } },
          lines: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      });

      // Audit
      await tx.auditLog.create({
        data: {
          entityType: 'SALES_ORDER',
          entityId: id,
          action: 'CONFIRM',
          after: { status: 'CONFIRMED', orderNo: so.orderNo },
          userId,
        },
      });

      return updated;
    });
  }

  async deliver(id: number, deliveryLines: { salesOrderLineId: number; quantity: number }[], userId: number) {
    const so = await this.findOne(id);
    if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(so.status)) {
      throw new BadRequestException('Can only deliver CONFIRMED or PARTIALLY_DELIVERED orders');
    }

    return this.prisma.$transaction(async (tx) => {
      const deliveryNo = await this.sequenceService.getNext('DEL');

      // Create delivery
      const delivery = await tx.delivery.create({
        data: {
          deliveryNo,
          salesOrderId: id,
          createdBy: userId,
          lines: {
            create: deliveryLines.map(dl => ({
              salesOrderLineId: dl.salesOrderLineId,
              quantity: dl.quantity,
            })),
          },
        },
      });

      // Process each delivery line
      for (const dl of deliveryLines) {
        const soLine = so.lines.find(l => l.id === dl.salesOrderLineId);
        if (!soLine) throw new BadRequestException(`SO Line ${dl.salesOrderLineId} not found`);

        const totalDelivered = Number(soLine.deliveredQty) + dl.quantity;
        if (totalDelivered > Number(soLine.quantity)) {
          throw new BadRequestException(`Over-delivery for ${soLine.product.name}`);
        }

        // Update delivered qty on SO line
        await tx.salesOrderLine.update({
          where: { id: dl.salesOrderLineId },
          data: { deliveredQty: { increment: dl.quantity } },
        });

        // Deduct stock
        const product = await tx.product.findUnique({ where: { id: soLine.productId } });
        const newOnHand = Number(product!.onHandQty) - dl.quantity;

        await tx.product.update({
          where: { id: soLine.productId },
          data: {
            onHandQty: { decrement: dl.quantity },
            reservedQty: { decrement: dl.quantity },
          },
        });

        // Stock ledger entry
        await tx.stockLedger.create({
          data: {
            productId: soLine.productId,
            movementType: 'SALE_DELIVERY',
            quantity: -dl.quantity,
            balanceAfter: newOnHand,
            referenceType: 'DELIVERY',
            referenceId: delivery.id,
            createdBy: userId,
          },
        });

        // Release reservation
        await tx.stockReservation.updateMany({
          where: {
            productId: soLine.productId,
            referenceType: 'SALES_ORDER_LINE',
            referenceId: dl.salesOrderLineId,
            status: 'ACTIVE',
          },
          data: { status: 'CONSUMED', releasedAt: new Date() },
        });
      }

      // Determine new SO status
      const updatedSO = await tx.salesOrder.findUnique({
        where: { id },
        include: { lines: true },
      });

      const allDelivered = updatedSO!.lines.every(
        l => Number(l.deliveredQty) >= Number(l.quantity)
      );
      const someDelivered = updatedSO!.lines.some(l => Number(l.deliveredQty) > 0);

      const newStatus = allDelivered ? 'FULLY_DELIVERED' : someDelivered ? 'PARTIALLY_DELIVERED' : 'CONFIRMED';

      await tx.salesOrder.update({
        where: { id },
        data: { status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'SALES_ORDER',
          entityId: id,
          action: 'DELIVER',
          after: { deliveryNo, status: newStatus },
          userId,
        },
      });

      return this.findOne(id);
    });
  }

  async cancel(id: number, userId: number) {
    const so = await this.findOne(id);
    if (so.status === 'FULLY_DELIVERED' || so.status === 'CANCELLED') {
      throw new BadRequestException('Cannot cancel this order');
    }

    return this.prisma.$transaction(async (tx) => {
      // Release all reservations
      for (const line of so.lines) {
        const reservations = await tx.stockReservation.findMany({
          where: {
            referenceType: 'SALES_ORDER_LINE',
            referenceId: line.id,
            status: 'ACTIVE',
          },
        });

        for (const res of reservations) {
          await tx.product.update({
            where: { id: res.productId },
            data: { reservedQty: { decrement: Number(res.quantity) } },
          });

          await tx.stockReservation.update({
            where: { id: res.id },
            data: { status: 'RELEASED', releasedAt: new Date() },
          });
        }
      }

      await tx.salesOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'SALES_ORDER',
          entityId: id,
          action: 'CANCEL',
          after: { status: 'CANCELLED', orderNo: so.orderNo },
          userId,
        },
      });

      return this.findOne(id);
    });
  }

  async remove(id: number) {
    const so = await this.findOne(id);
    if (so.status !== 'DRAFT') throw new BadRequestException('Can only delete DRAFT orders');
    return this.prisma.salesOrder.delete({ where: { id } });
  }
}
