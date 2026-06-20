import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SalesOrdersService } from './sales-orders.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Sales Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private service: SalesOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all sales orders' })
  findAll(@Query('status') status?: string, @Query('search') search?: string) {
    return this.service.findAll({ status, search });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @Roles(Role.ADMIN, Role.SALES_USER)
  create(@Body() dto: any, @CurrentUser('id') userId: number) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SALES_USER)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.SALES_USER)
  confirm(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.confirm(id, userId);
  }

  @Post(':id/deliver')
  @Roles(Role.ADMIN, Role.SALES_USER, Role.INVENTORY_MANAGER)
  deliver(
    @Param('id', ParseIntPipe) id: number,
    @Body('lines') lines: { salesOrderLineId: number; quantity: number }[],
    @CurrentUser('id') userId: number,
  ) {
    return this.service.deliver(id, lines, userId);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.SALES_USER)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.cancel(id, userId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
