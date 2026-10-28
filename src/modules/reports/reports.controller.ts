import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ExportReportDto } from './dto/export-report.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentScope } from '../../common/decorators/current-scope.decorator';
import type { PermissionScopeValue } from '../../common/decorators/current-scope.decorator';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequirePermission(PermissionModule.REPORTS, PermissionAction.EXPORT)
  @Post('export')
  @ApiOperation({ summary: 'Resolve scoped report data and record an audit-log export event. File generation (PDF/Excel/CSV) connects after the export-service phase.' })
  requestExport(@Body() dto: ExportReportDto, @CurrentUser('userId') userId: string, @CurrentScope() scope: PermissionScopeValue) {
    return this.reportsService.requestExport(dto, { userId, scope });
  }
}
