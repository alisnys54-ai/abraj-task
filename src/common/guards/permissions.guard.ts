import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';

/**
 * Re-derives the caller's granted permission from the database on every
 * request — never trusts anything beyond roleId/isSystemOwner cached in the
 * JWT. Also attaches the resolved scope (all/department/own) to the request
 * so Services can build their Prisma `where` clause directly from it.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<RequiredPermission>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true; // no @RequirePermission on this route — authentication alone is enough

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (user.isSystemOwner) {
      request.permissionScope = 'all';
      return true;
    }

    const grant = await this.prisma.rolePermission.findFirst({
      where: { roleId: user.roleId, granted: true, permission: { module: required.module, action: required.action } },
    });

    if (!grant) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: `Missing permission: ${required.module}:${required.action}` });
    }

    request.permissionScope = grant.scope;
    return true;
  }
}
