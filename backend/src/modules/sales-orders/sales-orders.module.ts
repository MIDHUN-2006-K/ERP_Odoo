import { Module } from '@nestjs/common';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';
import { SequenceService } from '../../common/services/sequence.service';

@Module({
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService, SequenceService],
  exports: [SalesOrdersService],
})
export class SalesOrdersModule {}
