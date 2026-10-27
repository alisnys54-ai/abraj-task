import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TaskChecklistsService } from './task-checklists.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Task Checklists')
@ApiBearerAuth('access-token')
@Controller()
export class TaskChecklistsController {
  constructor(private readonly checklistsService: TaskChecklistsService) {}

  @RequirePermission(PermissionModule.TASK_CHECKLISTS, PermissionAction.VIEW)
  @Get('tasks/:id/checklists')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.checklistsService.list(id);
  }

  @RequirePermission(PermissionModule.TASK_CHECKLISTS, PermissionAction.CREATE)
  @Post('tasks/:id/checklists')
  createChecklist(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateChecklistDto) {
    return this.checklistsService.createChecklist(id, dto);
  }

  @RequirePermission(PermissionModule.TASK_CHECKLISTS, PermissionAction.CREATE)
  @Post('checklists/:checklistId/items')
  createItem(@Param('checklistId', ParseUUIDPipe) checklistId: string, @Body() dto: CreateChecklistItemDto, @CurrentUser('userId') actorId: string) {
    return this.checklistsService.createItem(checklistId, dto, actorId);
  }

  @RequirePermission(PermissionModule.TASK_CHECKLISTS, PermissionAction.EDIT)
  @Patch('checklist-items/:itemId')
  updateItem(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdateChecklistItemDto, @CurrentUser('userId') actorId: string) {
    return this.checklistsService.updateItem(itemId, dto, actorId);
  }

  @RequirePermission(PermissionModule.TASK_CHECKLISTS, PermissionAction.DELETE)
  @Delete('checklist-items/:itemId')
  removeItem(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.checklistsService.removeItem(itemId);
  }
}
