import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TasksRepository } from './tasks.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TaskRemindersService } from '../scheduler/task-reminders.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';
import { TransferTaskDto } from './dto/transfer-task.dto';
import { AddAssigneeDto } from './dto/add-assignee.dto';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { TASK_STATUS_TRANSITIONS, APPROVAL_GATED_TARGETS, TERMINAL_TASK_STATUSES } from '../../common/constants/task.constants';
import type { PermissionScopeValue } from '../../common/decorators/current-scope.decorator';

const SORTABLE_COLUMNS: Record<string, string> = { dueDate: 'dueDate', createdAt: 'createdAt', title: 'title' };

export interface Actor {
  userId: string;
  scope: PermissionScopeValue;
  roleId: string;
  isSystemOwner: boolean;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly repo: TasksRepository,
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly taskReminders: TaskRemindersService,
  ) {}

  async list(query: QueryTasksDto, actor: Actor) {
    const and: Prisma.TaskWhereInput[] = [{ deletedAt: null }];
    await this.applyScope(and, actor);

    if (query.status) and.push({ status: { name: query.status } });
    if (query.priority) and.push({ priority: { name: query.priority } });
    if (query.department_id) and.push({ departmentId: query.department_id });
    if (query.assignee_id) and.push({ assigneeId: query.assignee_id });
    if (query.project_id) and.push({ projectId: query.project_id });
    if (query.parent_task_id !== undefined) and.push({ parentTaskId: query.parent_task_id });
    if (query.due_before) and.push({ dueDate: { lte: new Date(query.due_before) } });
    if (query.due_after) and.push({ dueDate: { gte: new Date(query.due_after) } });
    if (query.tag) and.push({ tags: { has: query.tag } });
    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.overdue) {
      and.push({ dueDate: { lt: new Date() } }, { status: { name: { notIn: TERMINAL_TASK_STATUSES } } });
    }

    const where: Prisma.TaskWhereInput = { AND: and };
    const sortColumn = SORTABLE_COLUMNS[query.sort ?? ''] ?? 'createdAt';
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([
      this.repo.findMany({
        where, skip, take, orderBy: { [sortColumn]: query.order ?? 'desc' },
        include: { status: true, priority: true, assignee: true, _count: { select: { comments: true, attachments: true, checklists: true } } },
      }),
      this.repo.count(where),
    ]);
    return { data: rows.map((t) => this.toSummary(t)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async getById(id: string, actor: Actor) {
    const task = await this.repo.findDetailById(id);
    if (!task) throw new NotFoundException('Task not found');

    if (actor.scope === 'department') {
      const user = await this.repo.findUserDepartmentId(actor.userId);
      if (user?.departmentId !== task.departmentId) throw new NotFoundException('Task not found');
    } else if (actor.scope === 'own') {
      const isInterested =
        task.creatorId === actor.userId ||
        task.assigneeId === actor.userId ||
        task.additionalAssignees.some((a) => a.userId === actor.userId) ||
        task.watchers.some((w) => w.userId === actor.userId);
      if (!isInterested) throw new NotFoundException('Task not found');
    }
    return this.toDetail(task);
  }

  async create(dto: CreateTaskDto, creatorId: string) {
    const status = await this.repo.findStatusByName('draft');
    if (!status) throw new BadRequestException('Task statuses are not seeded — run the seed script');
    const priority = await this.getPriorityOrThrow(dto.priority_id);
    const code = 'T-' + String((await this.repo.countAll()) + 1).padStart(4, '0');

    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          code,
          title: dto.title,
          description: dto.description,
          department: { connect: { id: dto.department_id } },
          project: dto.project_id ? { connect: { id: dto.project_id } } : undefined,
          creator: { connect: { id: creatorId } },
          assignee: dto.assignee_id ? { connect: { id: dto.assignee_id } } : undefined,
          reviewer: dto.reviewer_id ? { connect: { id: dto.reviewer_id } } : undefined,
          status: { connect: { id: status.id } },
          priority: { connect: { id: priority.id } },
          startDate: dto.start_date ? new Date(dto.start_date) : undefined,
          dueDate: dto.due_date ? new Date(dto.due_date) : undefined,
          reminderDate: dto.reminder_date ? new Date(dto.reminder_date) : undefined,
          requiresReview: dto.requires_review ?? true,
          parentTask: dto.parent_task_id ? { connect: { id: dto.parent_task_id } } : undefined,
          tags: dto.tags ?? [],
          createdByUser: { connect: { id: creatorId } },
        },
      });
      await tx.activityLog.create({ data: { taskId: task.id, actorId: creatorId, action: 'task_created' } });
      return task;
    });

    if (dto.assignee_id) {
      await this.notifications.dispatch({ userIds: [dto.assignee_id], taskId: created.id, eventType: 'task_assigned', message: `New task assigned: ${created.title}` });
    }
    await this.taskReminders.scheduleForTask({ id: created.id, reminderDate: created.reminderDate, dueDate: created.dueDate });
    return this.getById(created.id, this.selfActor(creatorId));
  }

  async update(id: string, dto: UpdateTaskDto, actorId: string) {
    const task = await this.repo.findBareById(id);
    if (!task) throw new NotFoundException('Task not found');

    const changes: { field: string; oldValue: string; newValue: string }[] = [];
    const data: Prisma.TaskUpdateInput = { updatedByUser: { connect: { id: actorId } } };

    if (dto.title !== undefined && dto.title !== task.title) { changes.push({ field: 'title', oldValue: task.title, newValue: dto.title }); data.title = dto.title; }
    if (dto.description !== undefined && dto.description !== task.description) { data.description = dto.description; changes.push({ field: 'description', oldValue: task.description ?? '', newValue: dto.description ?? '' }); }
    if (dto.priority_id && dto.priority_id !== task.priorityId) {
      const priority = await this.getPriorityOrThrow(dto.priority_id);
      changes.push({ field: 'priority', oldValue: task.priorityId, newValue: priority.id });
      data.priority = { connect: { id: priority.id } };
    }
    if (dto.due_date !== undefined) { data.dueDate = dto.due_date ? new Date(dto.due_date) : null; changes.push({ field: 'due_date', oldValue: String(task.dueDate ?? ''), newValue: dto.due_date ?? '' }); }
    if (dto.start_date !== undefined) data.startDate = dto.start_date ? new Date(dto.start_date) : null;
    if (dto.reminder_date !== undefined) data.reminderDate = dto.reminder_date ? new Date(dto.reminder_date) : null;
    if (dto.department_id && dto.department_id !== task.departmentId) { changes.push({ field: 'department', oldValue: task.departmentId, newValue: dto.department_id }); data.department = { connect: { id: dto.department_id } }; }
    if (dto.reviewer_id !== undefined) data.reviewer = dto.reviewer_id ? { connect: { id: dto.reviewer_id } } : { disconnect: true };
    if (dto.tags !== undefined) data.tags = dto.tags;

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data });
      for (const c of changes) {
        await tx.activityLog.create({ data: { taskId: id, actorId, action: 'task_updated', fieldName: c.field, oldValue: c.oldValue, newValue: c.newValue } });
      }
    });

    if (dto.due_date !== undefined || dto.reminder_date !== undefined) {
      const fresh = await this.repo.findBareById(id);
      if (fresh) await this.taskReminders.rescheduleForTask({ id, reminderDate: fresh.reminderDate, dueDate: fresh.dueDate });
    }

    return this.getById(id, this.selfActor(actorId));
  }

  /** The core state-machine transition. */
  async changeStatus(id: string, dto: ChangeStatusDto, actor: Actor) {
    const task = await this.repo.findBareById(id);
    if (!task) throw new NotFoundException('Task not found');

    const currentStatus = await this.repo.findStatusById(task.statusId);
    if (!currentStatus) throw new BadRequestException('Task has no valid current status');
    const targetStatus = await this.repo.findStatusById(dto.to_status_id);
    if (!targetStatus) throw new BadRequestException('Target status does not exist');

    const allowedTargets = TASK_STATUS_TRANSITIONS[currentStatus.name] ?? [];
    if (!allowedTargets.includes(targetStatus.name)) {
      throw new ConflictException({ code: 'INVALID_STATUS_TRANSITION', message: `Cannot move task from '${currentStatus.name}' to '${targetStatus.name}'.` });
    }
    if (['in_progress', 'waiting_approval', 'completed'].includes(targetStatus.name)) {
      const blocking = this.computeBlocking(await this.repo.findDependenciesFrom(id));
      if (blocking.is_blocked) {
        throw new ConflictException({ code: 'TASK_BLOCKED', message: `This task is blocked: ${blocking.blocking_reasons.join('; ')}`, details: { blocking_task_ids: blocking.blocking_task_ids } });
      }
    }
    // Completion evidence: submitting for review (or completing straight from in-progress) needs at
    // least one live proof attachment, unless the company switched the rule off in settings.
    if (targetStatus.name === 'waiting_approval' || (targetStatus.name === 'completed' && currentStatus.name === 'in_progress')) {
      if (await this.repo.isProofRequired()) {
        const proofs = await this.repo.countProofs(id);
        if (proofs === 0) {
          throw new UnprocessableEntityException({ code: 'PROOF_REQUIRED', message: 'Attach a completion photo or scanned document (kind=proof) before sending this task for review.' });
        }
      }
    }
    if ((targetStatus.name === 'rejected' || targetStatus.name === 'cancelled') && !dto.reason) {
      throw new BadRequestException('A reason is required to reject or cancel a task');
    }
    if (currentStatus.name === 'waiting_approval' && APPROVAL_GATED_TARGETS.includes(targetStatus.name) && !actor.isSystemOwner) {
      const grant = await this.repo.hasApprovePermission(actor.roleId);
      if (!grant) throw new ForbiddenException('Only an approver may move a task out of Waiting Approval into Completed or Rejected');
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.task.updateMany({
        where: { id, statusId: currentStatus.id },
        data: { statusId: targetStatus.id, updatedBy: actor.userId },
      });
      // Compare-and-swap: if another request already moved this task's status since we
      // read it above, updateMany matches 0 rows — we fail loudly instead of silently
      // double-applying a transition or clobbering a concurrent, possibly conflicting one.
      if (result.count === 0) {
        throw new ConflictException({ code: 'CONCURRENT_STATUS_CHANGE', message: 'This task\'s status was changed by someone else — reload and try again.' });
      }
      await tx.taskStatusHistory.create({ data: { taskId: id, fromStatusId: currentStatus.id, toStatusId: targetStatus.id, changedBy: actor.userId, reason: dto.reason } });
      await tx.activityLog.create({ data: { taskId: id, actorId: actor.userId, action: 'status_changed', fieldName: 'status', oldValue: currentStatus.name, newValue: targetStatus.name } });
    });

    const interested = await this.repo.findInterestedPartyIds(id);
    const eventType = targetStatus.name === 'completed' ? 'task_completed' : targetStatus.name === 'rejected' ? 'task_rejected' : 'status_changed';
    await this.notifications.dispatch({ userIds: interested.filter((u) => u !== actor.userId), taskId: id, eventType, message: `Task status changed to ${targetStatus.name}` });

    if (targetStatus.name === 'waiting_approval' && task.reviewerId) {
      await this.notifications.dispatch({ userIds: [task.reviewerId], taskId: id, eventType: 'status_changed', message: 'A task is awaiting your approval' });
    }

    if (TERMINAL_TASK_STATUSES.includes(targetStatus.name)) {
      await this.taskReminders.cancelForTask(id);
    }

    return this.getById(id, actor);
  }

  async reassign(id: string, dto: ReassignTaskDto, actorId: string) {
    const task = await this.repo.findBareById(id);
    if (!task) throw new NotFoundException('Task not found');

    await this.prisma.$transaction(async (tx) => {
      if (task.assigneeId) {
        await tx.taskAssignment.updateMany({ where: { taskId: id, assignedTo: task.assigneeId, unassignedAt: null }, data: { unassignedAt: new Date() } });
      }
      await tx.task.update({ where: { id }, data: { assignee: { connect: { id: dto.assignee_id } }, updatedByUser: { connect: { id: actorId } } } });
      await tx.taskAssignment.create({ data: { taskId: id, assignedTo: dto.assignee_id, assignedBy: actorId, reason: dto.reason } });
      await tx.activityLog.create({ data: { taskId: id, actorId, action: 'assignee_changed', oldValue: task.assigneeId ?? '', newValue: dto.assignee_id } });
    });

    await this.notifications.dispatch({ userIds: [dto.assignee_id], taskId: id, eventType: 'task_assigned', message: 'A task was reassigned to you' });
    return this.getById(id, this.selfActor(actorId));
  }

  /** Moves department and/or primary assignee as one deliberate ownership change — logged distinctly from a plain reassign. */
  async transferOwnership(id: string, dto: TransferTaskDto, actorId: string) {
    const task = await this.repo.findBareById(id);
    if (!task) throw new NotFoundException('Task not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: {
          department: dto.department_id ? { connect: { id: dto.department_id } } : undefined,
          assignee: dto.assignee_id ? { connect: { id: dto.assignee_id } } : undefined,
          updatedByUser: { connect: { id: actorId } },
        },
      });
      await tx.activityLog.create({ data: { taskId: id, actorId, action: 'ownership_transferred', oldValue: task.departmentId, newValue: dto.department_id ?? task.departmentId } });
    });
    return this.getById(id, this.selfActor(actorId));
  }

  async remove(id: string) {
    const task = await this.repo.findBareById(id);
    if (!task) throw new NotFoundException('Task not found');
    await this.repo.softDelete(id);
    await this.taskReminders.cancelForTask(id);
  }

  async duplicate(id: string, actorId: string) {
    const source = await this.repo.findBareById(id);
    if (!source) throw new NotFoundException('Task not found');
    const draftStatus = await this.repo.findStatusByName('draft');
    const code = 'T-' + String((await this.repo.countAll()) + 1).padStart(4, '0');

    const created = await this.repo.create({
      code,
      title: `${source.title} (copy)`,
      description: source.description,
      department: { connect: { id: source.departmentId } },
      creator: { connect: { id: actorId } },
      status: { connect: { id: draftStatus!.id } },
      priority: { connect: { id: source.priorityId } },
      requiresReview: source.requiresReview,
      createdByUser: { connect: { id: actorId } },
    });
    await this.activityLog.record({ taskId: created.id, actorId, action: 'task_created', details: { duplicated_from: source.id } });
    return this.getById(created.id, this.selfActor(actorId));
  }

  async listSubtasks(id: string) {
    const rows = await this.repo.findSubtasks(id);
    return rows.map((t) => this.toSummary(t));
  }

  async getHistory(id: string, page: number, pageSize: number) {
    const { skip } = paginationSkipTake(page, pageSize);
    const { rows, total } = await this.activityLog.listForTask(id, skip, pageSize);
    return { data: rows, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async listWatchers(id: string) {
    const rows = await this.repo.listWatchers(id);
    return rows.map((w) => ({ user_id: w.userId, full_name: w.user.fullName }));
  }
  async addWatcher(id: string, userId: string) {
    try {
      await this.repo.addWatcher(id, userId);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Already watching this task');
      throw e;
    }
  }
  async removeWatcher(id: string, userId: string) {
    await this.repo.removeWatcher(id, userId);
  }

  async listAssignees(id: string) {
    const rows = await this.repo.listAssignees(id);
    return rows.map((a) => ({ user_id: a.userId, full_name: a.user.fullName }));
  }
  async addAssignee(id: string, dto: AddAssigneeDto, actorId: string) {
    try {
      await this.repo.addAssignee(id, dto.user_id, actorId);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('User is already assigned to this task');
      throw e;
    }
    await this.notifications.dispatch({ userIds: [dto.user_id], taskId: id, eventType: 'task_assigned', message: 'You were added as a collaborator on a task' });
  }
  async removeAssignee(id: string, userId: string) {
    await this.repo.removeAssignee(id, userId);
  }

  async addDependency(id: string, dto: AddDependencyDto) {
    if (id === dto.depends_on_task_id) throw new BadRequestException('A task cannot depend on itself');
    const target = await this.repo.findBareById(dto.depends_on_task_id);
    if (!target) throw new NotFoundException('Dependency target task not found');
    try {
      await this.repo.addDependency({ task: { connect: { id } }, dependsOn: { connect: { id: dto.depends_on_task_id } }, type: dto.type });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('This dependency already exists');
      throw e;
    }
  }
  async removeDependency(dependencyId: string) {
    await this.repo.removeDependency(dependencyId);
  }

  /** Used by Attachments/Comments to know who to notify without duplicating the "who cares about this task" query. */
  async getInterestedUserIds(taskId: string) {
    return this.repo.findInterestedPartyIds(taskId);
  }

  private selfActor(userId: string): Actor {
    return { userId, scope: 'all', roleId: '', isSystemOwner: true };
  }

  /** finish_to_start blocks any progress until the predecessor is done; start_to_start blocks until the predecessor has at least started. finish_to_finish/start_to_finish are checked separately, only when the target is 'completed'. */
  private computeBlocking(dependenciesFrom: { type: string; dependsOn: { id: string; title: string; status: { name: string } } }[]) {
    const blockingTaskIds: string[] = [];
    const reasons: string[] = [];
    for (const dep of dependenciesFrom) {
      const predStatus = dep.dependsOn.status.name;
      if (dep.type === 'finish_to_start' && !TERMINAL_TASK_STATUSES.includes(predStatus)) {
        blockingTaskIds.push(dep.dependsOn.id);
        reasons.push(`Waiting for '${dep.dependsOn.title}' to finish (finish-to-start)`);
      } else if (dep.type === 'start_to_start' && ['draft', 'pending'].includes(predStatus)) {
        blockingTaskIds.push(dep.dependsOn.id);
        reasons.push(`Waiting for '${dep.dependsOn.title}' to start (start-to-start)`);
      } else if (dep.type === 'finish_to_finish' && predStatus !== 'completed') {
        blockingTaskIds.push(dep.dependsOn.id);
        reasons.push(`Cannot complete before '${dep.dependsOn.title}' completes (finish-to-finish)`);
      } else if (dep.type === 'start_to_finish' && ['draft', 'pending'].includes(predStatus)) {
        blockingTaskIds.push(dep.dependsOn.id);
        reasons.push(`Cannot complete before '${dep.dependsOn.title}' starts (start-to-finish)`);
      }
    }
    return { is_blocked: blockingTaskIds.length > 0, blocking_task_ids: Array.from(new Set(blockingTaskIds)), blocking_reasons: reasons };
  }

  private async getPriorityOrThrow(id: string) {
    const priority = await this.repo.findPriorityById(id);
    if (!priority) throw new BadRequestException('Invalid priority');
    return priority;
  }

  private async applyScope(and: Prisma.TaskWhereInput[], actor: Actor) {
    if (actor.scope === 'all') return;
    if (actor.scope === 'department') {
      const user = await this.repo.findUserDepartmentId(actor.userId);
      and.push({ departmentId: user?.departmentId ?? '__none__' });
      return;
    }
    and.push({
      OR: [
        { creatorId: actor.userId },
        { assigneeId: actor.userId },
        { additionalAssignees: { some: { userId: actor.userId } } },
        { watchers: { some: { userId: actor.userId } } },
      ],
    });
  }

  private isOverdue(dueDate: Date | null, statusName: string) {
    return !!dueDate && dueDate.getTime() < Date.now() && !TERMINAL_TASK_STATUSES.includes(statusName);
  }

  private toSummary(t: any) {
    return {
      id: t.id, code: t.code, title: t.title,
      status: t.status ? { id: t.status.id, name: t.status.name } : undefined,
      priority: t.priority ? { id: t.priority.id, name: t.priority.name } : undefined,
      department_id: t.departmentId,
      assignee: t.assignee ? { id: t.assignee.id, full_name: t.assignee.fullName } : null,
      due_date: t.dueDate,
      is_overdue: t.status ? this.isOverdue(t.dueDate, t.status.name) : false,
      comment_count: t._count?.comments ?? 0,
      attachment_count: t._count?.attachments ?? 0,
      checklist_count: t._count?.checklists ?? 0,
      created_at: t.createdAt,
    };
  }

  private toDetail(t: any) {
    return {
      id: t.id, code: t.code, title: t.title, description: t.description,
      status: { id: t.status.id, name: t.status.name },
      priority: { id: t.priority.id, name: t.priority.name },
      department: { id: t.department.id, name: t.department.name },
      project: t.project ? { id: t.project.id, name: t.project.name } : null,
      creator: { id: t.creator.id, full_name: t.creator.fullName },
      assignee: t.assignee ? { id: t.assignee.id, full_name: t.assignee.fullName } : null,
      reviewer: t.reviewer ? { id: t.reviewer.id, full_name: t.reviewer.fullName } : null,
      parent_task: t.parentTask,
      additional_assignees: t.additionalAssignees.map((a: any) => ({ user_id: a.userId, full_name: a.user.fullName })),
      watchers: t.watchers.map((w: any) => ({ user_id: w.userId, full_name: w.user.fullName })),
      dependencies_from: t.dependenciesFrom.map((d: any) => ({ id: d.id, type: d.type, depends_on: d.dependsOn })),
      dependencies_to: t.dependenciesTo.map((d: any) => ({ id: d.id, type: d.type, task: d.task })),
      ...this.computeBlocking(t.dependenciesFrom),
      start_date: t.startDate, due_date: t.dueDate, reminder_date: t.reminderDate,
      is_overdue: this.isOverdue(t.dueDate, t.status.name),
      requires_review: t.requiresReview,
      tags: t.tags,
      subtask_count: t._count.subtasks, comment_count: t._count.comments, attachment_count: t._count.attachments, checklist_count: t._count.checklists,
      created_at: t.createdAt, updated_at: t.updatedAt,
    };
  }
}
