import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private service: PurchaseOrdersService) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('search') search?: string) {
    return this.service.findAll({ status, search });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @Roles(Role.ADMIN, Role.PURCHASE_USER, Role.BUSINESS_OWNER)
  create(@Body() dto: any, @CurrentUser('id') userId: number) { return this.service.create(dto, userId); }

  /**
   * Kanban drag-to-advance: simple status update without business-logic side-effects.
   */
  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.PURCHASE_USER, Role.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Update order status (Kanban drag)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
    @CurrentUser('id') userId: number,
  ) {
    const allowed = ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED'];
    if (!allowed.includes(status)) throw new BadRequestException(`Invalid status: ${status}`);
    return this.service.updateStatus(id, status, userId);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.PURCHASE_USER, Role.BUSINESS_OWNER)
  confirm(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) { return this.service.confirm(id, userId); }

  @Post(':id/receive')
  @Roles(Role.ADMIN, Role.PURCHASE_USER, Role.INVENTORY_MANAGER, Role.BUSINESS_OWNER)
  receive(@Param('id', ParseIntPipe) id: number, @Body('lines') lines: any[], @CurrentUser('id') userId: number) {
    return this.service.receive(id, lines, userId);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.PURCHASE_USER, Role.BUSINESS_OWNER)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
