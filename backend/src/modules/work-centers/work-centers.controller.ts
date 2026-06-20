import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(AuthGuard('jwt'))
@Controller('work-centers')
export class WorkCentersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.workCenter.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }
}
