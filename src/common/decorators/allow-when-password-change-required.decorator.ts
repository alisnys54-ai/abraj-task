import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED_KEY = 'allowWhenPasswordChangeRequired';

/** Marks a route as reachable even while the caller's must_change_password flag is set — only /auth/change-password and /auth/logout should ever use this. */
export const AllowWhenPasswordChangeRequired = () => SetMetadata(ALLOW_WHEN_PASSWORD_CHANGE_REQUIRED_KEY, true);
