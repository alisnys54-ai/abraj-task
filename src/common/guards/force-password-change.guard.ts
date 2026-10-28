import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED_KEY } from '../decorators/allow-when-password-change-required.decorator';

/** Server-side first-login enforcement — runs after JwtAuthGuard. If the caller's token carries mustChangePassword=true, every route except the two allow-listed ones is rejected. */
@Injectable()
export class ForcePasswordChangeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const isAllowed = this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isAllowed) return true;

    const request = context.switchToHttp().getRequest();
    if (request.user?.mustChangePassword) {
      throw new ForbiddenException({ code: 'FORCE_PASSWORD_CHANGE', message: 'You must change your password before continuing.' });
    }
    return true;
  }
}
