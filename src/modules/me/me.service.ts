import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

/**
 * "Who am I" for the frontend to bootstrap a session after login, and a
 * self-service profile update — deliberately outside the RBAC permission
 * matrix (no @RequirePermission anywhere here) because editing your OWN
 * phone/notification prefs is identity-scoped by construction (always
 * req.user.userId, never a path param), the same pattern already used by
 * Notifications and Saved Filters.
 */
@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { department: true, position: true, userRoles: { include: { role: true }, orderBy: { assignedAt: 'asc' }, take: 1 } },
    });
    if (!user) throw new NotFoundException('User not found');

    const primaryRole = user.userRoles[0]?.role ?? null;
    const permissions = primaryRole
      ? await this.prisma.rolePermission.findMany({ where: { roleId: primaryRole.id, granted: true }, include: { permission: true } })
      : [];

    return {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      phone: user.phone,
      is_system_owner: user.isSystemOwner,
      must_change_password: user.mustChangePassword,
      notification_prefs: user.notificationPrefs,
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
      position: user.position ? { id: user.position.id, title: user.position.title } : null,
      role: primaryRole ? { id: primaryRole.id, name: primaryRole.name } : null,
      // System Owner implicitly has every grant — the frontend's permission
      // check treats is_system_owner as an automatic pass, matching PermissionsGuard.
      permissions: permissions.map((p) => ({ module: p.permission.module, action: p.permission.action, scope: p.scope })),
    };
  }

  async updateProfile(userId: string, dto: UpdateMeDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phone: dto.phone,
        ...(dto.notification_prefs !== undefined ? { notificationPrefs: dto.notification_prefs as object } : {}),
      },
    });
    return this.getProfile(userId);
  }
}
