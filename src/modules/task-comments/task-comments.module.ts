import { Module } from '@nestjs/common';
import { TaskCommentsController } from './task-comments.controller';
import { TaskCommentsService } from './task-comments.service';
import { TaskCommentsRepository } from './task-comments.repository';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [ActivityLogModule, NotificationsModule, TasksModule],
  controllers: [TaskCommentsController],
  providers: [TaskCommentsService, TaskCommentsRepository],
})
export class TaskCommentsModule {}
