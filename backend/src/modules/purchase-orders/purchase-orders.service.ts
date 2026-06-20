import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../common/services/sequence.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService, private sequenceService: SequenceService) {}

  async findAll(query?: { status?: string; search?: string }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.search) {
      where.OR = [
        { orderNo: { contains: query.search, mode: 'insensitive' } },
        { vendor: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        lines: { include: { product: { select: { id: true, name: true, sku: true, uom: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        createdByUser: { select: { id: true, name: true } },
        lines: { include: { product: { select: { id: true, name: true, sku: true, uom: true, costPrice: true } } } },
        goodsReceipts: { include: { lines: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!po) throw new NotFoundException('Purchase Order not found');
    return po;
  }

  async create(data: any, userId: number) {
    const orderNo = await this.sequenceService.getNext('PO');
    return this.prisma.purchaseOrder.create({
      data: {
        orderNo,
        vendorId: data.vendorId,
        createdBy: userId,
        source: data.source || 'MANUAL',
        sourceReferenceId: data.sourceReferenceId || null,
        lines: {
          create: data.lines.map((l: any) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: { include: { product: { select: { id: true, name: true } } } },
      },
    });
  }

  async confirm(id: number, userId: number) {
    const po = await this.findOne(id);
    if (po.status !== 'DRAFT') throw new BadRequestException('Can only confirm DRAFT orders');
    if (po.lines.length === 0) throw new BadRequestException('Cannot confirm an order with no lines');

    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'CONFIRMED' } });
    await this.prisma.auditLog.create({
      data: { entityType: 'PURCHASE_ORDER', entityId: id, action: 'CONFIRM', after: { status: 'CONFIRMED' }, userId },
    });
    return this.findOne(id);
  }

  async receive(id: number, receiptLines: { purchaseOrderLineId: number; quantity: number }[], userId: number) {
    const po = await this.findOne(id);
    if (!['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      throw new BadRequestException('Can only receive CONFIRMED or PARTIALLY_RECEIVED orders');
    }

    return this.prisma.$transaction(async (tx) => {
      const receiptNo = await this.sequenceService.getNext('GR');
      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptNo, purchaseOrderId: id, createdBy: userId,
          lines: { create: receiptLines.map(rl => ({ purchaseOrderLineId: rl.purchaseOrderLineId, quantity: rl.quantity })) },
        },
      });

      for (const rl of receiptLines) {
        const poLine = po.lines.find(l => l.id === rl.purchaseOrderLineId);
        if (!poLine) throw new BadRequestException(`PO Line ${rl.purchaseOrderLineId} not found`);

        const totalReceived = Number(poLine.receivedQty) + rl.quantity;
        if (totalReceived > Number(poLine.quantity)) throw new BadRequestException(`Over-receipt for ${poLine.product.name}`);

        await tx.purchaseOrderLine.update({
          where: { id: rl.purchaseOrderLineId },
          data: { receivedQty: { increment: rl.quantity } },
        });

        const product = await tx.product.findUnique({ where: { id: poLine.productId } });
        const newOnHand = Number(product!.onHandQty) + rl.quantity;

        await tx.product.update({ where: { id: poLine.productId }, data: { onHandQty: { increment: rl.quantity } } });

        await tx.stockLedger.create({
          data: {
            productId: poLine.productId, movementType: 'PURCHASE_RECEIPT', quantity: rl.quantity,
            balanceAfter: newOnHand, referenceType: 'GOODS_RECEIPT', referenceId: receipt.id, createdBy: userId,
          },
        });
      }

      const updatedPO = await tx.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
      const allReceived = updatedPO!.lines.every(l => Number(l.receivedQty) >= Number(l.quantity));
      const someReceived = updatedPO!.lines.some(l => Number(l.receivedQty) > 0);
      const newStatus = allReceived ? 'FULLY_RECEIVED' : someReceived ? 'PARTIALLY_RECEIVED' : 'CONFIRMED';

      await tx.purchaseOrder.update({ where: { id }, data: { status: newStatus } });
      await tx.auditLog.create({
        data: { entityType: 'PURCHASE_ORDER', entityId: id, action: 'RECEIVE', after: { receiptNo, status: newStatus }, userId },
      });

      return this.findOne(id);
    });
  }

  async cancel(id: number, userId: number) {
    const po = await this.findOne(id);
    if (['FULLY_RECEIVED', 'CANCELLED'].includes(po.status)) throw new BadRequestException('Cannot cancel this order');

    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.prisma.auditLog.create({
      data: { entityType: 'PURCHASE_ORDER', entityId: id, action: 'CANCEL', after: { status: 'CANCELLED' }, userId },
    });
    return this.findOne(id);
  }

  /** Simple status update for Kanban drag — no goods-receipt side-effects */
  async updateStatus(id: number, status: string, userId: number) {
    const po = await this.findOne(id);
    if (po.status === status) return po;
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: status as any } });
    await this.prisma.auditLog.create({
      data: {
        entityType: 'PURCHASE_ORDER', entityId: id, action: 'STATUS_UPDATE',
        before: { status: po.status }, after: { status }, userId,
      },
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    const po = await this.findOne(id);
    if (po.status !== 'DRAFT') throw new BadRequestException('Can only delete DRAFT orders');
    return this.prisma.purchaseOrder.delete({ where: { id } });
  }
}

