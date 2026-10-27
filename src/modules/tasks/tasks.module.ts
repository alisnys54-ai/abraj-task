import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TaskLookupsController } from './task-lookups.controller';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [ActivityLogModule, NotificationsModule, SchedulerModule],
  controllers: [TasksController, TaskLookupsController],
  providers: [TasksService, TasksRepository],
  exports: [TasksService],
})
export class TasksModule {}
