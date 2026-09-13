import { Router } from 'express';
import { query, queryOne, queryRequired, withTransaction } from '../db';
import { badRequest, conflict, forbidden, notFound } from '../lib/apiError';
import { generateInviteCode, normalizeInviteCode } from '../lib/inviteCode';
import { requireString, requireUuidParam } from '../lib/validate';
import {
  toEnvironment,
  toMember,
  type EnvironmentRow,
  type MemberRow,
} from '../lib/serializers';
import { currentUserId } from '../middleware/auth';
import { requireMembership, requireOwner, type Role } from '../services/membership';

export const environmentRoutes = Router();

const ENVIRONMENT_SELECT = `
  SELECT e.id, e.name, e.invite_code, e.created_at,
         m.role, m.joined_at,
         (SELECT COUNT(*) FROM memberships mm
            WHERE mm.environment_id = e.id) AS member_count,
         (SELECT COUNT(*) FROM tasks t
            WHERE t.environment_id = e.id AND t.status = 'pending') AS pending_task_count,
         (SELECT COUNT(*) FROM tasks t
            WHERE t.environment_id = e.id AND t.status = 'pending'
              AND t.assigned_user_id = m.user_id) AS my_pending_task_count
  FROM environments e
  JOIN memberships m ON m.environment_id = e.id
`;

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === UNIQUE_VIOLATION;
}

async function fetchEnvironment(userId: string, environmentId: string) {
  const row = await queryRequired<EnvironmentRow>(
    `${ENVIRONMENT_SELECT} WHERE m.user_id = $1 AND e.id = $2`,
    [userId, environmentId],
  );
  return toEnvironment(row);
}

async function listMembers(environmentId: string) {
  const rows = await query<MemberRow>(
    `SELECT u.id, u.display_name, u.bio, u.avatar_mime, u.holiday_mode,
            m.role, m.joined_at
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.environment_id = $1
     ORDER BY m.joined_at, u.id`,
    [environmentId],
  );
  return rows.map(toMember);
}

// --- Dashboard -----------------------------------------------------------

environmentRoutes.get('/', async (req, res) => {
  const rows = await query<EnvironmentRow>(
    `${ENVIRONMENT_SELECT} WHERE m.user_id = $1 ORDER BY m.joined_at, e.id`,
    [currentUserId(req)],
  );
  res.json({ environments: rows.map(toEnvironment) });
});

