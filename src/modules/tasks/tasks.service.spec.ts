import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TaskRemindersService } from '../scheduler/task-reminders.service';

/**
 * Unit coverage for the single highest-value piece of business logic in this
 * phase: the task status state machine. Every branch — valid move, invalid
 * move, missing reason on reject, and the approval-permission gate — is
 * exercised without touching a real database.
 */
describe('TasksService — status transitions', () => {
  let service: TasksService;
  let repo: any;
  let prisma: any;

  const statuses: Record<string, { id: string; name: string }> = {
    draft: { id: 's-draft', name: 'draft' },
    pending: { id: 's-pending', name: 'pending' },
    waiting_approval: { id: 's-wa', name: 'waiting_approval' },
    completed: { id: 's-completed', name: 'completed' },
    in_progress: { id: 's-ip', name: 'in_progress' },
    rejected: { id: 's-rejected', name: 'rejected' },
  };

  const baseTask = { id: 't1', statusId: statuses.draft.id, departmentId: 'd1', creatorId: 'u1', assigneeId: null, reviewerId: null };

  const actor = { userId: 'u1', scope: 'all' as const, roleId: 'r1', isSystemOwner: true };

  beforeEach(async () => {
    repo = {
      findBareById: jest.fn().mockResolvedValue(baseTask),
      findStatusById: jest.fn(),
      findDetailById: jest.fn().mockResolvedValue({
        id: 't1', statusId: statuses.draft.id, status: statuses.draft, priority: { id: 'p1', name: 'low' },
        department: { id: 'd1', name: 'Dept' }, creator: { id: 'u1', fullName: 'A' }, assignee: null, reviewer: null,
        parentTask: null, additionalAssignees: [], watchers: [], dependenciesFrom: [], dependenciesTo: [],
        creatorId: 'u1', assigneeId: null, departmentId: 'd1', dueDate: null, startDate: null, reminderDate: null,
        requiresReview: true, tags: [], createdAt: new Date(), updatedAt: new Date(),
        _count: { subtasks: 0, comments: 0, attachments: 0, checklists: 0 },
      }),
      findInterestedPartyIds: jest.fn().mockResolvedValue([]),
      findUserDepartmentId: jest.fn(),
      hasApprovePermission: jest.fn(),
      findDependenciesFrom: jest.fn().mockResolvedValue([]),
      isProofRequired: jest.fn().mockResolvedValue(true),
      countProofs: jest.fn().mockResolvedValue(0),
    };

    prisma = {
      $transaction: jest.fn((cb: any) => cb({ task: { update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, taskStatusHistory: { create: jest.fn() }, activityLog: { create: jest.fn() } })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: TasksRepository, useValue: repo },
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { record: jest.fn(), listForTask: jest.fn() } },
        { provide: NotificationsService, useValue: { dispatch: jest.fn() } },
        { provide: TaskRemindersService, useValue: { rescheduleForTask: jest.fn(), cancelForTask: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  it('allows a valid transition (draft -> pending)', async () => {
    repo.findStatusById = jest.fn().mockResolvedValueOnce(statuses.draft).mockResolvedValueOnce(statuses.pending);
    await expect(service.changeStatus('t1', { to_status_id: statuses.pending.id }, actor)).resolves.toBeDefined();
  });

  it('rejects an invalid transition (draft -> completed)', async () => {
    repo.findStatusById = jest.fn().mockResolvedValueOnce(statuses.draft).mockResolvedValueOnce(statuses.completed);
    await expect(service.changeStatus('t1', { to_status_id: statuses.completed.id }, actor)).rejects.toThrow(ConflictException);
  });

  it('requires a reason to move a task to rejected', async () => {
    repo.findBareById = jest.fn().mockResolvedValue({ ...baseTask, statusId: statuses.waiting_approval.id });
    repo.findStatusById = jest.fn().mockResolvedValueOnce(statuses.waiting_approval).mockResolvedValueOnce(statuses.rejected);
    await expect(service.changeStatus('t1', { to_status_id: statuses.rejected.id }, actor)).rejects.toThrow(BadRequestException);
  });

  it('blocks completing from waiting_approval without tasks:approve', async () => {
    repo.findBareById = jest.fn().mockResolvedValue({ ...baseTask, statusId: statuses.waiting_approval.id });
    repo.findStatusById = jest.fn().mockResolvedValueOnce(statuses.waiting_approval).mockResolvedValueOnce(statuses.completed);
    repo.hasApprovePermission = jest.fn().mockResolvedValue(null);

    const nonOwnerActor = { ...actor, isSystemOwner: false };
    await expect(service.changeStatus('t1', { to_status_id: statuses.completed.id, reason: 'done' }, nonOwnerActor)).rejects.toThrow(ForbiddenException);
  });

  it('allows completing from waiting_approval when the actor holds tasks:approve', async () => {
    repo.findBareById = jest.fn().mockResolvedValue({ ...baseTask, statusId: statuses.waiting_approval.id });
    repo.findStatusById = jest.fn().mockResolvedValueOnce(statuses.waiting_approval).mockResolvedValueOnce(statuses.completed);
    repo.hasApprovePermission = jest.fn().mockResolvedValue({ id: 'grant-1' });

    const nonOwnerActor = { ...actor, isSystemOwner: false };
    await expect(service.changeStatus('t1', { to_status_id: statuses.completed.id, reason: 'done' }, nonOwnerActor)).resolves.toBeDefined();
  });

  describe('completion evidence (proof)', () => {
    beforeEach(() => {
      repo.findBareById = jest.fn().mockResolvedValue({ ...baseTask, statusId: statuses.in_progress.id });
    });

    it('refuses in_progress -> waiting_approval without a proof attachment', async () => {
      repo.findStatusById = jest.fn().mockResolvedValueOnce(statuses.in_progress).mockResolvedValueOnce(statuses.waiting_approval);
      await expect(service.changeStatus('t1', { to_status_id: statuses.waiting_approval.id }, actor)).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows it once a proof is attached', async () => {
      repo.countProofs = jest.fn().mockResolvedValue(1);
      repo.findStatusById = jest.fn().mockResolvedValueOnce(statuses.in_progress).mockResolvedValueOnce(statuses.waiting_approval);
      await expect(service.changeStatus('t1', { to_status_id: statuses.waiting_approval.id }, actor)).resolves.toBeDefined();
    });

    it('does not ask for proof when the company switched the rule off', async () => {
      repo.isProofRequired = jest.fn().mockResolvedValue(false);
      repo.findStatusById = jest.fn().mockResolvedValueOnce(statuses.in_progress).mockResolvedValueOnce(statuses.waiting_approval);
      await expect(service.changeStatus('t1', { to_status_id: statuses.waiting_approval.id }, actor)).resolves.toBeDefined();
    });
  });
});
