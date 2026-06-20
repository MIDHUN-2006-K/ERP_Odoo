import { Module } from '@nestjs/common';
import { ManufacturingOrdersController } from './manufacturing-orders.controller';
import { ManufacturingOrdersService } from './manufacturing-orders.service';
import { SequenceService } from '../../common/services/sequence.service';

@Module({
  controllers: [ManufacturingOrdersController],
  providers: [ManufacturingOrdersService, SequenceService],
  exports: [ManufacturingOrdersService],
})
export class ManufacturingOrdersModule {}
