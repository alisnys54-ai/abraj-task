import { Module } from '@nestjs/common';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { LeavesRepository } from './leaves.repository';
import { EmployeesModule } from '../employees/employees.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [EmployeesModule, ActivityLogModule],
  controllers: [LeavesController],
  providers: [LeavesService, LeavesRepository],
})
export class LeavesModule {}
