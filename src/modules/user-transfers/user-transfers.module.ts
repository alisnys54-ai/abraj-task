import { Module } from '@nestjs/common';
import { UserTransfersService } from './user-transfers.service';
import { UserTransfersRepository } from './user-transfers.repository';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
  imports: [DepartmentsModule],
  providers: [UserTransfersService, UserTransfersRepository],
  exports: [UserTransfersService],
})
export class UserTransfersModule {}
