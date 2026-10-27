import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskChecklistsRepository } from './task-checklists.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@Injectable()
export class TaskChecklistsService {
  constructor(
    private readonly repo: TaskChecklistsRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  /** Unlimited checklist groups/items — enforced by nothing but the FK, per design. Progress is computed live, never stored. */
  async list(taskId: string) {
    const [checklists, total, done] = await Promise.all([
      this.repo.findByTask(taskId),
      this.repo.countItems(taskId),
      this.repo.countDoneItems(taskId),
    ]);
    return {
      progress_percent: total ? Math.round((done / total) * 100) : 0,
      checklists: checklists.map((c) => ({
        id: c.id,
        title: c.title,
        sort_order: c.sortOrder,
        items: c.items.map((i) => ({ id: i.id, text: i.text, is_done: i.isDone, sort_order: i.sortOrder })),
      })),
    };
  }

  createChecklist(taskId: string, dto: CreateChecklistDto) {
    return this.repo.createChecklist({ task: { connect: { id: taskId } }, title: dto.title ?? 'Checklist' });
  }

  async createItem(checklistId: string, dto: CreateChecklistItemDto, actorId: string) {
    const checklist = await this.repo.findChecklistById(checklistId);
    if (!checklist) throw new NotFoundException('Checklist not found');
    const created = await this.repo.createItem({ checklist: { connect: { id: checklistId } }, text: dto.text });
    await this.activityLog.record({ taskId: checklist.taskId, actorId, action: 'checklist_item_added', newValue: dto.text });
    return created;
  }

  async updateItem(itemId: string, dto: UpdateChecklistItemDto, actorId: string) {
    const item = await this.repo.findItemById(itemId);
    if (!item) throw new NotFoundException('Checklist item not found');

    const wasDone = item.isDone;
    const togglingDone = dto.is_done !== undefined && dto.is_done !== wasDone;
    const updated = await this.repo.updateItem(itemId, {
      text: dto.text,
      isDone: dto.is_done,
      sortOrder: dto.sort_order,
      ...(togglingDone ? { completedByUser: dto.is_done ? { connect: { id: actorId } } : { disconnect: true }, completedAt: dto.is_done ? new Date() : null } : {}),
    });

    if (togglingDone) {
      await this.activityLog.record({
        taskId: item.checklist.taskId, actorId, action: 'checklist_item_toggled',
        fieldName: item.text, oldValue: String(wasDone), newValue: String(dto.is_done),
      });
    }
    return updated;
  }

  async removeItem(itemId: string) {
    const item = await this.repo.findItemById(itemId);
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.repo.removeItem(itemId);
  }
}
