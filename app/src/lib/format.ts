import type { AssignmentType, Frequency, Member, Task } from '../types';

/** Today as 'YYYY-MM-DD' in UTC — the same basis the server uses for deadlines. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toUtcDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Converts a date picker's value to the 'YYYY-MM-DD' the API expects.
 *
 * Uses the local calendar fields rather than toISOString(), which would convert to
 * UTC first and could hand back yesterday's date for anyone behind UTC.
 */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The inverse of toIsoDate: builds a local date the picker can display. */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function daysUntil(deadline: string, from: string = todayIso()): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toUtcDate(deadline).getTime() - toUtcDate(from).getTime()) / millisecondsPerDay);
}

export function formatDate(iso: string): string {
  return toUtcDate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatDeadline(deadline: string, from: string = todayIso()): string {
  const days = daysUntil(deadline, from);

  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return 'Overdue by a day';
  if (days < 0) return `Overdue by ${-days} days`;
  if (days < 7) return `Due in ${days} days`;
  return `Due ${formatDate(deadline)}`;
}

export function isOverdue(task: Task, from: string = todayIso()): boolean {
  return task.status === 'pending' && daysUntil(task.deadline, from) < 0;
}

export function describeFrequency(frequency: Frequency, interval: number): string {
  switch (frequency) {
    case 'one_off':
      return 'One-off';
    case 'daily':
      return interval === 1 ? 'Every day' : `Every ${interval} days`;
    case 'weekly':
      return interval === 1 ? 'Every week' : `Every ${interval} weeks`;
    case 'monthly':
      return interval === 1 ? 'Every month' : `Every ${interval} months`;
  }
}

export function describeAssignment(assignmentType: AssignmentType): string {
  switch (assignmentType) {
    case 'rotational':
      return 'Takes turns';
    case 'manual':
      return 'Always the same person';
    case 'unassigned':
      return 'Up for grabs';
  }
}

/** Who a task belongs to, from the current reader's point of view. */
export function assigneeLabel(
  task: Task,
  members: Member[] | null,
  currentUserId: string | undefined,
): string {
  if (!task.assignedUserId) return 'Nobody yet';
  if (task.assignedUserId === currentUserId) return 'You';
  return members?.find((member) => member.id === task.assignedUserId)?.displayName ?? 'A housemate';
}
