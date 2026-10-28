import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementsRepository } from './announcements.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAnnouncementDto } from './dto/announcement.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { ScopedActor, actorDepartmentId, person } from '../../common/utils/scope.util';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly repo: AnnouncementsRepository,
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Company-wide posts plus posts for the reader's own department — the board everyone sees. */
  async list(query: PaginationQueryDto, actor: ScopedActor) {
    const deptId = await actorDepartmentId(this.prisma, actor.userId);
    const where = {
      deletedAt: null,
      ...(actor.scope === 'all' ? {} : { OR: [{ audience: 'all' as const }, { departmentId: deptId }] }),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([
      this.repo.findMany({ where, skip, take, orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }] }),
      this.repo.count(where),
    ]);
    return { data: rows.map((a) => this.toPublic(a)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async create(dto: CreateAnnouncementDto, actor: ScopedActor) {
    const audience = dto.audience ?? 'all';
    const ownDept = await actorDepartmentId(this.prisma, actor.userId);
    if (actor.scope !== 'all' && audience === 'all') {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'Only company-wide publishers can post to everyone — post to your department instead' });
    }
    const departmentId = audience === 'department' ? dto.department_id ?? ownDept : null;
    if (audience === 'department' && actor.scope !== 'all' && departmentId !== ownDept) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'You can only post to your own department' });
    }
    if (audience === 'department' && !departmentId) throw new BadRequestException('department_id is required');

    const created = await this.repo.create({
      title: dto.title.trim(), body: dto.body, category: dto.category, audience, departmentId, pinned: !!dto.pinned, publishedBy: actor.userId,
    });
    const recipients = await this.prisma.user.findMany({
      where: { deletedAt: null, status: 'active', id: { not: actor.userId }, ...(departmentId ? { departmentId } : {}) },
      select: { id: true },
    });
    await this.notifications.dispatch({ userIds: recipients.map((u) => u.id), eventType: 'system_announcement', message: `إعلان جديد: ${created.title}` });
    await this.activityLog.record({ actorId: actor.userId, action: 'announcement_published', newValue: created.title });
    return this.toPublic(created);
  }

  async remove(id: string, actor: ScopedActor) {
    const a = await this.repo.findById(id);
    if (!a) throw new NotFoundException('Announcement not found');
    if (a.publishedBy !== actor.userId && actor.scope !== 'all') throw new ForbiddenException('Only the publisher or a company-wide admin can remove this');
    await this.repo.softDelete(id);
    await this.activityLog.record({ actorId: actor.userId, action: 'announcement_removed', oldValue: a.title });
  }

  private toPublic(a: NonNullable<Awaited<ReturnType<AnnouncementsRepository['findById']>>>) {
    return {
      id: a.id, title: a.title, body: a.body, category: a.category, audience: a.audience, department: a.department,
      pinned: a.pinned, published_by: person(a.publishedByUser), published_at: a.publishedAt,
    };
  }
}
