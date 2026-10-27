import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const BOOKING_INCLUDE = {
  unit: { select: { id: true, block: true, number: true, status: true, site: { select: { id: true, code: true, name: true, projectId: true } }, unitType: { select: { code: true, areaM2: true } } } },
  client: { select: { id: true, fullName: true, phone: true } },
  salesRep: { select: { id: true, fullName: true } },
  installments: { select: { id: true, status: true, amount: true, paidAmount: true, dueDate: true }, orderBy: { seq: 'asc' as const } },
} satisfies Prisma.BookingInclude;

export const INSTALLMENT_INCLUDE = {
  booking: { select: { id: true, status: true, salesRepId: true, client: { select: { fullName: true, phone: true } }, unit: { select: { number: true, site: { select: { code: true, name: true, projectId: true } } } } } },
  recordedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.InstallmentInclude;

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(args: Prisma.BookingFindManyArgs) {
    return this.prisma.booking.findMany({ ...args, include: BOOKING_INCLUDE });
  }
  count(where: Prisma.BookingWhereInput) {
    return this.prisma.booking.count({ where });
  }
  findById(id: string) {
    return this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
  }
  findUnitWithType(id: string) {
    return this.prisma.unit.findUnique({ where: { id }, include: { unitType: true, site: true } });
  }
  findInstallments(args: Prisma.InstallmentFindManyArgs) {
    return this.prisma.installment.findMany({ ...args, include: INSTALLMENT_INCLUDE });
  }
  countInstallments(where: Prisma.InstallmentWhereInput) {
    return this.prisma.installment.count({ where });
  }
  findInstallment(id: string) {
    return this.prisma.installment.findUnique({ where: { id }, include: INSTALLMENT_INCLUDE });
  }
}
