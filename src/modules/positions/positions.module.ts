import { Module } from '@nestjs/common';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';
import { PositionsRepository } from './positions.repository';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
  imports: [DepartmentsModule],
  controllers: [PositionsController],
  providers: [PositionsService, PositionsRepository],
  exports: [PositionsService],
})
export class PositionsModule {}
