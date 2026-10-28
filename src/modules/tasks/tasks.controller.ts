import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';
import { TransferTaskDto } from './dto/transfer-task.dto';
import { AddAssigneeDto } from './dto/add-assignee.dto';
import { AddWatcherDto } from './dto/add-watcher.dto';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CurrentScope } from '../../common/decorators/current-scope.decorator';
import type { PermissionScopeValue } from '../../common/decorators/current-scope.decorator';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @RequirePermission(PermissionModule.TASKS, PermissionAction.VIEW)
  @Get()
  list(@Query() query: QueryTasksDto, @CurrentUser() user: CurrentUserPayload, @CurrentScope() scope: PermissionScopeValue) {
    return this.tasksService.list(query, this.actor(user, scope));
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.VIEW)
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserPayload, @CurrentScope() scope: PermissionScopeValue) {
    return this.tasksService.getById(id, this.actor(user, scope));
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.CREATE)
  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser('userId') userId: string) {
    return this.tasksService.create(dto, userId);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.EDIT)
  @Patch(':id')
  @ApiOperation({ summary: 'Edit task fields — each changed field is recorded in the activity timeline' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @CurrentUser('userId') userId: string) {
    return this.tasksService.update(id, dto, userId);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.DELETE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.EDIT)
  @Post(':id/status')
  @ApiOperation({ summary: 'Transition status per the approved state machine — Waiting Approval -> Completed/Rejected additionally requires tasks:approve' })
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStatusDto, @CurrentUser() user: CurrentUserPayload, @CurrentScope() scope: PermissionScopeValue) {
    return this.tasksService.changeStatus(id, dto, this.actor(user, scope));
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.ASSIGN)
  @Post(':id/assign')
  reassign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReassignTaskDto, @CurrentUser('userId') userId: string) {
    return this.tasksService.reassign(id, dto, userId);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.ASSIGN)
  @Post(':id/transfer')
  @ApiOperation({ summary: "Transfer a task's department and/or primary assignee as one deliberate ownership change" })
  transferOwnership(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferTaskDto, @CurrentUser('userId') userId: string) {
    return this.tasksService.transferOwnership(id, dto, userId);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.CREATE)
  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') userId: string) {
    return this.tasksService.duplicate(id, userId);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.VIEW)
  @Get(':id/subtasks')
  listSubtasks(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.listSubtasks(id);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.VIEW)
  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string, @Query('page') page = 1, @Query('page_size') pageSize = 20) {
    return this.tasksService.getHistory(id, Number(page), Number(pageSize));
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.VIEW)
  @Get(':id/watchers')
  listWatchers(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.listWatchers(id);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.VIEW)
  @Post(':id/watchers')
  @ApiOperation({ summary: 'Watch a task — any user who can view it may opt in' })
  addWatcher(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddWatcherDto) {
    return this.tasksService.addWatcher(id, dto.user_id);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.VIEW)
  @Delete(':id/watchers/:userId')
  removeWatcher(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.tasksService.removeWatcher(id, userId);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.VIEW)
  @Get(':id/assignees')
  listAssignees(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.listAssignees(id);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.ASSIGN)
  @Post(':id/assignees')
  @ApiOperation({ summary: 'Add an additional collaborator beyond the single primary assignee' })
  addAssignee(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddAssigneeDto, @CurrentUser('userId') actorId: string) {
    return this.tasksService.addAssignee(id, dto, actorId);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.ASSIGN)
  @Delete(':id/assignees/:userId')
  removeAssignee(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.tasksService.removeAssignee(id, userId);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.EDIT)
  @Post(':id/dependencies')
  addDependency(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddDependencyDto) {
    return this.tasksService.addDependency(id, dto);
  }

  @RequirePermission(PermissionModule.TASKS, PermissionAction.EDIT)
  @Delete('dependencies/:dependencyId')
  removeDependency(@Param('dependencyId', ParseUUIDPipe) dependencyId: string) {
    return this.tasksService.removeDependency(dependencyId);
  }

  private actor(user: CurrentUserPayload, scope: PermissionScopeValue) {
    return { userId: user.userId, roleId: user.roleId, isSystemOwner: user.isSystemOwner, scope };
  }
}
