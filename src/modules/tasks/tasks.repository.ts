import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DETAIL_INCLUDE = {
  status: true,
  priority: true,
  department: true,
  project: true,
  creator: true,
  assignee: true,
  reviewer: true,
  parentTask: { select: { id: true, code: true, title: true } },
  additionalAssignees: { include: { user: true } },
  watchers: { include: { user: true } },
  dependenciesFrom: { include: { dependsOn: { select: { id: true, code: true, title: true, status: { select: { name: true } } } } } },
  dependenciesTo: { include: { task: { select: { id: true, code: true, title: true, status: { select: { name: true } } } } } },
  _count: { select: { subtasks: true, comments: true, attachments: true, checklists: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(args: Prisma.TaskFindManyArgs) {
    return this.prisma.task.findMany(args);
  }

  count(where: Prisma.TaskWhereInput) {
    return this.prisma.task.count({ where });
  }

  countAll() {
    return this.prisma.task.count();
  }

  findDetailById(id: string) {
    return this.prisma.task.findFirst({ where: { id, deletedAt: null }, include: DETAIL_INCLUDE });
  }

  findBareById(id: string) {
    return this.prisma.task.findFirst({ where: { id, deletedAt: null } });
  }

  create(data: Prisma.TaskCreateInput) {
    return this.prisma.task.create({ data });
  }

  softDelete(id: string) {
    return this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  findStatusByName(name: string) {
    return this.prisma.taskStatus.findUnique({ where: { name } });
  }

  findStatusById(id: string) {
    return this.prisma.taskStatus.findUnique({ where: { id } });
  }

  findPriorityById(id: string) {
    return this.prisma.taskPriority.findUnique({ where: { id } });
  }

  findUserDepartmentId(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
  }

  hasApprovePermission(roleId: string) {
    return this.prisma.rolePermission.findFirst({ where: { roleId, granted: true, permission: { module: 'tasks', action: 'approve' } } });
  }

  // Watchers
  listWatchers(taskId: string) {
    return this.prisma.taskWatcher.findMany({ where: { taskId }, include: { user: true } });
  }
  addWatcher(taskId: string, userId: string) {
    return this.prisma.taskWatcher.create({ data: { taskId, userId } });
  }
  removeWatcher(taskId: string, userId: string) {
    return this.prisma.taskWatcher.deleteMany({ where: { taskId, userId } });
  }

  // Additional assignees
  listAssignees(taskId: string) {
    return this.prisma.taskAssigneeLink.findMany({ where: { taskId }, include: { user: true } });
  }
  addAssignee(taskId: string, userId: string, assignedBy?: string) {
    return this.prisma.taskAssigneeLink.create({ data: { taskId, userId, assignedBy } });
  }
  removeAssignee(taskId: string, userId: string) {
    return this.prisma.taskAssigneeLink.deleteMany({ where: { taskId, userId } });
  }

  // Dependencies
  addDependency(data: Prisma.TaskDependencyCreateInput) {
    return this.prisma.taskDependency.create({ data });
  }
  removeDependency(id: string) {
    return this.prisma.taskDependency.delete({ where: { id } });
  }

  findSubtasks(parentTaskId: string) {
    return this.prisma.task.findMany({ where: { parentTaskId, deletedAt: null }, include: { status: true, priority: true } });
  }

  findDependenciesFrom(taskId: string) {
    return this.prisma.taskDependency.findMany({ where: { taskId }, include: { dependsOn: { select: { id: true, title: true, status: { select: { name: true } } } } } });
  }

  async findInterestedPartyIds(taskId: string): Promise<string[]> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        creatorId: true, assigneeId: true, reviewerId: true,
        additionalAssignees: { select: { userId: true } },
        watchers: { select: { userId: true } },
      },
    });
    if (!task) return [];
    const ids = [task.creatorId, task.assigneeId, task.reviewerId, ...task.additionalAssignees.map((a) => a.userId), ...task.watchers.map((w) => w.userId)];
    return Array.from(new Set(ids.filter((id): id is string => !!id)));
  }

  /** tasks.proof_required in system settings; absent = required (the safe default). */
  async isProofRequired(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'tasks.proof_required' } });
    return setting ? setting.value !== false : true;
  }

  countProofs(taskId: string) {
    return this.prisma.attachment.count({ where: { taskId, kind: 'proof', deletedAt: null } });
  }
}
