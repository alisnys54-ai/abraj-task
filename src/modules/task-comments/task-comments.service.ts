import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TaskCommentsRepository } from './task-comments.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';

const EDIT_WINDOW_MINUTES = 15;

@Injectable()
export class TaskCommentsService {
  constructor(
    private readonly repo: TaskCommentsRepository,
    private readonly activityLog: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(taskId: string, query: { page: number; page_size: number }) {
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([this.repo.findByTask(taskId, skip, take), this.repo.count(taskId)]);
    return { data: rows.map((c) => this.toPublic(c)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async create(taskId: string, dto: CreateCommentDto, authorId: string, notifyUserIds: string[]) {
    const mentionedIds = dto.mentioned_user_ids ?? [];
    const created = await this.repo.create({
      task: { connect: { id: taskId } },
      author: { connect: { id: authorId } },
      body: dto.body,
      ...(dto.parent_comment_id ? { parentComment: { connect: { id: dto.parent_comment_id } } } : {}),
    });

    if (mentionedIds.length) {
      await this.repo.createMentions(created.id, mentionedIds);
      await this.notifications.dispatch({ userIds: mentionedIds.filter((id) => id !== authorId), taskId, eventType: 'mention', message: 'You were mentioned in a comment' });
    }

    await this.activityLog.record({ taskId, actorId: authorId, action: 'comment_added' });
    await this.notifications.dispatch({
      userIds: notifyUserIds.filter((id) => id !== authorId && !mentionedIds.includes(id)),
      taskId, eventType: 'comment_added', message: 'New comment on a task you follow',
    });

    const full = await this.repo.findByIdWithRelations(created.id);
    return this.toPublic(full!);
  }

  async update(id: string, dto: UpdateCommentDto, actorId: string) {
    const comment = await this.repo.findById(id);
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== actorId) throw new ForbiddenException('You can only edit your own comment');

    const ageMinutes = (Date.now() - comment.createdAt.getTime()) / 60000;
    if (ageMinutes > EDIT_WINDOW_MINUTES) {
      throw new ForbiddenException(`Comments can only be edited within ${EDIT_WINDOW_MINUTES} minutes of posting`);
    }

    await this.repo.addEditHistory({ comment: { connect: { id } }, previousBody: comment.body, editedByUser: { connect: { id: actorId } } });
    const updated = await this.repo.update(id, { body: dto.body, editedAt: new Date() });
    return { id: updated.id, body: updated.body, edited_at: updated.editedAt };
  }

  async remove(id: string, actorId: string, canManage: boolean) {
    const comment = await this.repo.findById(id);
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== actorId && !canManage) throw new ForbiddenException('You can only delete your own comment');
    await this.repo.softDelete(id);
  }

  private toPublic(c: { id: string; body: string; authorId: string; author?: { fullName: string }; parentCommentId: string | null; mentions?: { mentionedUserId: string }[]; editedAt: Date | null; createdAt: Date }) {
    return {
      id: c.id,
      body: c.body,
      author: c.author ? { id: c.authorId, full_name: c.author.fullName } : { id: c.authorId },
      parent_comment_id: c.parentCommentId,
      mentioned_user_ids: (c.mentions ?? []).map((m) => m.mentionedUserId),
      edited_at: c.editedAt,
      created_at: c.createdAt,
    };
  }
}
