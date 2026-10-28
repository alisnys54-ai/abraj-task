import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listProjects(where: Prisma.ResidentialProjectWhereInput) {
    return this.prisma.residentialProject.findMany({ where, orderBy: { createdAt: 'asc' }, include: { sites: { orderBy: { code: 'asc' } } } });
  }

  findProject(id: string) {
    return this.prisma.residentialProject.findUnique({ where: { id }, include: { sites: { orderBy: { code: 'asc' }, include: { unitTypes: { orderBy: { code: 'asc' } } } } } });
  }

  portalsOf(userId: string) {
    return this.prisma.userPortalAccess.findMany({ where: { userId }, select: { portal: true } });
  }

  findSite(projectId: string, code: string) {
    return this.prisma.projectSite.findFirst({ where: { projectId, code } });
  }

  unitsByStatus(siteId: string) {
    return this.prisma.unit.groupBy({ by: ['status'], where: { siteId }, _count: { _all: true } });
  }

  bookingsSince(siteId: string, since: Date) {
    return this.prisma.booking.count({ where: { unit: { siteId }, status: { not: 'cancelled' }, bookingDate: { gte: since } } });
  }

  overdueInstallments(siteId: string, today: Date) {
    return this.prisma.installment.aggregate({ where: { status: 'due', dueDate: { lt: today }, booking: { status: { not: 'cancelled' }, unit: { siteId } } }, _count: { _all: true }, _sum: { amount: true } });
  }

  /** Collected IQD per month for the last `months` months — the collections chart. */
  collectionsByMonth(siteId: string, since: Date) {
    return this.prisma.$queryRaw<{ month: string; total: Prisma.Decimal }[]>`
      SELECT to_char(i.paid_at, 'YYYY-MM') AS month, SUM(i.paid_amount) AS total
      FROM installments i JOIN bookings b ON b.id = i.booking_id JOIN units u ON u.id = b.unit_id
      WHERE u.site_id = ${siteId}::uuid AND i.status = 'paid' AND i.paid_at >= ${since}
      GROUP BY 1 ORDER BY 1`;
  }

  findUnits(args: Prisma.UnitFindManyArgs) {
    return this.prisma.unit.findMany({
      ...args,
      include: {
        unitType: { select: { code: true, areaM2: true, price: true, currency: true } },
        site: { select: { code: true, name: true } },
        bookings: { where: { status: { not: 'cancelled' } }, select: { id: true, status: true, client: { select: { fullName: true } } }, take: 1 },
      },
    });
  }

  countUnits(where: Prisma.UnitWhereInput) {
    return this.prisma.unit.count({ where });
  }

  findUnit(id: string) {
    return this.prisma.unit.findUnique({ where: { id }, include: { site: true } });
  }

  setUnitStatusIf(id: string, from: Prisma.UnitWhereInput['status'], to: 'available' | 'under_construction') {
    return this.prisma.unit.updateMany({ where: { id, status: from }, data: { status: to } });
  }

}
