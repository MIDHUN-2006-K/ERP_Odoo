import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getDashboard() {
    const [soDraft, soConfirmed, soPartial, soDelivered, soCancelled,
           poDraft, poConfirmed, poPartial, poReceived, poCancelled,
           moDraft, moConfirmed, moProgress, moDone, moCancelled,
           productCount, bomActiveCount] = await Promise.all([
      this.prisma.salesOrder.count({ where: { status: 'DRAFT' } }),
      this.prisma.salesOrder.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.salesOrder.count({ where: { status: 'PARTIALLY_DELIVERED' } }),
      this.prisma.salesOrder.count({ where: { status: 'FULLY_DELIVERED' } }),
      this.prisma.salesOrder.count({ where: { status: 'CANCELLED' } }),
      this.prisma.purchaseOrder.count({ where: { status: 'DRAFT' } }),
      this.prisma.purchaseOrder.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.purchaseOrder.count({ where: { status: 'PARTIALLY_RECEIVED' } }),
      this.prisma.purchaseOrder.count({ where: { status: 'FULLY_RECEIVED' } }),
      this.prisma.purchaseOrder.count({ where: { status: 'CANCELLED' } }),
      this.prisma.manufacturingOrder.count({ where: { status: 'DRAFT' } }),
      this.prisma.manufacturingOrder.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.manufacturingOrder.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.manufacturingOrder.count({ where: { status: 'DONE' } }),
      this.prisma.manufacturingOrder.count({ where: { status: 'CANCELLED' } }),
      this.prisma.product.count(),
      this.prisma.bom.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      salesOrders: { draft: soDraft, confirmed: soConfirmed, partiallyDelivered: soPartial, delivered: soDelivered, late: 0, cancelled: soCancelled },
      purchaseOrders: { draft: poDraft, confirmed: poConfirmed, partiallyReceived: poPartial, received: poReceived, late: 0, cancelled: poCancelled },
      manufacturingOrders: { draft: moDraft, confirmed: moConfirmed, inProgress: moProgress, done: moDone, late: 0, cancelled: moCancelled },
      products: { total: productCount, lowStock: 0 },
      boms: { active: bomActiveCount },
    };
  }
}
