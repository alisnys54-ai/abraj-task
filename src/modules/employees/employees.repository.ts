import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  site: { select: { id: true, code: true, name: true } },
} satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(args: Prisma.EmployeeFindManyArgs) {
    return this.prisma.employee.findMany({ ...args, include: EMPLOYEE_INCLUDE });
  }

  count(where: Prisma.EmployeeWhereInput) {
    return this.prisma.employee.count({ where });
  }

  findById(id: string) {
    return this.prisma.employee.findUnique({ where: { id }, include: EMPLOYEE_INCLUDE });
  }

  findByNo(employeeNo: string) {
    return this.prisma.employee.findUnique({ where: { employeeNo } });
  }

  findByUserId(userId: string) {
    return this.prisma.employee.findUnique({ where: { userId } });
  }

  /** Highest numeric suffix among AY-#### numbers, for auto-numbering. */
  async maxNumber(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ max: number | null }[]>`SELECT MAX(CAST(SUBSTRING(employee_no FROM 4) AS INTEGER)) AS max FROM employees WHERE employee_no ~ '^AY-[0-9]+$'`;
    return Number(rows[0]?.max ?? 1000);
  }

  create(data: Prisma.EmployeeUncheckedCreateInput) {
    return this.prisma.employee.create({ data, include: EMPLOYEE_INCLUDE });
  }

  update(id: string, data: Prisma.EmployeeUncheckedUpdateInput) {
    return this.prisma.employee.update({ where: { id }, data, include: EMPLOYEE_INCLUDE });
  }
}
