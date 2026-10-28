import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SavedFiltersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUser(userId: string) {
    return this.prisma.savedFilter.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  findOwned(id: string, userId: string) {
    return this.prisma.savedFilter.findFirst({ where: { id, userId, deletedAt: null } });
  }

  create(data: Prisma.SavedFilterCreateInput) {
    return this.prisma.savedFilter.create({ data });
  }

  update(id: string, data: Prisma.SavedFilterUpdateInput) {
    return this.prisma.savedFilter.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.savedFilter.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
