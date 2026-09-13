import { query } from '../db';

/**
 * Removes one-off tasks that were finished before the current week began.
 *
 * Completed one-off tasks stay visible (greyed out) for the rest of the week they
 * were done in, then disappear — see REQUIREMENTS.md section 4.3.
 *
 * `date_trunc('week', ...)` treats Monday as the start of the week in Postgres,
 * matching the ISO week the requirements specify.
 *
 * Returns how many tasks were removed.
 */
export async function cleanupCompletedTasks(): Promise<number> {
  const removed = await query<{ id: string }>(
    `DELETE FROM tasks
     WHERE frequency = 'one_off'
       AND status = 'done'
       AND completed_at < date_trunc('week', now())
     RETURNING id`,
  );
  return removed.length;
}
