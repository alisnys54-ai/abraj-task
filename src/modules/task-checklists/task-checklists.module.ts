import { Module } from '@nestjs/common';
import { TaskChecklistsController } from './task-checklists.controller';
import { TaskChecklistsService } from './task-checklists.service';
import { TaskChecklistsRepository } from './task-checklists.repository';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [TaskChecklistsController],
  providers: [TaskChecklistsService, TaskChecklistsRepository],
  exports: [TaskChecklistsService],
})
export class TaskChecklistsModule {}
