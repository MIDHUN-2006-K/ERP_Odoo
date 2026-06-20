import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, ParseFloatPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BomsService } from './boms.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Bills of Materials')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller('boms')
export class BomsController {
  constructor(private service: BomsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('productId') productId?: string,
  ) {
    return this.service.findAll({ search, productId: productId ? Number(productId) : undefined });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  /**
   * Explode BoM for a given quantity — returns tree of required components.
   * GET /boms/:id/explosion?qty=10
   */
  @Get(':id/explosion')
  @ApiOperation({ summary: 'Explode BoM tree for a given quantity' })
  explode(
    @Param('id', ParseIntPipe) id: number,
    @Query('qty') qty?: string,
  ) {
    return this.service.explodeBom(id, qty ? Number(qty) : 1);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MFG_USER, Role.BUSINESS_OWNER)
  create(@Body() dto: any, @CurrentUser('id') userId: number) { return this.service.create(dto, userId); }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MFG_USER, Role.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Update BoM components/operations (DRAFT only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.service.update(id, dto); }

  @Post(':id/activate')
  @Roles(Role.ADMIN, Role.MFG_USER, Role.BUSINESS_OWNER)
  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) { return this.service.activate(id, userId); }

  @Post(':id/archive')
  @Roles(Role.ADMIN, Role.MFG_USER)
  archive(@Param('id', ParseIntPipe) id: number) { return this.service.archive(id); }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
