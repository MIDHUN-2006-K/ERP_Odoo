import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ManufacturingOrdersService } from './manufacturing-orders.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Manufacturing Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller('manufacturing-orders')
export class ManufacturingOrdersController {
  constructor(private service: ManufacturingOrdersService) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('search') search?: string) {
    return this.service.findAll({ status, search });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @Roles(Role.ADMIN, Role.MFG_USER, Role.BUSINESS_OWNER)
  create(@Body() dto: any, @CurrentUser('id') userId: number) { return this.service.create(dto, userId); }

  /**
   * Kanban / advance-button: simple status update for card-based UI.
   */
  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.MFG_USER, Role.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Update MO status (card advance button)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
    @CurrentUser('id') userId: number,
  ) {
    const allowed = ['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
    if (!allowed.includes(status)) throw new BadRequestException(`Invalid status: ${status}`);
    return this.service.updateStatus(id, status, userId);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.MFG_USER, Role.BUSINESS_OWNER)
  confirm(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) { return this.service.confirm(id, userId); }

  @Post(':id/work-orders/:woId/start')
  @Roles(Role.ADMIN, Role.MFG_USER)
  startWorkOrder(@Param('id', ParseIntPipe) id: number, @Param('woId', ParseIntPipe) woId: number, @CurrentUser('id') userId: number) {
    return this.service.startWorkOrder(id, woId, userId);
  }

  @Post(':id/work-orders/:woId/complete')
  @Roles(Role.ADMIN, Role.MFG_USER)
  completeWorkOrder(@Param('id', ParseIntPipe) id: number, @Param('woId', ParseIntPipe) woId: number, @CurrentUser('id') userId: number) {
    return this.service.completeWorkOrder(id, woId, userId);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.MFG_USER, Role.BUSINESS_OWNER)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
