import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TASK_REMINDERS_QUEUE } from './scheduler.module';

export type ReminderKind = 'reminder' | 'due' | 'overdue';

interface SchedulableTask {
  id: string;
  reminderDate?: Date | null;
  dueDate?: Date | null;
}

/**
 * Public API other modules use to keep a task's reminder/due/overdue jobs in
 * sync with its current dates and lifecycle. Every job uses a deterministic
 * jobId (`${taskId}:${kind}`), so scheduling is idempotent — rescheduling is
 * always remove-then-add, never an accumulation of stale duplicate jobs.
 */
@Injectable()
export class TaskRemindersService {
  constructor(@InjectQueue(TASK_REMINDERS_QUEUE) private readonly queue: Queue) {}

  async scheduleForTask(task: SchedulableTask) {
    await this.cancelForTask(task.id);
    const now = Date.now();

    if (task.reminderDate && task.reminderDate.getTime() > now) {
      await this.queue.add('reminder', { taskId: task.id, kind: 'reminder' }, {
        jobId: `${task.id}:reminder`, delay: task.reminderDate.getTime() - now, removeOnComplete: true, removeOnFail: true,
      });
    }
    if (task.dueDate) {
      if (task.dueDate.getTime() > now) {
        await this.queue.add('due', { taskId: task.id, kind: 'due' }, {
          jobId: `${task.id}:due`, delay: task.dueDate.getTime() - now, removeOnComplete: true, removeOnFail: true,
        });
      }
      // First overdue nudge fires the instant the due date passes; the processor requeues the next one daily while still overdue.
      await this.queue.add('overdue', { taskId: task.id, kind: 'overdue' }, {
        jobId: `${task.id}:overdue`, delay: Math.max(task.dueDate.getTime() - now, 0), removeOnComplete: true, removeOnFail: true,
      });
    }
  }

  /** Called whenever a task's dates change — remove-then-add makes this safe to call unconditionally. */
  rescheduleForTask(task: SchedulableTask) {
    return this.scheduleForTask(task);
  }

  /** Called on completion, archival, cancellation, rejection, or deletion — no reminder should ever fire for a task that's done. */
  async cancelForTask(taskId: string) {
    for (const kind of ['reminder', 'due', 'overdue'] as const) {
      const job = await this.queue.getJob(`${taskId}:${kind}`);
      if (job) await job.remove();
    }
  }
}
