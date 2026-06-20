import { Module } from '@nestjs/common';
import { WorkCentersController } from './work-centers.controller';

@Module({
  controllers: [WorkCentersController],
})
export class WorkCentersModule {}
