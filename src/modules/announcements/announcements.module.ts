import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsRepository } from './announcements.repository';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ActivityLogModule, NotificationsModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, AnnouncementsRepository],
})
export class AnnouncementsModule {}
