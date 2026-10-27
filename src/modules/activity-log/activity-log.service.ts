import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
}
