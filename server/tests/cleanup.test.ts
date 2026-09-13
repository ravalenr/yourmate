import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db';
import { cleanupCompletedTasks } from '../src/jobs/cleanupTasks';
import { deleteTestData, post, signUp, startTestServer, stopTestServer } from './helpers';

const SCOPE = 'cleanup';

let householdId: string;
let userId: string;

before(async () => {
  await startTestServer();
  await deleteTestData(SCOPE);

  const user = await signUp(SCOPE, 'alice');
  userId = user.userId;
  const created = await post('/environments', { name: 'Cleanup Flat' }, user.token);
  householdId = created.body.environment.id;
});

after(async () => {
  await deleteTestData(SCOPE);
  await stopTestServer();
});

/**
 * Inserts a task directly so `completed_at` can be backdated — the API always
 * stamps completions with the current time.
 *
 * `completedAt` is raw SQL rather than a value, so that "the start of this week"
 * is worked out by Postgres using the same clock and week rules as the job.
 */
async function insertTask(options: {
  frequency: string;
  status: string;
  completedAt: string | null;
}): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO tasks (environment_id, short_description, deadline, frequency,
                        assignment_type, status, completed_at, completed_by, created_by)
     VALUES ($1, 'Cleanup subject', CURRENT_DATE, $2, 'unassigned', $3,
             ${options.completedAt ?? 'NULL'}, $4, $4)
     RETURNING id`,
    [householdId, options.frequency, options.status, userId],
  );
  return result.rows[0].id;
}

async function taskStillExists(id: string): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM tasks WHERE id = $1', [id]);
  return result.rowCount === 1;
}

describe('cleanupCompletedTasks', () => {
  it('removes a one-off task finished before this week', async () => {
    const id = await insertTask({
      frequency: 'one_off',
      status: 'done',
      completedAt: "now() - interval '8 days'",
    });

    await cleanupCompletedTasks();
    assert.equal(await taskStillExists(id), false);
  });

  it('keeps a one-off task finished during this week', async () => {
    // Exactly the start of the current week: still this week, so it stays.
    const id = await insertTask({
      frequency: 'one_off',
      status: 'done',
      completedAt: "date_trunc('week', now())",
    });

    await cleanupCompletedTasks();
    assert.equal(await taskStillExists(id), true);
  });

  it('keeps a one-off task that is still outstanding', async () => {
    const id = await insertTask({ frequency: 'one_off', status: 'pending', completedAt: null });

    await cleanupCompletedTasks();
    assert.equal(await taskStillExists(id), true);
  });

  it('never removes a repeating task, however long ago it was last done', async () => {
    const id = await insertTask({
      frequency: 'weekly',
      status: 'pending',
      completedAt: "now() - interval '200 days'",
    });

    await cleanupCompletedTasks();
    assert.equal(await taskStillExists(id), true);
  });

  it('reports how many it removed, and does nothing on a second run', async () => {
    await insertTask({
      frequency: 'one_off',
      status: 'done',
      completedAt: "now() - interval '30 days'",
    });

    assert.ok((await cleanupCompletedTasks()) >= 1);
    assert.equal(await cleanupCompletedTasks(), 0);
  });
});
