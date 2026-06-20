import { Controller, Get, Patch, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll(@Query('search') search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, status: true, phone: true, address: true, lastLoginAt: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, status: true, phone: true, address: true, lastLoginAt: true, createdAt: true },
    });
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    const allowedFields: any = {};
    if (dto.name) allowedFields.name = dto.name;
    if (dto.role) allowedFields.role = dto.role;
    if (dto.status) allowedFields.status = dto.status;
    if (dto.phone) allowedFields.phone = dto.phone;
    if (dto.address) allowedFields.address = dto.address;

    return this.prisma.user.update({
      where: { id },
      data: allowedFields,
      select: { id: true, name: true, email: true, role: true, status: true, phone: true, address: true },
    });
  }
}
