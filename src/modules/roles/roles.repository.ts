import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(args: Prisma.RoleFindManyArgs) {
    return this.prisma.role.findMany(args);
  }

  findById(id: string) {
    return this.prisma.role.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.prisma.role.findUnique({ where: { name } });
  }

  create(data: Prisma.RoleCreateInput) {
    return this.prisma.role.create({ data });
  }

  update(id: string, data: Prisma.RoleUpdateInput) {
    return this.prisma.role.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }

  countUsers(roleId: string) {
    return this.prisma.userRole.count({ where: { roleId } });
  }

  listUsers(roleId: string, skip: number, take: number) {
    return this.prisma.userRole.findMany({ where: { roleId }, skip, take, include: { user: true } });
  }

  assignRole(userId: string, roleId: string, assignedBy?: string) {
    return this.prisma.userRole.create({ data: { userId, roleId, assignedBy } });
  }

  removeRole(userId: string, roleId: string) {
    return this.prisma.userRole.deleteMany({ where: { userId, roleId } });
  }

  countUserRoles(userId: string) {
    return this.prisma.userRole.count({ where: { userId } });
  }
}
