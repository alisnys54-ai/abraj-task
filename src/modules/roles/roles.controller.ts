import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleUserDto } from './dto/assign-role-user.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { SystemOwnerOnly } from '../../common/decorators/system-owner-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @RequirePermission(PermissionModule.ROLES, PermissionAction.VIEW)
  @Get()
  list(@Query('search') search?: string) {
    return this.rolesService.list({ search });
  }

  @RequirePermission(PermissionModule.ROLES, PermissionAction.VIEW)
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.getById(id);
  }

  @RequirePermission(PermissionModule.ROLES, PermissionAction.CREATE)
  @SystemOwnerOnly()
  @Post()
  @ApiOperation({ summary: "Create a custom role, optionally cloning another role's permissions (System Owner only)" })
  create(@Body() dto: CreateRoleDto, @CurrentUser('userId') actorId: string) {
    return this.rolesService.create(dto, actorId);
  }

  @RequirePermission(PermissionModule.ROLES, PermissionAction.EDIT)
  @SystemOwnerOnly()
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto, @CurrentUser('userId') actorId: string) {
    return this.rolesService.update(id, dto, actorId);
  }

  @RequirePermission(PermissionModule.ROLES, PermissionAction.DELETE)
  @SystemOwnerOnly()
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }

  @RequirePermission(PermissionModule.ROLES, PermissionAction.VIEW)
  @Get(':id/users')
  listUsers(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQueryDto) {
    return this.rolesService.listUsers(id, query);
  }

  @RequirePermission(PermissionModule.ROLES, PermissionAction.ASSIGN)
  @SystemOwnerOnly()
  @Post(':id/users')
  assignUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRoleUserDto, @CurrentUser('userId') actorId: string) {
    return this.rolesService.assignUser(id, dto.user_id, actorId);
  }

  @RequirePermission(PermissionModule.ROLES, PermissionAction.ASSIGN)
  @SystemOwnerOnly()
  @Delete(':id/users/:userId')
  removeUser(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.rolesService.removeUser(id, userId);
  }
}
