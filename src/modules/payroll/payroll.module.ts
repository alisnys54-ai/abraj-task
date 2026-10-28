import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from './payroll.repository';
import { EmployeesModule } from '../employees/employees.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [EmployeesModule, ActivityLogModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollRepository],
})
export class PayrollModule {}
