import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { actorDepartmentId, person, type ScopedActor } from '../../common/utils/scope.util';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import type { QueryActivityLogDto } from './dto/query-activity-log.dto';

export interface RecordActivityInput {
  taskId?: string;
  actorId?: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  details?: Record<string, unknown>;
}

/** Insert-only audit trail writer used by every Task-Engine module — one consistent shape for every event type. */
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordActivityInput) {
    await this.prisma.activityLog.create({
      data: {
        taskId: input.taskId,
        actorId: input.actorId,
        action: input.action,
        fieldName: input.fieldName,
        oldValue: input.oldValue,
        newValue: input.newValue,
        details: input.details as Prisma.InputJsonValue,
      },
    });
  }

  async listForTask(taskId: string, skip: number, take: number) {
    const [rows, total] = await Promise.all([
      this.prisma.activityLog.findMany({ where: { taskId }, skip, take, orderBy: { createdAt: 'desc' }, include: { actor: true } }),
      this.prisma.activityLog.count({ where: { taskId } }),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.id,
        action: r.action,
        field_name: r.fieldName,
        old_value: r.oldValue,
        new_value: r.newValue,
        actor: r.actor ? { id: r.actor.id, full_name: r.actor.fullName } : null,
        created_at: r.createdAt,
      })),
      total,
    };
  }

  /** The audit screen: scope `own` sees only the caller's own actions, `department` their department's, `all` everything. */
  async list(query: QueryActivityLogDto, actor: ScopedActor) {
    const and: Prisma.ActivityLogWhereInput[] = [];
    if (!actor.isSystemOwner && actor.scope === 'own') and.push({ actorId: actor.userId });
    if (!actor.isSystemOwner && actor.scope === 'department') {
      and.push({ actor: { departmentId: await actorDepartmentId(this.prisma, actor.userId) } });
    }
    if (query.user_id) and.push({ actorId: query.user_id });
    if (query.task_id) and.push({ taskId: query.task_id });
    if (query.search) {
      and.push({
        OR: [
          { action: { contains: query.search, mode: 'insensitive' } },
          { fieldName: { contains: query.search, mode: 'insensitive' } },
          { actor: { fullName: { contains: query.search, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.ActivityLogWhereInput = { AND: and };

    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([
      this.prisma.activityLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { actor: true } }),
      this.prisma.activityLog.count({ where }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        task_id: r.taskId,
        action: r.action,
        field_name: r.fieldName,
        old_value: r.oldValue,
        new_value: r.newValue,
        actor: person(r.actor),
        created_at: r.createdAt,
      })),
      meta: buildPaginationMeta(query.page, query.page_size, total),
    };
  }
}
