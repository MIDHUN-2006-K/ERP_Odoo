import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SequenceService {
  constructor(private prisma: PrismaService) {}

  async getNext(prefix: string): Promise<string> {
    // Upsert the sequence and get the next value atomically
    const sequence = await this.prisma.sequence.upsert({
      where: { prefix },
      update: { nextVal: { increment: 1 } },
      create: { prefix, nextVal: 2 }, // First value used is 1, next will be 2
    });

    // The value returned is the NEW value after increment, so we use nextVal - 1
    const val = sequence.nextVal - 1;
    return `${prefix}-${String(val).padStart(6, '0')}`;
  }
}
