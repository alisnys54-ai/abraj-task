import { Module } from '@nestjs/common';
import { SiteOperationsController } from './site-operations.controller';
import { SiteOperationsService } from './site-operations.service';
import { SiteOperationsRepository } from './site-operations.repository';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [SiteOperationsController],
  providers: [SiteOperationsService, SiteOperationsRepository],
})
export class SiteOperationsModule {}
