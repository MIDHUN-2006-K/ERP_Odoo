import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BomsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: { search?: string; productId?: number }) {
    const where: any = {};
    if (query?.productId) where.productId = query.productId;
    if (query?.search) {
      where.product = { name: { contains: query.search, mode: 'insensitive' } };
    }
    return this.prisma.bom.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        creator: { select: { id: true, name: true } },
        components: { include: { componentProduct: { select: { id: true, name: true, sku: true, uom: true } } } },
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
        components: { include: { componentProduct: { select: { id: true, name: true, sku: true, uom: true, costPrice: true } } } },
        operations: { include: { workCenter: true }, orderBy: { sequence: 'asc' } },
      },
    });
    if (!bom) throw new NotFoundException('Bill of Materials not found');
    return bom;
  }

  async create(data: any, userId: number) {
    if (!data.productId) {
      throw new BadRequestException('Product ID is required');
    }
    const product = await this.prisma.product.findUnique({
      where: { id: Number(data.productId) },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Validate components
    const components = data.components || [];
    const componentIds = components.map((c: any) => Number(c.componentProductId)).filter((id: number) => !isNaN(id));
    if (componentIds.length > 0) {
      const existingProducts = await this.prisma.product.findMany({
        where: { id: { in: componentIds } },
        select: { id: true },
      });
      const existingProductIds = existingProducts.map(p => p.id);
      for (const cid of componentIds) {
        if (!existingProductIds.includes(cid)) {
          throw new BadRequestException(`Component product with ID ${cid} does not exist`);
        }
      }
    }

    // Validate operations
    const operations = data.operations || [];
    const workCenterIds = operations
      .map((op: any) => op.workCenterId !== null && op.workCenterId !== undefined ? Number(op.workCenterId) : NaN)
      .filter((id: number) => !isNaN(id));
    
    // Check if any operation has null, undefined or NaN workCenterId
    for (const op of operations) {
      if (op.workCenterId === null || op.workCenterId === undefined || isNaN(Number(op.workCenterId))) {
        throw new BadRequestException(`Operation "${op.operationName || 'Unnamed'}" must have a valid workCenterId`);
      }
    }

    if (workCenterIds.length > 0) {
      const existingWorkCenters = await this.prisma.workCenter.findMany({
        where: { id: { in: workCenterIds } },
        select: { id: true },
      });
      const existingWcIds = existingWorkCenters.map(wc => wc.id);
      for (const wcid of workCenterIds) {
        if (!existingWcIds.includes(wcid)) {
          throw new BadRequestException(`Work Center with ID ${wcid} does not exist`);
        }
      }
    }

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
          create: components.map((c: any) => ({
            componentProductId: Number(c.componentProductId),
            quantityPerUnit: c.quantityPerUnit,
          })),
        },
        operations: {
          create: operations.map((op: any) => ({
            sequence: Number(op.sequence),
            operationName: op.operationName,
            workCenterId: Number(op.workCenterId),
            durationMinutes: Number(op.durationMinutes),
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

  async activate(id: number, userId: number) {
    const bom = await this.findOne(id);
    if (bom.status === 'ACTIVE') throw new BadRequestException('BoM is already active');

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
}
