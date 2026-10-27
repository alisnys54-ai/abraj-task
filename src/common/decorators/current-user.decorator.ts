import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  userId: string;
  roleId: string;
  isSystemOwner: boolean;
  mustChangePassword: boolean;
}

export const CurrentUser = createParamDecorator((data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as CurrentUserPayload;
  return data ? user?.[data] : user;
});
