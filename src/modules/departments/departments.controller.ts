import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { MoveDepartmentDto } from './dto/move-department.dto';
import { QueryDepartmentsDto } from './dto/query-departments.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { SystemOwnerOnly } from '../../common/decorators/system-owner-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Departments')
@ApiBearerAuth('access-token')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.VIEW)
  @Get()
  list(@Query() query: QueryDepartmentsDto) {
    return this.departmentsService.list(query);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.VIEW)
  @Get('tree')
  @ApiOperation({ summary: 'Full nested organization tree with employee/position counts per node' })
  getTree(@Query('include_archived') includeArchived?: string) {
    return this.departmentsService.getTree(includeArchived === 'true');
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.VIEW)
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.getById(id);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.CREATE)
  @SystemOwnerOnly()
  @Post()
  @ApiOperation({ summary: 'Create a department, optionally under a parent (System Owner only)' })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser('userId') actorId: string) {
    return this.departmentsService.create(dto, actorId);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.EDIT)
  @SystemOwnerOnly()
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto, @CurrentUser('userId') actorId: string) {
    return this.departmentsService.update(id, dto, actorId);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.EDIT)
  @SystemOwnerOnly()
  @Post(':id/move')
  @ApiOperation({ summary: 'Move a department to a new parent (or make it a root) — rejects circular hierarchy' })
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDepartmentDto, @CurrentUser('userId') actorId: string) {
    return this.departmentsService.move(id, dto, actorId);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.EDIT)
  @SystemOwnerOnly()
  @Patch(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') actorId: string) {
    return this.departmentsService.archive(id, actorId);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.EDIT)
  @SystemOwnerOnly()
  @Patch(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') actorId: string) {
    return this.departmentsService.restore(id, actorId);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.DELETE)
  @SystemOwnerOnly()
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a department — blocked if it still has child departments, active users, or active tasks' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.remove(id);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.VIEW)
  @Get(':id/managers')
  listManagers(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.listManagers(id);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.MANAGE)
  @SystemOwnerOnly()
  @Post(':id/managers')
  @ApiOperation({ summary: 'Add a manager to a department — a department may have any number of managers' })
  addManager(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignManagerDto, @CurrentUser('userId') actorId: string) {
    return this.departmentsService.addManager(id, dto, actorId);
  }

  @RequirePermission(PermissionModule.DEPARTMENTS, PermissionAction.MANAGE)
  @SystemOwnerOnly()
  @Delete(':id/managers/:userId')
  removeManager(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.departmentsService.removeManager(id, userId);
  }
}