environmentRoutes.post('/', async (req, res) => {
  const name = requireString(req.body, 'name', { max: 60 });
  const userId = currentUserId(req);

  // Invite codes are random, so two households could in principle draw the same one.
  // The UNIQUE constraint catches that; we just try again with a fresh code.
  let environmentId: string | undefined;
  for (let attempt = 0; attempt < 5 && !environmentId; attempt++) {
    try {
      environmentId = await withTransaction(async (client) => {
        const created = await client.query<{ id: string }>(
          'INSERT INTO environments (name, invite_code) VALUES ($1, $2) RETURNING id',
          [name, generateInviteCode()],
        );
        const id = created.rows[0].id;
        await client.query(
          `INSERT INTO memberships (user_id, environment_id, role) VALUES ($1, $2, 'owner')`,
          [userId, id],
        );
        return id;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  if (!environmentId) throw new Error('Could not generate a unique invite code');
  res.status(201).json({ environment: await fetchEnvironment(userId, environmentId) });
});

// Must be declared before "/:id" so the literal path wins over the parameter.
environmentRoutes.post('/join', async (req, res) => {
  const inviteCode = normalizeInviteCode(requireString(req.body, 'inviteCode'));
  const userId = currentUserId(req);

  const environment = await queryOne<{ id: string }>(
    'SELECT id FROM environments WHERE invite_code = $1',
    [inviteCode],
  );
  if (!environment) throw notFound('No household found with that invite code');

  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM memberships WHERE user_id = $1 AND environment_id = $2',
    [userId, environment.id],
  );
  if (existing) throw conflict("You're already a member of this household");

  await query(
    `INSERT INTO memberships (user_id, environment_id, role) VALUES ($1, $2, 'member')`,
    [userId, environment.id],
  );

  res.status(201).json({ environment: await fetchEnvironment(userId, environment.id) });
});

// --- A single environment ------------------------------------------------

environmentRoutes.get('/:id', async (req, res) => {
  const environmentId = requireUuidParam(req.params.id);
  const userId = currentUserId(req);
  await requireMembership(userId, environmentId);

  res.json({
    environment: await fetchEnvironment(userId, environmentId),
    members: await listMembers(environmentId),
  });
});

environmentRoutes.patch('/:id', async (req, res) => {
  const environmentId = requireUuidParam(req.params.id);
  const userId = currentUserId(req);
  await requireOwner(userId, environmentId);

  const name = requireString(req.body, 'name', { max: 60 });
  await query('UPDATE environments SET name = $1 WHERE id = $2', [name, environmentId]);

  res.json({ environment: await fetchEnvironment(userId, environmentId) });
});

environmentRoutes.delete('/:id', async (req, res) => {
  const environmentId = requireUuidParam(req.params.id);
  await requireOwner(currentUserId(req), environmentId);

  // Memberships, tasks and notifications go with it via ON DELETE CASCADE.
  await query('DELETE FROM environments WHERE id = $1', [environmentId]);
  res.status(204).end();
});

environmentRoutes.post('/:id/invite-code', async (req, res) => {
  const environmentId = requireUuidParam(req.params.id);
  const userId = currentUserId(req);
  await requireOwner(userId, environmentId);

  let updated = false;
  for (let attempt = 0; attempt < 5 && !updated; attempt++) {
    try {
      await query('UPDATE environments SET invite_code = $1 WHERE id = $2', [
        generateInviteCode(),
        environmentId,
      ]);
      updated = true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  if (!updated) throw new Error('Could not generate a unique invite code');
  res.json({ environment: await fetchEnvironment(userId, environmentId) });
});

// --- Members -------------------------------------------------------------

environmentRoutes.get('/:id/members', async (req, res) => {
  const environmentId = requireUuidParam(req.params.id);
  await requireMembership(currentUserId(req), environmentId);

  res.json({ members: await listMembers(environmentId) });
});

environmentRoutes.delete('/:id/members/:userId', async (req, res) => {
  const environmentId = requireUuidParam(req.params.id);
  const targetUserId = requireUuidParam(req.params.userId);
  const callerId = currentUserId(req);

  const callerRole = await requireMembership(callerId, environmentId);
  const isLeaving = targetUserId === callerId;

  if (!isLeaving && callerRole !== 'owner') {
    throw forbidden('Only the household owner can remove members');
  }

  const target = await queryOne<{ role: Role }>(
    'SELECT role FROM memberships WHERE user_id = $1 AND environment_id = $2',
    [targetUserId, environmentId],
  );
  if (!target) throw notFound('That person is not in this household');

  const successor = isLeaving
    ? await queryOne<{ user_id: string }>(
        `SELECT user_id FROM memberships
         WHERE environment_id = $1 AND user_id <> $2
         ORDER BY joined_at, user_id LIMIT 1`,
        [environmentId, callerId],
      )
    : null;

  if (isLeaving && callerRole === 'owner' && !successor) {
    throw badRequest(
      "You're the only person here. Delete the household instead of leaving it.",
    );
  }

  await withTransaction(async (client) => {
    // An owner who leaves hands the household to the longest-standing member, so it
    // can never be left without someone able to manage it.
    if (isLeaving && callerRole === 'owner' && successor) {
      await client.query(
        `UPDATE memberships SET role = 'owner' WHERE environment_id = $1 AND user_id = $2`,
        [environmentId, successor.user_id],
      );
    }

    // Tasks can't stay assigned to someone who has left the household.
    await client.query(
      `UPDATE tasks SET assigned_user_id = NULL
       WHERE environment_id = $1 AND assigned_user_id = $2`,
      [environmentId, targetUserId],
    );

    await client.query('DELETE FROM memberships WHERE environment_id = $1 AND user_id = $2', [
      environmentId,
      targetUserId,
    ]);
  });

  res.status(204).end();
});
