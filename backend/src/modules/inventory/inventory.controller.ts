import { Controller, Get, Post, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private prisma: PrismaService) {}

  @Get('stock-ledger')
  async getStockLedger(
    @Query('productId') productId?: string,
    @Query('movementType') movementType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where: any = {};
    if (productId) where.productId = parseInt(productId);
    if (movementType) where.movementType = movementType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    return this.prisma.stockLedger.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, uom: true } },
        createdByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  @Get('current-stock')
  async getCurrentStock() {
    const products = await this.prisma.product.findMany({
      select: { id: true, name: true, sku: true, uom: true, category: true, onHandQty: true, reservedQty: true, reorderPoint: true },
      orderBy: { name: 'asc' },
    });
    return products.map(p => ({
      ...p,
      freeToUseQty: Number(p.onHandQty) - Number(p.reservedQty),
    }));
  }

  @Post('adjust')
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  async adjustStock(
    @Body() dto: { productId: number; quantity: number; reason: string },
    @CurrentUser('id') userId: number,
  ) {
    if (!dto.reason) throw new Error('Reason is required for stock adjustment');

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new Error('Product not found');

      const newOnHand = Number(product.onHandQty) + dto.quantity;
      if (newOnHand < 0) throw new Error('Stock cannot go below zero');

      await tx.product.update({ where: { id: dto.productId }, data: { onHandQty: newOnHand } });

      const ledger = await tx.stockLedger.create({
        data: {
          productId: dto.productId, movementType: 'ADJUSTMENT', quantity: dto.quantity,
          balanceAfter: newOnHand, referenceType: 'ADJUSTMENT', referenceId: 0, createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'STOCK_ADJUSTMENT', entityId: ledger.id, action: 'ADJUST',
          after: { productId: dto.productId, quantity: dto.quantity, reason: dto.reason, newBalance: newOnHand },
          userId,
        },
      });

      return { ...ledger, newOnHand, reason: dto.reason };
    });
  }
}
