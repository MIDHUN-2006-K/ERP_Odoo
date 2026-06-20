import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.vendor.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: number) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(data: { name: string; email?: string; phone?: string; address?: string; gstNo?: string; paymentTerms?: string }) {
    return this.prisma.vendor.create({ data });
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    return this.prisma.vendor.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.vendor.delete({ where: { id } });
  }
}
