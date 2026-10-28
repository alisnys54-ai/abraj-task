import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskCommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTask(taskId: string, skip: number, take: number) {
    return this.prisma.taskComment.findMany({
      where: { taskId, deletedAt: null },
      skip, take,
      orderBy: { createdAt: 'asc' },
      include: { author: true, mentions: true },
    });
  }

  count(taskId: string) {
    return this.prisma.taskComment.count({ where: { taskId, deletedAt: null } });
  }

  findById(id: string) {
    return this.prisma.taskComment.findFirst({ where: { id, deletedAt: null } });
  }

  findByIdWithRelations(id: string) {
    return this.prisma.taskComment.findUnique({ where: { id }, include: { author: true, mentions: true } });
  }

  create(data: Prisma.TaskCommentCreateInput) {
    return this.prisma.taskComment.create({ data });
  }

  update(id: string, data: Prisma.TaskCommentUpdateInput) {
    return this.prisma.taskComment.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.taskComment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  addEditHistory(data: Prisma.TaskCommentEditHistoryCreateInput) {
    return this.prisma.taskCommentEditHistory.create({ data });
  }

  createMentions(commentId: string, userIds: string[]) {
    if (!userIds.length) return Promise.resolve();
    return this.prisma.taskMention.createMany({ data: userIds.map((mentionedUserId) => ({ commentId, mentionedUserId })) });
  }
}
