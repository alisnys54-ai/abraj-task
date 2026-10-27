import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskChecklistsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTask(taskId: string) {
    return this.prisma.taskChecklist.findMany({ where: { taskId }, orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sortOrder: 'asc' } } } });
  }

  findChecklistById(id: string) {
    return this.prisma.taskChecklist.findUnique({ where: { id } });
  }

  createChecklist(data: Prisma.TaskChecklistCreateInput) {
    return this.prisma.taskChecklist.create({ data });
  }

  findItemById(id: string) {
    return this.prisma.checklistItem.findUnique({ where: { id }, include: { checklist: true } });
  }

  createItem(data: Prisma.ChecklistItemCreateInput) {
    return this.prisma.checklistItem.create({ data });
  }

  updateItem(id: string, data: Prisma.ChecklistItemUpdateInput) {
    return this.prisma.checklistItem.update({ where: { id }, data });
  }

  removeItem(id: string) {
    return this.prisma.checklistItem.delete({ where: { id } });
  }

  countItems(taskId: string) {
    return this.prisma.checklistItem.count({ where: { checklist: { taskId } } });
  }

  countDoneItems(taskId: string) {
    return this.prisma.checklistItem.count({ where: { checklist: { taskId }, isDone: true } });
  }
}
