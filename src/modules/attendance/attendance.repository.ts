import { Injectable } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findEmployeesWithDay(where: Prisma.EmployeeWhereInput, date: Date, skip: number, take: number) {
    return this.prisma.employee.findMany({
      where, skip, take, orderBy: { employeeNo: 'asc' },
      include: { department: { select: { id: true, name: true } }, site: { select: { id: true, name: true } }, attendance: { where: { date } } },
    });
  }

  countEmployees(where: Prisma.EmployeeWhereInput) {
    return this.prisma.employee.count({ where });
  }

  countByStatus(employeeWhere: Prisma.EmployeeWhereInput, date: Date) {
    return this.prisma.attendanceRecord.groupBy({ by: ['status'], where: { date, employee: employeeWhere }, _count: { _all: true } });
  }

  employeeIdsIn(ids: string[], where: Prisma.EmployeeWhereInput) {
    return this.prisma.employee.findMany({ where: { AND: [{ id: { in: ids } }, where] }, select: { id: true } });
  }

  upsertMany(date: Date, records: { employeeId: string; status: AttendanceStatus; checkIn?: string; checkOut?: string; note?: string }[], recordedBy: string) {
    return this.prisma.$transaction(
      records.map((r) =>
        this.prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: r.employeeId, date } },
          update: { status: r.status, checkIn: r.checkIn ?? null, checkOut: r.checkOut ?? null, note: r.note ?? null, recordedBy },
          create: { employeeId: r.employeeId, date, status: r.status, checkIn: r.checkIn, checkOut: r.checkOut, note: r.note, recordedBy },
        }),
      ),
    );
  }
}
