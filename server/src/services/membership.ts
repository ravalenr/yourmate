import { queryOne } from '../db';
import { forbidden, notFound } from '../lib/apiError';

export type Role = 'owner' | 'member';

/**
 * Confirms the user belongs to this environment and returns what they can do there.
 *
 * Deliberately answers "not found" rather than "not allowed" for non-members: a 403
 * would confirm that an environment with that id exists, which is information a
 * stranger shouldn't get.
 */
export async function requireMembership(userId: string, environmentId: string): Promise<Role> {
  const row = await queryOne<{ role: Role }>(
    'SELECT role FROM memberships WHERE user_id = $1 AND environment_id = $2',
    [userId, environmentId],
  );
  if (!row) throw notFound('Household not found');
  return row.role;
}

export async function requireOwner(userId: string, environmentId: string): Promise<void> {
  const role = await requireMembership(userId, environmentId);
  if (role !== 'owner') {
    throw forbidden('Only the household owner can do that');
  }
}
