import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResidentialProject } from '@prisma/client';
import { ReProjectsRepository } from './re-projects.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { QueryUnitsDto } from './dto/re-projects.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { num, todayUtc } from '../../common/utils/scope.util';

@Injectable()
export class ReProjectsService {
  constructor(
    private readonly repo: ReProjectsRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  /** Projects the caller may see: company-portal holders see the whole portfolio (incl. investments); others only their project portals. */
  async list(userId: string, isSystemOwner: boolean) {
    const portals = new Set((await this.repo.portalsOf(userId)).map((p) => p.portal));
    const where: Prisma.ResidentialProjectWhereInput = isSystemOwner || portals.has('company') ? {} : { portal: { in: [...portals] } };
    return (await this.repo.listProjects(where)).map((p) => ({
      id: p.id, key: p.key, name: p.name, kind: p.kind, portal: p.portal, governorate: p.governorate, description: p.description,
      sites: p.sites.map((s) => this.sitePublic(s)),
    }));
  }

  async get(project: ResidentialProject) {
    const p = await this.repo.findProject(project.id);
    if (!p) throw new NotFoundException('Project not found');
    return {
      id: p.id, key: p.key, name: p.name, kind: p.kind, portal: p.portal, governorate: p.governorate, description: p.description,
      sites: p.sites.map((s) => ({
        ...this.sitePublic(s),
        unit_types: s.unitTypes.map((t) => ({ id: t.id, code: t.code, area_m2: num(t.areaM2), price: num(t.price), currency: t.currency })),
      })),
    };
  }

  async siteOrThrow(project: ResidentialProject, code: string) {
    const site = await this.repo.findSite(project.id, code);
    if (!site) throw new NotFoundException(`Site ${code} not found in ${project.key}`);
    return site;
  }

  /** Dashboard numbers for one site: unit mix, this month's bookings, overdue installments, 6-month collections. */
  async summary(project: ResidentialProject, siteCode: string) {
    const site = await this.siteOrThrow(project, siteCode);
    const today = todayUtc();
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const sixMonths = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
    const [byStatus, bookings, overdue, collections] = await Promise.all([
      this.repo.unitsByStatus(site.id),
      this.repo.bookingsSince(site.id, monthStart),
      this.repo.overdueInstallments(site.id, today),
      this.repo.collectionsByMonth(site.id, sixMonths),
    ]);
    const units = Object.fromEntries(byStatus.map((g) => [g.status, g._count._all]));
    const months: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
      const key = d.toISOString().slice(0, 7);
      months.push({ month: key, total: Number(collections.find((c) => c.month === key)?.total ?? 0) });
    }
    return {
      site: this.sitePublic(site),
      units: { available: units.available ?? 0, reserved: units.reserved ?? 0, sold: units.sold ?? 0, under_construction: units.under_construction ?? 0, recorded: byStatus.reduce((a, g) => a + g._count._all, 0) },
      bookings_this_month: bookings,
      overdue_installments: { count: overdue._count._all, amount: num(overdue._sum.amount) ?? 0 },
      collections: months,
    };
  }

  async units(project: ResidentialProject, query: QueryUnitsDto) {
    const and: Prisma.UnitWhereInput[] = [{ site: { projectId: project.id } }];
    if (query.site_code) and.push({ site: { code: query.site_code } });
    if (query.block) and.push({ block: query.block });
    if (query.type_code) and.push({ unitType: { code: query.type_code } });
    if (query.status) and.push({ status: query.status });
    if (query.search) and.push({ number: { contains: query.search, mode: 'insensitive' } });
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([this.repo.findUnits({ where, skip, take, orderBy: [{ block: 'asc' }, { number: 'asc' }] }), this.repo.countUnits(where)]);
    return {
      data: rows.map((u) => ({
        id: u.id, site: u.site, block: u.block, number: u.number, status: u.status,
        type: { code: u.unitType.code, area_m2: num(u.unitType.areaM2), price: num(u.unitType.price), currency: u.unitType.currency },
        active_booking: u.bookings[0] ? { id: u.bookings[0].id, status: u.bookings[0].status, client_name: u.bookings[0].client.fullName } : null,
      })),
      meta: buildPaginationMeta(query.page, query.page_size, total),
    };
  }

  async setUnitStatus(project: ResidentialProject, unitId: string, status: 'available' | 'under_construction', actorId: string) {
    const unit = await this.repo.findUnit(unitId);
    if (!unit || unit.site.projectId !== project.id) throw new NotFoundException('Unit not found');
    const from = status === 'available' ? 'under_construction' : 'available';
    const res = await this.repo.setUnitStatusIf(unitId, from, status);
    if (res.count === 0) throw new ConflictException({ code: 'UNIT_STATUS_LOCKED', message: `Only ${from} units can be set to ${status}; reserved and sold units change through bookings` });
    await this.activityLog.record({ actorId, action: 'unit_status_changed', fieldName: 'status', oldValue: from, newValue: status, details: { unit: unit.number, project: project.key } });
    return { id: unitId, status };
  }

  private sitePublic(s: { id: string; code: string; name: string; location: string; license: string | null; costLabel: string | null; authority: string | null; progress: number; phase: string | null; totalUnits: number }) {
    return { id: s.id, code: s.code, name: s.name, location: s.location, license: s.license, cost_label: s.costLabel, authority: s.authority, progress: s.progress, phase: s.phase, total_units: s.totalUnits };
  }
}
