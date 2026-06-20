import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
  findAll(@Query('search') search?: string, @Query('productId') productId?: number) { return this.service.findAll({ search, productId }); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @Roles(Role.ADMIN, Role.MFG_USER)
  create(@Body() dto: any, @CurrentUser('id') userId: number) { return this.service.create(dto, userId); }

  @Post(':id/activate')
  @Roles(Role.ADMIN, Role.MFG_USER)
  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) { return this.service.activate(id, userId); }

  @Post(':id/archive')
  @Roles(Role.ADMIN, Role.MFG_USER)
  archive(@Param('id', ParseIntPipe) id: number) { return this.service.archive(id); }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
