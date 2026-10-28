import { Module } from '@nestjs/common';
import { PortalsController } from './portals.controller';
import { PortalsService } from './portals.service';
import { PortalsRepository } from './portals.repository';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [PortalsController],
  providers: [PortalsService, PortalsRepository],
  exports: [PortalsService],
})
export class PortalsModule {}
