import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TaskCommentsService } from './task-comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentScope } from '../../common/decorators/current-scope.decorator';
import type { PermissionScopeValue } from '../../common/decorators/current-scope.decorator';
import { TasksService } from '../tasks/tasks.service';

@ApiTags('Task Comments')
@ApiBearerAuth('access-token')
@Controller('tasks/:id/comments')
export class TaskCommentsController {
  constructor(
    private readonly commentsService: TaskCommentsService,
    private readonly tasksService: TasksService,
  ) {}

  @RequirePermission(PermissionModule.TASK_COMMENTS, PermissionAction.VIEW)
  @Get()
  list(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQueryDto) {
    return this.commentsService.list(id, query);
  }

  @RequirePermission(PermissionModule.TASK_COMMENTS, PermissionAction.COMMENT)
  @Post()
  async create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto, @CurrentUser('userId') authorId: string) {
    const notifyUserIds = await this.tasksService.getInterestedUserIds(id);
    return this.commentsService.create(id, dto, authorId, notifyUserIds);
  }

  @RequirePermission(PermissionModule.TASK_COMMENTS, PermissionAction.EDIT)
  @Patch(':commentId')
  update(@Param('commentId', ParseUUIDPipe) commentId: string, @Body() dto: UpdateCommentDto, @CurrentUser('userId') actorId: string) {
    return this.commentsService.update(commentId, dto, actorId);
  }

  @RequirePermission(PermissionModule.TASK_COMMENTS, PermissionAction.DELETE)
  @Delete(':commentId')
  remove(@Param('commentId', ParseUUIDPipe) commentId: string, @CurrentUser('userId') actorId: string, @CurrentScope() scope: PermissionScopeValue) {
    return this.commentsService.remove(commentId, actorId, scope !== 'own');
  }
}
