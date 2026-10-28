import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ScopedActor } from '../utils/scope.util';

/** The caller plus the scope PermissionsGuard resolved for this route — one object for scoped services. */
export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): ScopedActor => {
  const request = ctx.switchToHttp().getRequest();
  return { userId: request.user.userId, scope: request.permissionScope ?? 'own', isSystemOwner: !!request.user.isSystemOwner };
});
