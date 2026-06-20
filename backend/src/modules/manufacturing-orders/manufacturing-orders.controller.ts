import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
  @Roles(Role.ADMIN, Role.MFG_USER)
  create(@Body() dto: any, @CurrentUser('id') userId: number) { return this.service.create(dto, userId); }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.MFG_USER)
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
  @Roles(Role.ADMIN, Role.MFG_USER)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
