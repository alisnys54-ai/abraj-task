import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const INCLUDE = { department: { select: { id: true, name: true } }, publishedByUser: { select: { id: true, fullName: true } } } satisfies Prisma.AnnouncementInclude;

@Injectable()
export class AnnouncementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(args: Prisma.AnnouncementFindManyArgs) {
    return this.prisma.announcement.findMany({ ...args, include: INCLUDE });
  }

  count(where: Prisma.AnnouncementWhereInput) {
    return this.prisma.announcement.count({ where });
  }

  findById(id: string) {
    return this.prisma.announcement.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
  }

  create(data: Prisma.AnnouncementUncheckedCreateInput) {
    return this.prisma.announcement.create({ data, include: INCLUDE });
  }

  softDelete(id: string) {
    return this.prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
