import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PayrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  listPeriods() {
    return this.prisma.payrollPeriod.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { createdByUser: { select: { id: true, fullName: true } }, approvedByUser: { select: { id: true, fullName: true } }, _count: { select: { entries: true } } },
    });
  }

  findPeriod(id: string) {
    return this.prisma.payrollPeriod.findUnique({
      where: { id },
      include: { createdByUser: { select: { id: true, fullName: true } }, approvedByUser: { select: { id: true, fullName: true } }, _count: { select: { entries: true } } },
    });
  }

  findPeriodByMonth(year: number, month: number) {
    return this.prisma.payrollPeriod.findUnique({ where: { year_month: { year, month } } });
  }

  totals(periodId: string, employeeWhere: Prisma.EmployeeWhereInput) {
    return this.prisma.payrollEntry.aggregate({
      where: { periodId, employee: employeeWhere },
      _sum: { baseSalary: true, allowances: true, deductions: true, advances: true, netPay: true },
      _count: { _all: true },
    });
  }

  findEntries(args: Prisma.PayrollEntryFindManyArgs) {
    return this.prisma.payrollEntry.findMany({
      ...args,
      include: { employee: { select: { id: true, employeeNo: true, fullName: true, department: { select: { id: true, name: true } } } } },
    });
  }

  countEntries(where: Prisma.PayrollEntryWhereInput) {
    return this.prisma.payrollEntry.count({ where });
  }

  findEntry(id: string) {
    return this.prisma.payrollEntry.findUnique({ where: { id }, include: { period: true, employee: { select: { id: true, departmentId: true } } } });
  }
}
