import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';
import { env } from './env';

// By default the pg driver turns a DATE column into a JavaScript Date at local
// midnight, which silently shifts the day for anyone not on UTC. Deadlines are
// date-only by design (see ARCHITECTURE.md section 3), so keep them as plain
// 'YYYY-MM-DD' strings and avoid timezones entirely.
types.setTypeParser(types.builtins.DATE, (value) => value);

export const pool = new Pool({ connectionString: env.databaseUrl });

/**
 * Runs several statements as one all-or-nothing unit. If anything inside throws,
 * every change is undone — so we can't end up with, say, an environment that has
 * no owner because the second INSERT failed.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** For queries that must produce a row, such as INSERT ... RETURNING. */
export async function queryRequired<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T> {
  const row = await queryOne<T>(text, params);
  if (!row) throw new Error('Expected a row, got none');
  return row;
}
