import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentsRepository } from './attachments.repository';
import { StorageModule } from '../storage/storage.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [StorageModule, ActivityLogModule, NotificationsModule, TasksModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentsRepository],
})
export class AttachmentsModule {}
