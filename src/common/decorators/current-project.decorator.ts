import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ResidentialProject } from '@prisma/client';

/** The residential project PortalAccessGuard resolved from the route's project_key. */
export const CurrentProject = createParamDecorator((_: unknown, ctx: ExecutionContext): ResidentialProject => {
  return ctx.switchToHttp().getRequest().project;
});
