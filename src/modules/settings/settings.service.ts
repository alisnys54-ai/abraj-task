import { Injectable } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';
import { UpdateCompanySettingDto } from './dto/update-company-setting.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly repo: SettingsRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  async getAll() {
    const rows = await this.repo.findAll();
    const flat: Record<string, unknown> = {};
    for (const r of rows) flat[r.key] = r.value;
    return flat;
  }

  async update(dto: UpdateCompanySettingDto, actorId: string) {
    await this.repo.upsert(dto.key, dto.value, actorId);
    await this.activityLog.record({ actorId, action: 'settings_updated', fieldName: dto.key });
    return this.getAll();
  }
}
