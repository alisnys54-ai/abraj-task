import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AttendanceSummaryQueryDto, QueryAttendanceDto, RecordAttendanceDto } from './dto/attendance.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequirePortal } from '../../common/decorators/require-portal.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('HR — Attendance')
@ApiBearerAuth('access-token')
@RequirePortal('company')
@Controller('hr/attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @RequirePermission(PermissionModule.ATTENDANCE, PermissionAction.VIEW)
  @Get()
  @ApiOperation({ summary: 'Roll-call sheet for a day: every in-scope employee with their record (or null)' })
  day(@Query() query: QueryAttendanceDto, @CurrentActor() actor: ScopedActor) {
    return this.attendance.day(query, actor);
  }

  @RequirePermission(PermissionModule.ATTENDANCE, PermissionAction.VIEW)
  @Get('summary')
  summary(@Query() query: AttendanceSummaryQueryDto, @CurrentActor() actor: ScopedActor) {
    return this.attendance.summary(query.date, actor);
  }

  @RequirePermission(PermissionModule.ATTENDANCE, PermissionAction.CREATE)
  @Put()
  @ApiOperation({ summary: 'Record or correct a day for many employees at once (idempotent per employee+date)' })
  record(@Body() dto: RecordAttendanceDto, @CurrentActor() actor: ScopedActor) {
    return this.attendance.record(dto, actor);
  }
}
