import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type PermissionScopeValue = 'all' | 'department' | 'own';

/** Reads the scope PermissionsGuard resolved for this request (attached to req.permissionScope) — the caller's data-visibility boundary, re-derived server-side every request. */
export const CurrentScope = createParamDecorator((_: unknown, ctx: ExecutionContext): PermissionScopeValue => {
  const request = ctx.switchToHttp().getRequest();
  return request.permissionScope ?? 'own';
});
