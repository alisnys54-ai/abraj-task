// Lives in its own file: the service and processor import it, and the module
// imports them, so defining it in scheduler.module.ts made a require cycle that
// left the providers undefined at boot.
export const TASK_REMINDERS_QUEUE = 'task-reminders';
