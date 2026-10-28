import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const LEAVE_INCLUDE = {
  employee: { select: { id: true, employeeNo: true, fullName: true, userId: true, departmentId: true, department: { select: { id: true, name: true } } } },
  requestedByUser: { select: { id: true, fullName: true } },
  decidedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestInclude;

@Injectable()
export class LeavesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(args: Prisma.LeaveRequestFindManyArgs) {
    return this.prisma.leaveRequest.findMany({ ...args, include: LEAVE_INCLUDE });
  }

  count(where: Prisma.LeaveRequestWhereInput) {
    return this.prisma.leaveRequest.count({ where });
  }

  findById(id: string) {
    return this.prisma.leaveRequest.findUnique({ where: { id }, include: LEAVE_INCLUDE });
  }

  findOpenOnDate(employeeId: string, startDate: Date) {
    return this.prisma.leaveRequest.findFirst({ where: { employeeId, startDate, status: { in: ['pending', 'approved'] } } });
  }

  create(data: Prisma.LeaveRequestUncheckedCreateInput) {
    return this.prisma.leaveRequest.create({ data, include: LEAVE_INCLUDE });
  }

  /** Compare-and-swap on status so two approvers can never both decide the same request. */
  updateIfStatus(id: string, fromStatus: Prisma.LeaveRequestWhereInput['status'], data: Prisma.LeaveRequestUncheckedUpdateManyInput) {
    return this.prisma.leaveRequest.updateMany({ where: { id, status: fromStatus }, data });
  }
}
