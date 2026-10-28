import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PortalKey } from '@prisma/client';
import { PortalsRepository } from './portals.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';

export const PORTAL_CATALOG: { key: PortalKey; name: string; description: string }[] = [
  { key: 'company', name: 'بوابة الشركة — أبراج الياسر', description: 'الموارد البشرية والحضور والإجازات والرواتب والمعدات والمشاريع' },
  { key: 'riyasa', name: 'بوابة مجمع الرئاسة السكني', description: 'الوحدات والحجوزات والأقساط وسير العمل والصيانة' },
  { key: 'qudah', name: 'بوابة مجمع القضاة السكني', description: 'موقعا الديوانية وواسط — الوحدات والحجوزات والأقساط' },
  { key: 'tasks', name: 'نظام المهام', description: 'المهام والإثبات والملفات والتقارير' },
];

@Injectable()
export class PortalsService {
  constructor(
    private readonly repo: PortalsRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  /** Every portal, flagged with whether the caller may open it — the portal chooser renders locked cards from this. */
  async forCaller(userId: string, isSystemOwner: boolean) {
    const granted = new Set((await this.repo.findForUser(userId)).map((a) => a.portal));
    return PORTAL_CATALOG.map((p) => ({ ...p, granted: isSystemOwner || granted.has(p.key) }));
  }

  async forUser(userId: string) {
    const user = await this.repo.findUser(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.isSystemOwner) return { user_id: userId, portals: PORTAL_CATALOG.map((p) => p.key), implicit: true };
    return { user_id: userId, portals: (await this.repo.findForUser(userId)).map((a) => a.portal), implicit: false };
  }

  async setForUser(userId: string, portals: PortalKey[], actorId: string) {
    const user = await this.repo.findUser(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.isSystemOwner) {
      throw new ForbiddenException({ code: 'SYSTEM_OWNER_PROTECTED', message: 'The System Owner always has every portal.' });
    }
    await this.repo.replaceForUser(userId, portals, actorId);
    await this.activityLog.record({ actorId, action: 'portal_access_changed', newValue: portals.join(','), details: { user_id: userId } });
    return this.forUser(userId);
  }
}
