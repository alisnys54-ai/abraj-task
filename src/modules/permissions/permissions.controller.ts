import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { SystemOwnerOnly } from '../../common/decorators/system-owner-only.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Permissions')
@ApiBearerAuth('access-token')
@Controller()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @RequirePermission(PermissionModule.PERMISSIONS, PermissionAction.VIEW)
  @Get('permissions')
  @ApiOperation({ summary: 'Full permission catalog (module x action)' })
  listCatalog() {
    return this.permissionsService.listCatalog();
  }

  @RequirePermission(PermissionModule.PERMISSIONS, PermissionAction.VIEW)
  @Get('roles/:id/permissions')
  @ApiOperation({ summary: 'Get the full permission matrix for one role' })
  getForRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.getForRole(id);
  }

  @RequirePermission(PermissionModule.PERMISSIONS, PermissionAction.MANAGE)
  @SystemOwnerOnly()
  @Put('roles/:id/permissions')
  @ApiOperation({ summary: "Replace a role's entire permission matrix (System Owner only)" })
  replaceForRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRolePermissionsDto, @CurrentUser() actor: CurrentUserPayload) {
    return this.permissionsService.replaceForRole(id, dto, actor);
  }
}
