import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  upsert(key: string, value: unknown, updatedBy: string) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value: value as object, updatedBy },
      create: { key, value: value as object, updatedBy },
    });
  }
}
