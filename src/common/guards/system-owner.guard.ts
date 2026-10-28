import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SYSTEM_OWNER_ONLY_KEY } from '../decorators/system-owner-only.decorator';

/** Runs after PermissionsGuard. No permission grant can substitute for this. */
@Injectable()
export class SystemOwnerGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(SYSTEM_OWNER_ONLY_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.user?.isSystemOwner) {
      throw new ForbiddenException({ code: 'SYSTEM_OWNER_PROTECTED', message: 'Only the System Owner may perform this action.' });
    }
    return true;
  }
}
