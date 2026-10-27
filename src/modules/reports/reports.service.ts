import { Injectable } from '@nestjs/common';
import { ReportsRepository } from './reports.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ExportReportDto } from './dto/export-report.dto';
import type { ScopedActor } from '../dashboard/dashboard.repository';

/**
 * CSV/Excel/PDF generation itself is out of scope for this phase (matches
 * the Reports screen's disclosed "frontend only" placeholder pattern already
 * approved) — but the export REQUEST is fully real: it resolves the actual
 * scoped row data and, critically, writes an audit-log entry for every
 * export, per the "audit-safe reporting" requirement. Wiring a real
 * file-generation step later is additive here, not a rework.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly repo: ReportsRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  async getReportData(kind: ExportReportDto['report'], actor: ScopedActor) {
    switch (kind) {
      case 'tasks_by_department':
        return this.repo.tasksByDepartment(actor);
      case 'tasks_by_employee':
        return this.repo.tasksByEmployee(actor);
      case 'completed_vs_overdue':
        return this.repo.completedVsOverdue(actor);
      case 'productivity':
        return this.repo.productivity(actor);
    }
  }

  async requestExport(dto: ExportReportDto, actor: ScopedActor) {
    const rows = await this.getReportData(dto.report, actor);
    await this.activityLog.record({
      actorId: actor.userId,
      action: 'report_exported',
      details: { report: dto.report, format: dto.format, filters: dto.filters, row_count: Array.isArray(rows) ? rows.length : 1 },
    });
    return { report: dto.report, format: dto.format, row_count: Array.isArray(rows) ? rows.length : 1, data: rows };
  }
}
