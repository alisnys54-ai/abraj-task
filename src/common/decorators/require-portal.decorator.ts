import { SetMetadata } from '@nestjs/common';
import { PortalKey } from '@prisma/client';

export const REQUIRE_PORTAL_KEY = 'requirePortal';

/**
 * Either a fixed portal (`'company'`) or `{ fromParam: 'project_key' }`, which
 * resolves the portal from the residential project named in the route. The
 * resolved project is attached to `request.project` for the handler.
 */
export type RequiredPortal = PortalKey | { fromParam: string };

export const RequirePortal = (portal: RequiredPortal) => SetMetadata(REQUIRE_PORTAL_KEY, portal);
