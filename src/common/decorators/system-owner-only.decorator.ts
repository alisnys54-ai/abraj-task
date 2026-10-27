import { SetMetadata } from '@nestjs/common';

export const SYSTEM_OWNER_ONLY_KEY = 'systemOwnerOnly';

/** Final authority — no permission grant can substitute for this. */
export const SystemOwnerOnly = () => SetMetadata(SYSTEM_OWNER_ONLY_KEY, true);
