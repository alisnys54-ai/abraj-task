import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopedActor } from '../dashboard/dashboard.repository';
import { DashboardRepository } from '../dashboard/dashboard.repository';

export type ReportKind = 'tasks_by_department' | 'tasks_by_employee' | 'completed_vs_overdue' | 'productivity';

/** Row-level data backing the export endpoints — reuses DashboardRepository's scoping so exports can never leak data a live dashboard view wouldn't also show. */
@Injectable()
export class ReportsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardRepository,
  ) {}

  async tasksByDepartment(actor: ScopedActor) {
    return this.dashboard.departmentStatistics(actor);
  }

  async tasksByEmployee(actor: ScopedActor) {
    return this.dashboard.workloadByUser(actor);
  }

  async completedVsOverdue(actor: ScopedActor) {
    const kpi = await this.dashboard.kpiSummary(actor);
    return [{ completed: kpi.completed, overdue: kpi.overdue, total: kpi.total, completion_rate: kpi.completion_rate }];
  }

  async productivity(actor: ScopedActor) {
    return this.dashboard.productivityMetrics(actor);
  }
}
