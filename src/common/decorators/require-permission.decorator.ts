import { SetMetadata } from '@nestjs/common';
import { PermissionAction, PermissionModule } from '../constants/permission.constants';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

export interface RequiredPermission {
  module: PermissionModule;
  action: PermissionAction;
}

export const RequirePermission = (module: PermissionModule, action: PermissionAction) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { module, action } as RequiredPermission);
