import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(args: Prisma.DepartmentFindManyArgs) {
    return this.prisma.department.findMany(args);
  }

  count(where: Prisma.DepartmentWhereInput) {
    return this.prisma.department.count({ where });
  }

  findAllActive() {
    return this.prisma.department.findMany({ where: { deletedAt: null } });
  }

  findById(id: string) {
    return this.prisma.department.findFirst({ where: { id, deletedAt: null } });
  }

  findByName(name: string) {
    return this.prisma.department.findFirst({ where: { name, deletedAt: null } });
  }

  create(data: Prisma.DepartmentCreateInput) {
    return this.prisma.department.create({ data });
  }

  update(id: string, data: Prisma.DepartmentUpdateInput) {
    return this.prisma.department.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.department.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  countChildren(id: string) {
    return this.prisma.department.count({ where: { parentDepartmentId: id, deletedAt: null } });
  }

  countActiveUsers(id: string) {
    return this.prisma.user.count({ where: { departmentId: id, deletedAt: null } });
  }

  countActiveTasks(id: string) {
    return this.prisma.task.count({
      where: { departmentId: id, deletedAt: null, status: { name: { notIn: ['completed', 'rejected', 'cancelled'] } } },
    });
  }

  employeeCountByDepartment() {
    return this.prisma.user.groupBy({ by: ['departmentId'], where: { deletedAt: null }, _count: { _all: true } });
  }

  positionCountByDepartment() {
    return this.prisma.position.groupBy({ by: ['departmentId'], where: { isArchived: false }, _count: { _all: true } });
  }

  listManagers(departmentId: string) {
    return this.prisma.departmentManager.findMany({ where: { departmentId }, include: { user: true } });
  }

  managersByDepartment() {
    return this.prisma.departmentManager.findMany({ include: { user: true } });
  }

  addManager(departmentId: string, userId: string, assignedBy?: string) {
    return this.prisma.departmentManager.create({ data: { departmentId, userId, assignedBy } });
  }

  removeManager(departmentId: string, userId: string) {
    return this.prisma.departmentManager.deleteMany({ where: { departmentId, userId } });
  }
}
