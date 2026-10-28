import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TERMINAL_TASK_STATUSES } from '../../common/constants/task.constants';
import type { PermissionScopeValue } from '../../common/decorators/current-scope.decorator';

export interface ScopedActor {
  userId: string;
  scope: PermissionScopeValue;
}

/** Every query here goes through the same scope-narrowing helper — a Manager's dashboard can structurally never aggregate another department's numbers, and an Employee's can never see beyond their own tasks. */
@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async scopeWhere(actor: ScopedActor) {
    if (actor.scope === 'all') return {};
    if (actor.scope === 'department') {
      const user = await this.prisma.user.findUnique({ where: { id: actor.userId }, select: { departmentId: true } });
      return { departmentId: user?.departmentId ?? '__none__' };
    }
    return {
      OR: [
        { creatorId: actor.userId },
        { assigneeId: actor.userId },
        { additionalAssignees: { some: { userId: actor.userId } } },
      ],
    };
  }

  async kpiSummary(actor: ScopedActor, dateFrom?: Date, dateTo?: Date) {
    const scope = await this.scopeWhere(actor);
    const dateFilter = dateFrom || dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {};
    const where = { deletedAt: null, ...scope, ...dateFilter };

    const [total, byStatus, overdue] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.groupBy({ by: ['statusId'], where, _count: { _all: true } }),
      this.prisma.task.count({ where: { ...where, dueDate: { lt: new Date() }, status: { name: { notIn: TERMINAL_TASK_STATUSES } } } }),
    ]);
    const statuses = await this.prisma.taskStatus.findMany();
    const statusById = new Map(statuses.map((s) => [s.id, s.name]));
    const countByStatusName: Record<string, number> = {};
    for (const row of byStatus) countByStatusName[statusById.get(row.statusId) ?? row.statusId] = row._count._all;

    const completed = countByStatusName['completed'] ?? 0;
    const active = total - (countByStatusName['completed'] ?? 0) - (countByStatusName['rejected'] ?? 0) - (countByStatusName['cancelled'] ?? 0) - (countByStatusName['archived'] ?? 0);

    return { total, active, completed, overdue, completion_rate: total ? Math.round((completed / total) * 100) : 0, by_status: countByStatusName };
  }

  async workloadByUser(actor: ScopedActor) {
    const scope = await this.scopeWhere(actor);
    const rows = await this.prisma.task.groupBy({
      by: ['assigneeId'],
      where: { deletedAt: null, ...scope, assigneeId: { not: null }, status: { name: { notIn: TERMINAL_TASK_STATUSES } } },
      _count: { _all: true },
    });
    const userIds = rows.map((r) => r.assigneeId).filter((id): id is string => !!id);
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    return rows.map((r) => ({ user_id: r.assigneeId, full_name: nameById.get(r.assigneeId!) ?? 'Unknown', active_tasks: r._count._all }));
  }

  async departmentStatistics(actor: ScopedActor) {
    const scope = await this.scopeWhere(actor);
    const depts = await this.prisma.department.findMany({ where: { deletedAt: null, isActive: true } });
    const results = await Promise.all(
      depts.map(async (d) => {
        const where = { deletedAt: null, departmentId: d.id, ...(actor.scope === 'own' ? scope : {}) };
        const [total, completed, overdue, employeeCount] = await Promise.all([
          this.prisma.task.count({ where }),
          this.prisma.task.count({ where: { ...where, status: { name: 'completed' } } }),
          this.prisma.task.count({ where: { ...where, dueDate: { lt: new Date() }, status: { name: { notIn: TERMINAL_TASK_STATUSES } } } }),
          this.prisma.user.count({ where: { departmentId: d.id, deletedAt: null } }),
        ]);
        return { department_id: d.id, name: d.name, total_tasks: total, completed, overdue, employee_count: employeeCount, completion_rate: total ? Math.round((completed / total) * 100) : 0 };
      }),
    );
    return results;
  }

  async completionTrend(actor: ScopedActor, weeks: number) {
    const scope = await this.scopeWhere(actor);
    const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.taskStatusHistory.findMany({
      where: { changedAt: { gte: since }, toStatus: { name: 'completed' }, task: { deletedAt: null, ...scope } },
      select: { changedAt: true },
    });
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const weekStart = new Date(r.changedAt);
      weekStart.setUTCHours(0, 0, 0, 0);
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      const key = weekStart.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([week_start, completed]) => ({ week_start, completed }));
  }

  async overdueAnalytics(actor: ScopedActor) {
    const scope = await this.scopeWhere(actor);
    const where = { deletedAt: null, ...scope, dueDate: { lt: new Date() }, status: { name: { notIn: TERMINAL_TASK_STATUSES } } };
    const [total, byPriority, byDepartment] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.groupBy({ by: ['priorityId'], where, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['departmentId'], where, _count: { _all: true } }),
    ]);
    const [priorities, depts] = await Promise.all([this.prisma.taskPriority.findMany(), this.prisma.department.findMany()]);
    const prioName = new Map(priorities.map((p) => [p.id, p.name]));
    const deptName = new Map(depts.map((d) => [d.id, d.name]));
    return {
      total_overdue: total,
      by_priority: byPriority.map((r) => ({ priority: prioName.get(r.priorityId) ?? r.priorityId, count: r._count._all })),
      by_department: byDepartment.map((r) => ({ department: deptName.get(r.departmentId) ?? r.departmentId, count: r._count._all })),
    };
  }

  async productivityMetrics(actor: ScopedActor) {
    const scope = await this.scopeWhere(actor);
    const completedTasks = await this.prisma.task.findMany({
      where: { deletedAt: null, ...scope, status: { name: 'completed' } },
      select: { createdAt: true, updatedAt: true, assigneeId: true },
    });
    const byUser = new Map<string, { total: number; sumHours: number }>();
    for (const t of completedTasks) {
      if (!t.assigneeId) continue;
      const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
      const entry = byUser.get(t.assigneeId) ?? { total: 0, sumHours: 0 };
      entry.total += 1;
      entry.sumHours += hours;
      byUser.set(t.assigneeId, entry);
    }
    const userIds = Array.from(byUser.keys());
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    return Array.from(byUser.entries())
      .map(([userId, v]) => ({ user_id: userId, full_name: nameById.get(userId) ?? 'Unknown', completed_count: v.total, avg_completion_hours: Math.round((v.sumHours / v.total) * 10) / 10 }))
      .sort((a, b) => b.completed_count - a.completed_count);
  }
}
