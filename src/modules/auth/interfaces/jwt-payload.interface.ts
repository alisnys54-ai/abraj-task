export interface JwtPayload {
  sub: string;
  roleId: string;
  isSystemOwner: boolean;
  mustChangePassword: boolean;
}
