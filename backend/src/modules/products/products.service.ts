import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: { search?: string; category?: string; lowStock?: string }) {
    const where: any = {};

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query?.category) {
      where.category = query.category;
    }

    if (query?.lowStock === 'true') {
      where.onHandQty = { lte: { path: ['reorderPoint'] } };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        defaultVendor: { select: { id: true, name: true } },
        defaultBom: { select: { id: true, version: true, status: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Compute freeToUseQty for each product
    return products.map(p => ({
      ...p,
      freeToUseQty: Number(p.onHandQty) - Number(p.reservedQty),
    }));
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        defaultVendor: { select: { id: true, name: true } },
        defaultBom: {
          select: {
            id: true, version: true, status: true,
            components: {
              include: { componentProduct: { select: { id: true, name: true, sku: true, uom: true } } },
            },
          },
        },
        boms: {
          select: { id: true, version: true, status: true },
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    return {
      ...product,
      freeToUseQty: Number(product.onHandQty) - Number(product.reservedQty),
    };
  }

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (existing) throw new ConflictException('SKU already exists');

    return this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        category: dto.category,
        uom: dto.uom || 'UNIT',
        salesPrice: dto.salesPrice || 0,
        costPrice: dto.costPrice || 0,
        procurementStrategy: dto.procurementStrategy || 'MTS',
        procureOnDemand: dto.procureOnDemand || false,
        procurementType: dto.procurementType,
        defaultVendorId: dto.defaultVendorId,
        defaultBomId: dto.defaultBomId,
        reorderPoint: dto.reorderPoint || 0,
      },
    });
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id); // Verify exists
    return this.prisma.product.update({
      where: { id },
      data: dto as any,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
  }
}
