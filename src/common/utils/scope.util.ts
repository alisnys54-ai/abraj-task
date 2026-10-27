import type { PrismaService } from '../../prisma/prisma.service';
import type { PermissionScopeValue } from '../decorators/current-scope.decorator';

/** Who is acting and how far their grant reaches — what every scoped service needs. */
export interface ScopedActor {
  userId: string;
  scope: PermissionScopeValue;
  isSystemOwner: boolean;
}

/** The caller's department; a sentinel that matches nothing if they somehow have none. */
export async function actorDepartmentId(prisma: PrismaService, userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
  return user?.departmentId ?? '00000000-0000-0000-0000-000000000000';
}

/** Today's date at UTC midnight — how @db.Date columns are compared. */
export function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Parses YYYY-MM-DD into a UTC-midnight Date for @db.Date columns. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toDateOnly(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Prisma Decimal → plain number for JSON (IQD amounts fit comfortably in a double). */
export function num(v: { toString(): string } | null | undefined): number | null {
  return v === null || v === undefined ? null : Number(v.toString());
}

/** { id, fullName } → { id, full_name } for API responses. */
export function person(u: { id: string; fullName: string } | null | undefined) {
  return u ? { id: u.id, full_name: u.fullName } : null;
}
