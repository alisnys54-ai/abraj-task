import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const REPORT_INCLUDE = { site: { select: { code: true, name: true } }, engineer: { select: { id: true, fullName: true } } } satisfies Prisma.SiteDailyReportInclude;
export const TICKET_INCLUDE = {
  site: { select: { code: true, name: true } },
  unit: { select: { id: true, number: true } },
  client: { select: { id: true, fullName: true, phone: true } },
  assignee: { select: { id: true, fullName: true } },
  createdByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.MaintenanceTicketInclude;

@Injectable()
export class SiteOperationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSite(projectId: string, code: string) {
    return this.prisma.projectSite.findFirst({ where: { projectId, code } });
  }
  findReports(args: Prisma.SiteDailyReportFindManyArgs) {
    return this.prisma.siteDailyReport.findMany({ ...args, include: REPORT_INCLUDE });
  }
  countReports(where: Prisma.SiteDailyReportWhereInput) {
    return this.prisma.siteDailyReport.count({ where });
  }
  findReportFor(siteId: string, engineerId: string, reportDate: Date) {
    return this.prisma.siteDailyReport.findFirst({ where: { siteId, engineerId, reportDate } });
  }
  createReport(data: Prisma.SiteDailyReportUncheckedCreateInput) {
    return this.prisma.siteDailyReport.create({ data, include: REPORT_INCLUDE });
  }
  findTickets(args: Prisma.MaintenanceTicketFindManyArgs) {
    return this.prisma.maintenanceTicket.findMany({ ...args, include: TICKET_INCLUDE });
  }
  countTickets(where: Prisma.MaintenanceTicketWhereInput) {
    return this.prisma.maintenanceTicket.count({ where });
  }
  findTicket(id: string) {
    return this.prisma.maintenanceTicket.findUnique({ where: { id }, include: { ...TICKET_INCLUDE, site: { select: { code: true, name: true, projectId: true } } } });
  }
  findUnit(id: string) {
    return this.prisma.unit.findUnique({ where: { id }, select: { id: true, siteId: true } });
  }
  async nextTicketCode() {
    const rows = await this.prisma.$queryRaw<{ max: number | null }[]>`SELECT MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)) AS max FROM maintenance_tickets WHERE code ~ '^MT-[0-9]+$'`;
    return `MT-${String(Number(rows[0]?.max ?? 0) + 1).padStart(4, '0')}`;
  }
  createTicket(data: Prisma.MaintenanceTicketUncheckedCreateInput) {
    return this.prisma.maintenanceTicket.create({ data, include: TICKET_INCLUDE });
  }
  updateTicket(id: string, data: Prisma.MaintenanceTicketUncheckedUpdateInput) {
    return this.prisma.maintenanceTicket.update({ where: { id }, data, include: TICKET_INCLUDE });
  }
}
