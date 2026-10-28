import { Injectable } from '@nestjs/common';
import { NotificationEventType } from '@prisma/client';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsGateway } from './notifications.gateway';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { NotFoundException } from '@nestjs/common';

export interface DispatchInput {
  userIds: string[];
  taskId?: string;
  eventType: NotificationEventType;
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repo: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Fan-out to every recipient: writes the durable DB row (source of truth,
   * always works even if nobody is connected) AND pushes it live over the
   * socket gateway to any connected recipient. The gateway push is
   * best-effort — a disconnected client just relies on the DB row + its next
   * poll, exactly as before this existed.
   */
  async dispatch(input: DispatchInput) {
    const uniqueUserIds = Array.from(new Set(input.userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) return;
    await this.repo.createMany(
      uniqueUserIds.map((userId) => ({ userId, taskId: input.taskId, eventType: input.eventType, message: input.message })),
    );
    for (const userId of uniqueUserIds) {
      this.gateway.emitToUser(userId, 'notification', { task_id: input.taskId, event_type: input.eventType, message: input.message, created_at: new Date().toISOString() });
    }
  }

  async list(userId: string, query: QueryNotificationsDto) {
    const where: Record<string, unknown> = { userId };
    if (query.is_read !== undefined) where.isRead = query.is_read;
    if (query.type) where.eventType = query.type;

    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total, unreadCount] = await Promise.all([
      this.repo.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.repo.count(where),
      this.repo.countUnread(userId),
    ]);
    return {
      data: rows.map((n) => ({ id: n.id, task_id: n.taskId, event_type: n.eventType, message: n.message, is_read: n.isRead, created_at: n.createdAt })),
      meta: buildPaginationMeta(query.page, query.page_size, total),
      unread_count: unreadCount,
    };
  }

  async setRead(id: string, userId: string, isRead: boolean) {
    const owned = await this.repo.findOwned(id, userId);
    if (!owned) throw new NotFoundException('Notification not found');
    await this.repo.markRead(id, isRead);
  }

  async markAllRead(userId: string) {
    await this.repo.markAllRead(userId);
  }

  async remove(id: string, userId: string) {
    const owned = await this.repo.findOwned(id, userId);
    if (!owned) throw new NotFoundException('Notification not found');
    await this.repo.remove(id);
  }
}
