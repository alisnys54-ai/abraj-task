import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(data: Prisma.NotificationCreateManyInput[]) {
    return this.prisma.notification.createMany({ data });
  }

  findMany(args: Prisma.NotificationFindManyArgs) {
    return this.prisma.notification.findMany(args);
  }

  count(where: Prisma.NotificationWhereInput) {
    return this.prisma.notification.count({ where });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  findOwned(id: string, userId: string) {
    return this.prisma.notification.findFirst({ where: { id, userId } });
  }

  markRead(id: string, isRead: boolean) {
    return this.prisma.notification.update({ where: { id }, data: { isRead, readAt: isRead ? new Date() : null } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
  }

  remove(id: string) {
    return this.prisma.notification.delete({ where: { id } });
  }
}
