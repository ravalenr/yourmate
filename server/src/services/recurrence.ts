import type { Frequency } from '../lib/taskTypes';

/**
 * Deadline maths on plain 'YYYY-MM-DD' strings.
 *
 * Everything here works in UTC internally and never looks at the clock's timezone,
 * so "the 14th" means the 14th regardless of where the server or the user is.
 */

export function parseDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function today(): string {
  return formatDate(new Date());
}

function addDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + count);
  return result;
}

/**
 * Adds months, clamping to the end of the target month rather than overflowing.
 * Plain setUTCMonth would turn 31 Jan into 3 March; this gives 28 Feb, matching
 * what Postgres's `+ INTERVAL '1 month'` does.
 */
function addMonths(date: Date, count: number): Date {
  const targetMonth = date.getUTCMonth() + count;
  const year = date.getUTCFullYear();
  // Day 0 of the following month is the last day of the target month.
  const lastDayOfTarget = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, targetMonth, Math.min(date.getUTCDate(), lastDayOfTarget)));
}

function advanceOnce(deadline: string, frequency: Frequency, interval: number): string {
  const date = parseDate(deadline);
  switch (frequency) {
    case 'daily':
      return formatDate(addDays(date, interval));
    case 'weekly':
      return formatDate(addDays(date, 7 * interval));
    case 'monthly':
      return formatDate(addMonths(date, interval));
    case 'one_off':
      throw new Error('A one-off task has no next deadline');
  }
}

/**
 * The deadline a repeating task moves to once it's been completed.
 *
 * Advances from the *old* deadline rather than from today, so a weekly bin run
 * stays on its Tuesday rhythm instead of drifting to whenever someone got round
 * to it. If the task was overdue, it keeps advancing until the result is in the
 * future — otherwise completing a three-weeks-late task would leave it still
 * overdue.
 */
export function nextDeadline(
  deadline: string,
  frequency: Frequency,
  interval: number,
  from: string = today(),
): string {
  let next = advanceOnce(deadline, frequency, interval);
  while (next <= from) {
    next = advanceOnce(next, frequency, interval);
  }
  return next;
}
