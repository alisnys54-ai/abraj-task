import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PORTAL_KEY, RequiredPortal } from '../decorators/require-portal.decorator';

/**
 * Runs after PermissionsGuard: a permission says WHAT a role may do, portal
 * access says WHERE a person may do it (e.g. a sales officer granted only
 * مجمع الرئاسة cannot read مجمع القضاة bookings even though the role allows
 * bookings). Re-checked from the database on every request.
 */
@Injectable()
export class PortalAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const required = this.reflector.getAllAndOverride<RequiredPortal>(REQUIRE_PORTAL_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    let portal = required;
    if (typeof required === 'object') {
      const key = request.params?.[required.fromParam];
      const project = key ? await this.prisma.residentialProject.findUnique({ where: { key } }) : null;
      if (!project) throw new NotFoundException('Project not found');
      request.project = project;
      // Projects without a portal of their own (القاسم، المعمل…) are run from the company portal.
      portal = project.portal ?? 'company';
    }

    if (user.isSystemOwner) return true;
    // The company portal oversees every project portal; module permissions still decide what can be read or changed.
    const candidates = typeof required === 'object' && portal !== 'company' ? [portal, 'company'] : [portal];
    const access = await this.prisma.userPortalAccess.findFirst({ where: { userId: user.userId, portal: { in: candidates as never[] } } });
    if (!access) {
      throw new ForbiddenException({ code: 'PORTAL_ACCESS_DENIED', message: `You do not have access to the ${String(portal)} portal.` });
    }
    return true;
  }
}
