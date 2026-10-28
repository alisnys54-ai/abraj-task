import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('Activity log')
@ApiBearerAuth('access-token')
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLog: ActivityLogService) {}

  @RequirePermission(PermissionModule.ACTIVITY_LOGS, PermissionAction.VIEW)
  @Get()
  list(@Query() query: QueryActivityLogDto, @CurrentActor() actor: ScopedActor) {
    return this.activityLog.list(query, actor);
  }
}
