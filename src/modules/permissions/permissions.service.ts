import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsRepository } from './permissions.repository';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly repo: PermissionsRepository,
    private readonly prisma: PrismaService,
  ) {}

  listCatalog() {
    return this.repo.findAll();
  }

  async getForRole(roleId: string) {
    const rows = await this.repo.findForRole(roleId);
    return rows.map((r) => ({
      permission: { module: r.permission.module, action: r.permission.action },
      scope: r.scope,
      granted: r.granted,
    }));
  }

  /**
   * Replaces a role's entire permission matrix. Enforces the one self-lockout
   * rule from the approved security model: the System Owner's own role can
   * never have roles-permissions:manage revoked from it.
   */
  async replaceForRole(roleId: string, dto: UpdateRolePermissionsDto, actor: { roleId: string; isSystemOwner: boolean }) {
    if (actor.isSystemOwner && actor.roleId === roleId) {
      const catalog = await this.repo.findAll();
      const byId = new Map(catalog.map((p) => [p.id, p]));
      const droppingOwnManage = dto.permissions.some((p) => {
        const perm = byId.get(p.permission_id);
        return !p.granted && perm?.module === 'roles-permissions' && perm.action === 'manage';
      });
      if (droppingOwnManage) {
        throw new ForbiddenException('Cannot remove your own roles-permissions:manage permission');
      }
    }

    await this.prisma.$transaction([
      this.repo.deleteAllForRole(roleId),
      this.prisma.rolePermission.createMany({
        data: dto.permissions.map((p) => ({ roleId, permissionId: p.permission_id, scope: p.scope, granted: p.granted })),
      }),
    ]);
  }
}
