import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BomsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: { search?: string; productId?: number }) {
    const where: any = {};
    if (query?.productId) where.productId = Number(query.productId);
    if (query?.search) {
      where.product = { name: { contains: query.search, mode: 'insensitive' } };
    }
    return this.prisma.bom.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, category: true } },
        creator: { select: { id: true, name: true } },
        components: { include: { componentProduct: { select: { id: true, name: true, sku: true, uom: true, category: true } } } },
        operations: { include: { workCenter: { select: { id: true, name: true } } }, orderBy: { sequence: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const bom = await this.prisma.bom.findUnique({
      where: { id },
      include: {
        product: true,
        creator: { select: { id: true, name: true } },
        components: { include: { componentProduct: { select: { id: true, name: true, sku: true, uom: true, costPrice: true, category: true, procurementType: true, defaultBomId: true } } } },
        operations: { include: { workCenter: true }, orderBy: { sequence: 'asc' } },
      },
    });
    if (!bom) throw new NotFoundException('Bill of Materials not found');
    return bom;
  }

  async create(data: any, userId: number) {
    if (!data.productId) throw new BadRequestException('Product ID is required');

    const product = await this.prisma.product.findUnique({ where: { id: Number(data.productId) } });
    if (!product) throw new NotFoundException('Product not found');

    await this.validateComponents(data.components || []);
    await this.validateOperations(data.operations || []);

    const latestBom = await this.prisma.bom.findFirst({
      where: { productId: Number(data.productId) }, orderBy: { version: 'desc' },
    });
    const version = latestBom ? latestBom.version + 1 : 1;

    return this.prisma.bom.create({
      data: {
        productId: Number(data.productId),
        version,
        createdBy: userId,
        components: {
          create: (data.components || []).map((c: any) => ({
            componentProductId: Number(c.componentProductId),
            quantityPerUnit: Number(c.quantityPerUnit),
          })),
        },
        operations: {
          create: (data.operations || []).map((op: any) => ({
            sequence:       Number(op.sequence),
            operationName:  op.operationName,
            workCenterId:   Number(op.workCenterId),
            durationMinutes:Number(op.durationMinutes),
          })),
        },
      },
      include: {
        product: { select: { id: true, name: true } },
        components: { include: { componentProduct: { select: { id: true, name: true } } } },
        operations: { include: { workCenter: { select: { id: true, name: true } } }, orderBy: { sequence: 'asc' } },
      },
    });
  }

  /** Update BoM components and/or operations in place (DRAFT only) */
  async update(id: number, data: any) {
    const bom = await this.findOne(id);
    if (bom.status === 'ACTIVE') throw new BadRequestException('Cannot edit an ACTIVE BoM. Archive it first.');

    if (data.components !== undefined) {
      await this.validateComponents(data.components);
      // Delete existing and recreate
      await this.prisma.bomComponent.deleteMany({ where: { bomId: id } });
      if (data.components.length > 0) {
        await this.prisma.bomComponent.createMany({
          data: data.components.map((c: any) => ({
            bomId:             id,
            componentProductId:Number(c.componentProductId),
            quantityPerUnit:   Number(c.quantityPerUnit),
          })),
        });
      }
    }

    if (data.operations !== undefined) {
      await this.validateOperations(data.operations);
      await this.prisma.bomOperation.deleteMany({ where: { bomId: id } });
      if (data.operations.length > 0) {
        await this.prisma.bomOperation.createMany({
          data: data.operations.map((op: any) => ({
            bomId:          id,
            sequence:       Number(op.sequence),
            operationName:  op.operationName,
            workCenterId:   Number(op.workCenterId),
            durationMinutes:Number(op.durationMinutes),
          })),
        });
      }
    }

    return this.findOne(id);
  }

  /**
   * Explode a BoM tree to a flat list of required components at a given qty.
   * Recursively resolves sub-components up to depth 5.
   */
  async explodeBom(id: number, quantity: number, depth = 0): Promise<any[]> {
    if (depth > 5) throw new BadRequestException('BoM explosion depth limit exceeded (5 levels). Check for circular BoMs.');

    const bom = await this.findOne(id);
    const result: any[] = [];

    for (const comp of bom.components) {
      const qty = Number(comp.quantityPerUnit) * quantity;
      const item: any = {
        productId:       comp.componentProductId,
        productName:     (comp.componentProduct as any).name,
        sku:             (comp.componentProduct as any).sku,
        uom:             (comp.componentProduct as any).uom,
        category:        (comp.componentProduct as any).category,
        procurementType: (comp.componentProduct as any).procurementType,
        quantityRequired:qty,
        depth,
        children:        [] as any[],
      };

      // Recurse for manufactured sub-components that have a default BoM
      const childBomId = (comp.componentProduct as any).defaultBomId;
      if ((comp.componentProduct as any).procurementType === 'MANUFACTURING' && childBomId) {
        item.children = await this.explodeBom(childBomId, qty, depth + 1);
      }

      result.push(item);
    }

    return result;
  }

  async activate(id: number, userId: number) {
    const bom = await this.findOne(id);
    if (bom.status === 'ACTIVE') throw new BadRequestException('BoM is already active');
    if (bom.components.length === 0) throw new BadRequestException('Cannot activate a BoM with no components');

    // Deactivate other BoMs for same product
    await this.prisma.bom.updateMany({
      where: { productId: bom.productId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });

    await this.prisma.bom.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.prisma.product.update({ where: { id: bom.productId }, data: { defaultBomId: id } });

    return this.findOne(id);
  }

  async archive(id: number) {
    await this.prisma.bom.update({ where: { id }, data: { status: 'ARCHIVED' } });
    return this.findOne(id);
  }

  async remove(id: number) {
    const bom = await this.findOne(id);
    if (bom.status === 'ACTIVE') throw new BadRequestException('Cannot delete active BoM');
    return this.prisma.bom.delete({ where: { id } });
  }

  // ── Helpers ───────────────────────────────────────────────────

  private async validateComponents(components: any[]) {
    if (!components || components.length === 0) return;
    const ids = components.map((c: any) => Number(c.componentProductId)).filter(id => !isNaN(id));
    if (ids.length > 0) {
      const existing = await this.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } });
      const existingIds = existing.map(p => p.id);
      for (const id of ids) {
        if (!existingIds.includes(id)) throw new BadRequestException(`Component product ID ${id} does not exist`);
      }
    }
  }

  private async validateOperations(operations: any[]) {
    if (!operations || operations.length === 0) return;
    for (const op of operations) {
      if (op.workCenterId === null || op.workCenterId === undefined || isNaN(Number(op.workCenterId))) {
        throw new BadRequestException(`Operation "${op.operationName || 'Unnamed'}" must have a valid workCenterId`);
      }
    }
    const wcIds = operations.map((op: any) => Number(op.workCenterId));
    if (wcIds.length > 0) {
      const existing = await this.prisma.workCenter.findMany({ where: { id: { in: wcIds } }, select: { id: true } });
      const existingIds = existing.map(wc => wc.id);
      for (const id of wcIds) {
        if (!existingIds.includes(id)) throw new BadRequestException(`Work Center ID ${id} does not exist`);
      }
    }
  }
}
