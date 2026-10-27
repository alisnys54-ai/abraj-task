import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentScope } from '../../common/decorators/current-scope.decorator';
import type { PermissionScopeValue } from '../../common/decorators/current-scope.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  @Get('executive')
  @ApiOperation({ summary: 'Company-wide KPIs, department breakdown, overdue analytics, completion trend — scoped to caller (System Owner sees all)' })
  executive(@CurrentUser('userId') userId: string, @CurrentScope() scope: PermissionScopeValue, @Query() query: DashboardQueryDto) {
    return this.dashboardService.executive({ userId, scope }, query);
  }

  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  @Get('team')
  @ApiOperation({ summary: 'Department-scoped workload distribution + KPIs + overdue — for Managers' })
  team(@CurrentUser('userId') userId: string, @CurrentScope() scope: PermissionScopeValue, @Query() query: DashboardQueryDto) {
    return this.dashboardService.team({ userId, scope }, query);
  }

  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  @Get('personal')
  @ApiOperation({ summary: "Caller's own KPIs — for Employees" })
  personal(@CurrentUser('userId') userId: string, @CurrentScope() scope: PermissionScopeValue, @Query() query: DashboardQueryDto) {
    return this.dashboardService.personal({ userId, scope }, query);
  }

  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  @Get('workload')
  workload(@CurrentUser('userId') userId: string, @CurrentScope() scope: PermissionScopeValue, @Query() query: DashboardQueryDto) {
    return this.dashboardService.workloadByUser({ userId, scope }, query);
  }

  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  @Get('departments')
  departments(@CurrentUser('userId') userId: string, @CurrentScope() scope: PermissionScopeValue, @Query() query: DashboardQueryDto) {
    return this.dashboardService.departmentStatistics({ userId, scope }, query);
  }

  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  @Get('completion-trend')
  completionTrend(@CurrentUser('userId') userId: string, @CurrentScope() scope: PermissionScopeValue, @Query() query: DashboardQueryDto) {
    return this.dashboardService.completionTrend({ userId, scope }, query);
  }

  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  @Get('overdue')
  overdue(@CurrentUser('userId') userId: string, @CurrentScope() scope: PermissionScopeValue, @Query() query: DashboardQueryDto) {
    return this.dashboardService.overdueAnalytics({ userId, scope }, query);
  }

  @RequirePermission(PermissionModule.REPORTS, PermissionAction.VIEW)
  @Get('productivity')
  productivity(@CurrentUser('userId') userId: string, @CurrentScope() scope: PermissionScopeValue, @Query() query: DashboardQueryDto) {
    return this.dashboardService.productivityMetrics({ userId, scope }, query);
  }
}
