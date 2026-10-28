import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ResidentialProject } from '@prisma/client';
import { SiteOperationsService } from './site-operations.service';
import { CreateSiteReportDto, CreateTicketDto, QuerySiteReportsDto, QueryTicketsDto, UpdateTicketDto } from './dto/site-operations.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequirePortal } from '../../common/decorators/require-portal.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import type { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('Residential projects — site reports & maintenance')
@ApiBearerAuth('access-token')
@RequirePortal({ fromParam: 'project_key' })
@Controller('projects/:project_key')
export class SiteOperationsController {
  constructor(private readonly ops: SiteOperationsService) {}

  @RequirePermission(PermissionModule.RE_SITE_REPORTS, PermissionAction.VIEW)
  @Get('site-reports')
  reports(@CurrentProject() project: ResidentialProject, @Query() query: QuerySiteReportsDto, @CurrentActor() actor: ScopedActor) {
    return this.ops.reports(project, query, actor);
  }

  @RequirePermission(PermissionModule.RE_SITE_REPORTS, PermissionAction.CREATE)
  @Post('site-reports')
  createReport(@CurrentProject() project: ResidentialProject, @Body() dto: CreateSiteReportDto, @CurrentActor() actor: ScopedActor) {
    return this.ops.createReport(project, dto, actor);
  }

  @RequirePermission(PermissionModule.RE_TICKETS, PermissionAction.VIEW)
  @Get('tickets')
  tickets(@CurrentProject() project: ResidentialProject, @Query() query: QueryTicketsDto, @CurrentActor() actor: ScopedActor) {
    return this.ops.tickets(project, query, actor);
  }

  @RequirePermission(PermissionModule.RE_TICKETS, PermissionAction.CREATE)
  @Post('tickets')
  createTicket(@CurrentProject() project: ResidentialProject, @Body() dto: CreateTicketDto, @CurrentActor() actor: ScopedActor) {
    return this.ops.createTicket(project, dto, actor);
  }

  @RequirePermission(PermissionModule.RE_TICKETS, PermissionAction.EDIT)
  @Patch('tickets/:id')
  updateTicket(@CurrentProject() project: ResidentialProject, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto, @CurrentActor() actor: ScopedActor) {
    return this.ops.updateTicket(project, id, dto, actor);
  }
}
