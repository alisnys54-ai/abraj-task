import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TASK_REMINDERS_QUEUE } from './scheduler.module';
import { TERMINAL_TASK_STATUSES } from '../../common/constants/task.constants';

interface ReminderJobData {
  taskId: string;
  kind: 'reminder' | 'due' | 'overdue';
}

const EVENT_TYPE = { reminder: 'due_tomorrow', due: 'due_today', overdue: 'overdue' } as const;
const MESSAGE = { reminder: 'Reminder: a task is due soon', due: 'A task is due today', overdue: 'A task is overdue' } as const;

/**
 * Re-verifies the task's current state before sending — a job scheduled
 * hours or days ago must never fire blindly against stale data (the task
 * may since have been completed, archived, deleted, or had its due date
 * moved). This re-check is what makes the whole scheme idempotent and safe
 * under reschedule races.
 */
@Processor(TASK_REMINDERS_QUEUE)
export class TaskRemindersProcessor extends WorkerHost {
  private readonly logger = new Logger('TaskRemindersProcessor');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @InjectQueue(TASK_REMINDERS_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>) {
    const { taskId, kind } = job.data;
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: { status: true, additionalAssignees: true, watchers: true },
    });
    if (!task) return; // deleted since scheduling — nothing to do
    if (TERMINAL_TASK_STATUSES.includes(task.status.name)) return; // completed/rejected/cancelled/archived — stale job, skip

    if (kind === 'overdue') {
      if (!task.dueDate || task.dueDate.getTime() > Date.now()) return; // due date was pushed back since scheduling
      const recipients = [task.assigneeId, task.creatorId, ...task.additionalAssignees.map((a) => a.userId), ...task.watchers.map((w) => w.userId)].filter(
        (v): v is string => !!v,
      );
      await this.notifications.dispatch({ userIds: Array.from(new Set(recipients)), taskId, eventType: EVENT_TYPE.overdue, message: MESSAGE.overdue });
      await this.queue.add('overdue', { taskId, kind: 'overdue' }, { jobId: `${taskId}:overdue`, delay: 24 * 60 * 60 * 1000, removeOnComplete: true, removeOnFail: true });
      return;
    }

    const recipients = [task.assigneeId, task.creatorId].filter((v): v is string => !!v);
    await this.notifications.dispatch({ userIds: recipients, taskId, eventType: EVENT_TYPE[kind], message: MESSAGE[kind] });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ReminderJobData>, error: Error) {
    this.logger.error(`Reminder job ${job.id} failed after ${job.attemptsMade} attempt(s): ${error.message}`);
  }
}
