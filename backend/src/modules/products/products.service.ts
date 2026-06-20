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
      // Prisma doesn't support cross-column comparison, so filter in-memory
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        defaultVendor: { select: { id: true, name: true } },
        defaultBom: { select: { id: true, version: true, status: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Compute freeToUseQty and lowStock flag
    let result = products.map(p => ({
      ...p,
      freeToUseQty: Number(p.onHandQty) - Number(p.reservedQty),
      isLowStock: Number(p.reorderPoint) > 0 && Number(p.onHandQty) <= Number(p.reorderPoint),
    }));

    if (query?.lowStock === 'true') {
      result = result.filter(p => p.isLowStock);
    }

    return result;
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        defaultVendor: { select: { id: true, name: true } },
        defaultBom: {
          include: {
            components: {
              include: {
                componentProduct: {
                  select: {
                    id: true, name: true, sku: true, uom: true, category: true,
                    procurementType: true, onHandQty: true, reservedQty: true,
                  },
                },
              },
            },
            operations: {
              include: { workCenter: { select: { id: true, name: true } } },
              orderBy: { sequence: 'asc' },
            },
          },
        },
        boms: {
          include: {
            components: {
              include: {
                componentProduct: {
                  select: {
                    id: true, name: true, sku: true, uom: true, category: true,
                    procurementType: true, onHandQty: true, reservedQty: true,
                  },
                },
              },
            },
            operations: {
              include: { workCenter: { select: { id: true, name: true } } },
              orderBy: { sequence: 'asc' },
            },
          },
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    // Fetch linked open orders (last 10 each)
    const [openMOs, openPOs, recentLedger] = await Promise.all([
      this.prisma.manufacturingOrder.findMany({
        where: { productId: id, status: { notIn: ['DONE', 'CANCELLED'] } },
        select: { id: true, orderNo: true, status: true, quantity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.purchaseOrderLine.findMany({
        where: {
          productId: id,
          purchaseOrder: { status: { notIn: ['FULLY_RECEIVED', 'CANCELLED'] } },
        },
        select: {
          id: true, quantity: true, receivedQty: true,
          purchaseOrder: {
            select: { id: true, orderNo: true, status: true, createdAt: true },
          },
        },
        orderBy: { purchaseOrder: { createdAt: 'desc' } },
        take: 10,
      }),
      this.prisma.stockLedger.findMany({
        where: { productId: id },
        select: {
          id: true, movementType: true, quantity: true, balanceAfter: true,
          referenceType: true, referenceId: true, createdAt: true,
          createdByUser: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Deduplicate POs (multiple lines per PO)
    const seenPOs = new Set<number>();
    const linkedPOs = openPOs
      .filter(line => {
        if (seenPOs.has(line.purchaseOrder.id)) return false;
        seenPOs.add(line.purchaseOrder.id);
        return true;
      })
      .map(line => ({
        id: line.purchaseOrder.id,
        orderNo: line.purchaseOrder.orderNo,
        status: line.purchaseOrder.status,
        createdAt: line.purchaseOrder.createdAt,
      }));

    return {
      ...product,
      freeToUseQty: Number(product.onHandQty) - Number(product.reservedQty),
      isLowStock: Number(product.reorderPoint) > 0 && Number(product.onHandQty) <= Number(product.reorderPoint),
      linkedMOs: openMOs,
      linkedPOs,
      recentLedger,
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
        category: dto.category || null,
        uom: dto.uom || 'UNIT',
        salesPrice: dto.salesPrice || 0,
        costPrice: dto.costPrice || 0,
        procurementStrategy: dto.procurementStrategy || 'MTS',
        procureOnDemand: dto.procureOnDemand || false,
        procurementType: dto.procurementType,
        defaultVendorId: dto.defaultVendorId,
        defaultBomId: dto.defaultBomId,
        reorderPoint: dto.reorderPoint || 0,
        reorderQty: dto.reorderQty || 0,
      },
    });
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);
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
