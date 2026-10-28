import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ResidentialProject } from '@prisma/client';
import { ReProjectsService } from './re-projects.service';
import { QueryUnitsDto, UpdateUnitStatusDto } from './dto/re-projects.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequirePortal } from '../../common/decorators/require-portal.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';

@ApiTags('Residential projects')
@ApiBearerAuth('access-token')
@Controller('projects')
export class ReProjectsController {
  constructor(private readonly projects: ReProjectsService) {}

  @RequirePermission(PermissionModule.RE_PROJECTS, PermissionAction.VIEW)
  @Get()
  @ApiOperation({ summary: 'Projects (and their sites) the caller may open' })
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.projects.list(user.userId, user.isSystemOwner);
  }

  @RequirePermission(PermissionModule.RE_PROJECTS, PermissionAction.VIEW)
  @RequirePortal({ fromParam: 'project_key' })
  @Get(':project_key')
  get(@CurrentProject() project: ResidentialProject) {
    return this.projects.get(project);
  }

  @RequirePermission(PermissionModule.RE_PROJECTS, PermissionAction.VIEW)
  @RequirePortal({ fromParam: 'project_key' })
  @Get(':project_key/sites/:site_code/summary')
  summary(@CurrentProject() project: ResidentialProject, @Param('site_code') siteCode: string) {
    return this.projects.summary(project, siteCode);
  }

  @RequirePermission(PermissionModule.RE_UNITS, PermissionAction.VIEW)
  @RequirePortal({ fromParam: 'project_key' })
  @Get(':project_key/units')
  units(@CurrentProject() project: ResidentialProject, @Query() query: QueryUnitsDto) {
    return this.projects.units(project, query);
  }

  @RequirePermission(PermissionModule.RE_UNITS, PermissionAction.EDIT)
  @RequirePortal({ fromParam: 'project_key' })
  @Patch(':project_key/units/:id')
  setUnitStatus(@CurrentProject() project: ResidentialProject, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitStatusDto, @CurrentUser('userId') actorId: string) {
    return this.projects.setUnitStatus(project, id, dto.status, actorId);
  }
}
