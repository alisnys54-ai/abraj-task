import { Module } from '@nestjs/common';
import { ReProjectsController } from './re-projects.controller';
import { ReProjectsService } from './re-projects.service';
import { ReProjectsRepository } from './re-projects.repository';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [ReProjectsController],
  providers: [ReProjectsService, ReProjectsRepository],
  exports: [ReProjectsService],
})
export class ReProjectsModule {}
