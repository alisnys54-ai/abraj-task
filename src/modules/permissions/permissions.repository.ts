import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  }

  findForRole(roleId: string) {
    return this.prisma.rolePermission.findMany({ where: { roleId }, include: { permission: true } });
  }

  deleteAllForRole(roleId: string) {
    return this.prisma.rolePermission.deleteMany({ where: { roleId } });
  }
}
