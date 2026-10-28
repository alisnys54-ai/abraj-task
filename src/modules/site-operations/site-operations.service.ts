import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResidentialProject } from '@prisma/client';
import { SiteOperationsRepository } from './site-operations.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateSiteReportDto, CreateTicketDto, QuerySiteReportsDto, QueryTicketsDto, UpdateTicketDto } from './dto/site-operations.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { ScopedActor, num, parseDateOnly, toDateOnly, todayUtc } from '../../common/utils/scope.util';

@Injectable()
export class SiteOperationsService {
  constructor(
    private readonly repo: SiteOperationsRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ---------------------------------------------------------------- daily reports

  async reports(project: ResidentialProject, query: QuerySiteReportsDto, actor: ScopedActor) {
    const and: Prisma.SiteDailyReportWhereInput[] = [{ site: { projectId: project.id } }];
    if (actor.scope === 'own') and.push({ engineerId: actor.userId });
    if (query.site_code) and.push({ site: { code: query.site_code } });
    if (query.from) and.push({ reportDate: { gte: parseDateOnly(query.from) } });
    if (query.to) and.push({ reportDate: { lte: parseDateOnly(query.to) } });
    if (query.search) and.push({ summary: { contains: query.search, mode: 'insensitive' } });
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([this.repo.findReports({ where, skip, take, orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }] }), this.repo.countReports(where)]);
    return {
      data: rows.map((r) => ({ id: r.id, site: r.site, engineer: { id: r.engineer.id, full_name: r.engineer.fullName }, report_date: toDateOnly(r.reportDate), summary: r.summary, workers: r.workers, concrete_m3: num(r.concreteM3), status: r.status, created_at: r.createdAt })),
      meta: buildPaginationMeta(query.page, query.page_size, total),
    };
  }

  async createReport(project: ResidentialProject, dto: CreateSiteReportDto, actor: ScopedActor) {
    const site = await this.site(project, dto.site_code);
    const reportDate = dto.report_date ? parseDateOnly(dto.report_date) : todayUtc();
    if (reportDate > todayUtc()) throw new BadRequestException('A daily report cannot be dated in the future');
    if (await this.repo.findReportFor(site.id, actor.userId, reportDate)) {
      throw new ConflictException({ code: 'REPORT_EXISTS', message: 'You already filed a report for this site on that day' });
    }
    const r = await this.repo.createReport({ siteId: site.id, engineerId: actor.userId, reportDate, summary: dto.summary.trim(), workers: dto.workers, concreteM3: dto.concrete_m3 ?? 0, status: dto.status ?? 'done' });
    await this.activityLog.record({ actorId: actor.userId, action: 'site_report_filed', newValue: `${site.code} ${toDateOnly(reportDate)}` });
    return { id: r.id, site: r.site, engineer: { id: r.engineer.id, full_name: r.engineer.fullName }, report_date: toDateOnly(r.reportDate), summary: r.summary, workers: r.workers, concrete_m3: num(r.concreteM3), status: r.status, created_at: r.createdAt };
  }

  // ---------------------------------------------------------------- maintenance tickets

  async tickets(project: ResidentialProject, query: QueryTicketsDto, actor: ScopedActor) {
    const and: Prisma.MaintenanceTicketWhereInput[] = [{ site: { projectId: project.id } }];
    if (actor.scope === 'own') and.push({ OR: [{ createdBy: actor.userId }, { assigneeId: actor.userId }] });
    if (query.site_code) and.push({ site: { code: query.site_code } });
    if (query.status) and.push({ status: query.status });
    if (query.priority) and.push({ priority: query.priority });
    if (query.search) and.push({ OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }] });
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([this.repo.findTickets({ where, skip, take, orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }] }), this.repo.countTickets(where)]);
    return { data: rows.map((t) => this.ticketPublic(t)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async createTicket(project: ResidentialProject, dto: CreateTicketDto, actor: ScopedActor) {
    const site = await this.site(project, dto.site_code);
    if (dto.unit_id) {
      const unit = await this.repo.findUnit(dto.unit_id);
      if (!unit || unit.siteId !== site.id) throw new NotFoundException('Unit not found on this site');
    }
    // Retry once on a code collision — two tickets opened in the same instant.
    for (let attempt = 0; ; attempt++) {
      try {
        const t = await this.repo.createTicket({ code: await this.repo.nextTicketCode(), siteId: site.id, unitId: dto.unit_id, clientId: dto.client_id, title: dto.title.trim(), description: dto.description, priority: dto.priority ?? 'medium', createdBy: actor.userId });
        await this.activityLog.record({ actorId: actor.userId, action: 'ticket_opened', newValue: `${t.code} ${t.title}` });
        return this.ticketPublic(t);
      } catch (e) {
        if (attempt === 0 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
  }

  async updateTicket(project: ResidentialProject, id: string, dto: UpdateTicketDto, actor: ScopedActor) {
    const t = await this.repo.findTicket(id);
    if (!t || t.site.projectId !== project.id) throw new NotFoundException('Ticket not found');
    if (actor.scope === 'own' && t.createdByUser.id !== actor.userId && t.assignee?.id !== actor.userId) throw new NotFoundException('Ticket not found');
    if (t.status === 'closed' && dto.status && dto.status !== 'closed' && actor.scope === 'own') {
      throw new ConflictException({ code: 'TICKET_CLOSED', message: 'Only a supervisor can reopen a closed ticket' });
    }
    const updated = await this.repo.updateTicket(id, {
      status: dto.status,
      assigneeId: dto.assignee_id,
      priority: dto.priority,
      closedAt: dto.status === 'closed' ? new Date() : dto.status ? null : undefined,
    });
    if (dto.status && dto.status !== t.status) {
      await this.activityLog.record({ actorId: actor.userId, action: 'ticket_status_changed', fieldName: 'status', oldValue: t.status, newValue: dto.status, details: { code: t.code } });
    }
    return this.ticketPublic(updated);
  }

  private async site(project: ResidentialProject, code: string) {
    const site = await this.repo.findSite(project.id, code);
    if (!site) throw new NotFoundException(`Site ${code} not found in ${project.key}`);
    return site;
  }

  private ticketPublic(t: Awaited<ReturnType<SiteOperationsRepository['createTicket']>>) {
    return {
      id: t.id, code: t.code, site: t.site, unit: t.unit, client: t.client ? { id: t.client.id, full_name: t.client.fullName, phone: t.client.phone } : null,
      title: t.title, description: t.description, priority: t.priority, status: t.status,
      assignee: t.assignee ? { id: t.assignee.id, full_name: t.assignee.fullName } : null,
      created_by: { id: t.createdByUser.id, full_name: t.createdByUser.fullName },
      closed_at: t.closedAt, created_at: t.createdAt,
    };
  }
}
