export const TASK_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['in_progress', 'on_hold', 'cancelled', 'rejected'],
  in_progress: ['on_hold', 'waiting_approval', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  waiting_approval: ['completed', 'rejected', 'in_progress'],
  completed: ['archived', 'in_progress'],
  rejected: ['in_progress', 'archived', 'cancelled'],
  cancelled: ['archived'],
  archived: ['in_progress'],
};

export const TERMINAL_TASK_STATUSES = ['completed', 'rejected', 'cancelled', 'archived'];

/** Moving OUT of waiting_approval into these targets requires tasks:approve, not just tasks:edit. */
export const APPROVAL_GATED_TARGETS = ['completed', 'rejected'];

export const TASK_STATUSES_SEED = ['draft', 'pending', 'in_progress', 'on_hold', 'waiting_approval', 'completed', 'rejected', 'cancelled', 'archived'];
export const TASK_PRIORITIES_SEED = ['low', 'medium', 'high', 'critical'];
