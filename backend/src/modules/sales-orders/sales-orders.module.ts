import { Module } from '@nestjs/common';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';
import { ProcurementService } from './procurement.service';
import { SequenceService } from '../../common/services/sequence.service';

@Module({
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService, ProcurementService, SequenceService],
  exports: [SalesOrdersService, ProcurementService],
})
export class SalesOrdersModule {}
