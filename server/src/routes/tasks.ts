import { Router, type Request } from 'express';
import { query, queryOne, queryRequired } from '../db';
import { badRequest, conflict, notFound } from '../lib/apiError';
import { TASK_COLUMNS, toTask, type TaskRow } from '../lib/serializers';
import { ASSIGNMENT_TYPES, FREQUENCIES, type AssignmentType } from '../lib/taskTypes';
import {
  optionalPositiveInt,
  optionalString,
  optionalUuid,
  requireDate,
  requireEnum,
  requireString,
  requireUuidParam,
} from '../lib/validate';
import { currentUserId } from '../middleware/auth';
import { requireMembership } from '../services/membership';
import { nextDeadline } from '../services/recurrence';
import { nextAssignee, type RotationMember } from '../services/rotation';
import { displayNameOf, notifyHousehold } from '../services/notify';

/** Mounted at /environments/:environmentId/tasks */
export const environmentTaskRoutes = Router({ mergeParams: true });

// mergeParams makes the parent's :environmentId available at runtime, but TypeScript
// can't infer that from the mount path, so handlers declare it.
type EnvironmentParams = { environmentId: string };

/** Mounted at /tasks */
export const taskRoutes = Router();

const MAX_SHORT_DESCRIPTION = 120;
const MAX_LONG_DESCRIPTION = 2000;

async function loadTaskForMember(taskId: string, userId: string): Promise<TaskRow> {
  const task = await queryOne<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1`, [taskId]);
  if (!task) throw notFound('Task not found');
  // Throws 404 if the caller isn't in the household this task belongs to.
  await requireMembership(userId, task.environment_id);
  return task;
}

/** Household members in join order — that ordering is the rotation sequence. */
async function rotationMembers(environmentId: string): Promise<RotationMember[]> {
  const rows = await query<{ id: string; holiday_mode: boolean }>(
    `SELECT u.id, u.holiday_mode
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.environment_id = $1
     ORDER BY m.joined_at, u.id`,
    [environmentId],
  );
  return rows.map((row) => ({ id: row.id, holidayMode: row.holiday_mode }));
}

async function requireIsMember(environmentId: string, userId: string) {
  const row = await queryOne<{ exists: number }>(
    'SELECT 1 AS exists FROM memberships WHERE environment_id = $1 AND user_id = $2',
    [environmentId, userId],
  );
  if (!row) throw badRequest('That person is not in this household');
}

/**
 * Works out who a task should be assigned to, given its assignment type.
 * `fallback` is used when a rotational task doesn't name a starting person —
 * whoever is setting it up takes the first turn.
 */
async function resolveAssignee(
  environmentId: string,
  assignmentType: AssignmentType,
  requested: string | null | undefined,
  fallback: string,
): Promise<string | null> {
  if (assignmentType === 'unassigned') {
    if (requested) throw badRequest('An unassigned task cannot name an assignee');
    return null;
  }

  const candidate = requested ?? (assignmentType === 'rotational' ? fallback : null);
  if (!candidate) {
    throw badRequest('assignedUserId is required for a manually assigned task');
  }

  await requireIsMember(environmentId, candidate);
  return candidate;
}

// --- Tasks within a household --------------------------------------------

environmentTaskRoutes.get('/', async (req: Request<EnvironmentParams>, res) => {
  const environmentId = requireUuidParam(req.params.environmentId);
  await requireMembership(currentUserId(req), environmentId);

  const rows = await query<TaskRow>(
    `SELECT ${TASK_COLUMNS} FROM tasks
     WHERE environment_id = $1
     ORDER BY (status = 'done'), deadline, created_at`,
    [environmentId],
  );

  res.json({ tasks: rows.map(toTask) });
});

environmentTaskRoutes.post('/', async (req: Request<EnvironmentParams>, res) => {
  const environmentId = requireUuidParam(req.params.environmentId);
  const userId = currentUserId(req);
  await requireMembership(userId, environmentId);

  const shortDescription = requireString(req.body, 'shortDescription', {
    max: MAX_SHORT_DESCRIPTION,
  });
  const longDescription = optionalString(req.body, 'longDescription', {
    max: MAX_LONG_DESCRIPTION,
  });
  const deadline = requireDate(req.body, 'deadline');
  const frequency = requireEnum(req.body, 'frequency', FREQUENCIES);
  const frequencyInterval = optionalPositiveInt(req.body, 'frequencyInterval') ?? 1;
  const assignmentType = requireEnum(req.body, 'assignmentType', ASSIGNMENT_TYPES);
  const assignedUserId = await resolveAssignee(
    environmentId,
    assignmentType,
    optionalUuid(req.body, 'assignedUserId'),
    userId,
  );

  const task = await queryRequired<TaskRow>(
    `INSERT INTO tasks (environment_id, short_description, long_description, deadline,
                        frequency, frequency_interval, assignment_type,
                        assigned_user_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${TASK_COLUMNS}`,
    [
      environmentId,
      shortDescription,
      longDescription ?? null,
      deadline,
      frequency,
      frequencyInterval,
      assignmentType,
      assignedUserId,
      userId,
    ],
  );

  await notifyHousehold({
    environmentId,
    actorId: userId,
    type: 'task_created',
    detail: `added "${shortDescription}"`,
    taskId: task.id,
  });

  res.status(201).json({ task: toTask(task) });
});

// --- A single task -------------------------------------------------------

taskRoutes.get('/:id', async (req, res) => {
  const task = await loadTaskForMember(requireUuidParam(req.params.id), currentUserId(req));
  res.json({ task: toTask(task) });
});

taskRoutes.patch('/:id', async (req, res) => {
  const taskId = requireUuidParam(req.params.id);
  const userId = currentUserId(req);
  const task = await loadTaskForMember(taskId, userId);
  const body = req.body ?? {};

  // Column names here are literals from this file, never caller input, so building
  // the SET clause by hand can't be used for injection. Values stay parameterised.
  const updates: Record<string, unknown> = {};

  if (body.shortDescription !== undefined) {
    updates.short_description = requireString(body, 'shortDescription', {
      max: MAX_SHORT_DESCRIPTION,
    });
  }
  if (body.longDescription !== undefined) {
    updates.long_description = optionalString(body, 'longDescription', {
      max: MAX_LONG_DESCRIPTION,
    });
  }
  if (body.deadline !== undefined) {
    updates.deadline = requireDate(body, 'deadline');
  }
  if (body.frequency !== undefined) {
    updates.frequency = requireEnum(body, 'frequency', FREQUENCIES);
  }
  if (body.frequencyInterval !== undefined) {
    updates.frequency_interval = optionalPositiveInt(body, 'frequencyInterval');
  }

  if (body.assignmentType !== undefined || body.assignedUserId !== undefined) {
    const assignmentType =
      body.assignmentType !== undefined
        ? requireEnum(body, 'assignmentType', ASSIGNMENT_TYPES)
        : task.assignment_type;
    const requested = optionalUuid(body, 'assignedUserId');

    updates.assignment_type = assignmentType;
    updates.assigned_user_id = await resolveAssignee(
      task.environment_id,
      assignmentType,
      requested !== undefined ? requested : task.assigned_user_id,
      userId,
    );
  }

  const columns = Object.keys(updates);
  if (columns.length === 0) throw badRequest('No changes were provided');

  const setClause = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  const updated = await queryRequired<TaskRow>(
    `UPDATE tasks SET ${setClause} WHERE id = $${columns.length + 1} RETURNING ${TASK_COLUMNS}`,
    [...columns.map((column) => updates[column]), taskId],
  );

  // Only a change of hands is worth telling the household about; edits to wording
  // or dates would just be noise in the feed.
  if (updated.assigned_user_id !== task.assigned_user_id) {
    await notifyHousehold({
      environmentId: task.environment_id,
      actorId: userId,
      type: 'task_reassigned',
      detail: updated.assigned_user_id
        ? `assigned "${updated.short_description}" to ${await displayNameOf(updated.assigned_user_id)}`
        : `put "${updated.short_description}" up for anyone to take`,
      taskId: task.id,
    });
  }

  res.json({ task: toTask(updated) });
});

taskRoutes.delete('/:id', async (req, res) => {
  const taskId = requireUuidParam(req.params.id);
  await loadTaskForMember(taskId, currentUserId(req));

  await query('DELETE FROM tasks WHERE id = $1', [taskId]);
  res.status(204).end();
});

taskRoutes.post('/:id/complete', async (req, res) => {
  const taskId = requireUuidParam(req.params.id);
  const userId = currentUserId(req);
  const task = await loadTaskForMember(taskId, userId);

  // A one-off task is simply finished. It greys out in the app and the weekly
  // cleanup job removes it once the week is over.
  if (task.frequency === 'one_off') {
    if (task.status === 'done') throw conflict('That task is already done');

    const finished = await queryRequired<TaskRow>(
      `UPDATE tasks SET status = 'done', completed_at = now(), completed_by = $1
       WHERE id = $2 RETURNING ${TASK_COLUMNS}`,
      [userId, taskId],
    );
    await notifyHousehold({
      environmentId: task.environment_id,
      actorId: userId,
      type: 'task_completed',
      detail: `completed "${task.short_description}"`,
      taskId: task.id,
    });

    res.json({ task: toTask(finished) });
    return;
  }

  // A repeating task never becomes "done": it moves to its next deadline, and if
  // it rotates, to its next person.
  const deadline = nextDeadline(task.deadline, task.frequency, task.frequency_interval);

  let assignedUserId = task.assigned_user_id;
  let covering = false;

  if (task.assignment_type === 'rotational') {
    const rotation = nextAssignee(await rotationMembers(task.environment_id), task.assigned_user_id);
    assignedUserId = rotation.assigneeId;
    covering = rotation.covering;
  }

  const updated = await queryRequired<TaskRow>(
    `UPDATE tasks
     SET deadline = $1, assigned_user_id = $2, assigned_while_covering = $3,
         completed_at = now(), completed_by = $4, status = 'pending'
     WHERE id = $5
     RETURNING ${TASK_COLUMNS}`,
    [deadline, assignedUserId, covering, userId, taskId],
  );

  await notifyHousehold({
    environmentId: task.environment_id,
    actorId: userId,
    type: 'task_completed',
    detail: `completed "${task.short_description}"`,
    taskId: task.id,
  });

  res.json({ task: toTask(updated) });
});

taskRoutes.post('/:id/claim', async (req, res) => {
  const taskId = requireUuidParam(req.params.id);
  const userId = currentUserId(req);
  const task = await loadTaskForMember(taskId, userId);

  if (task.assignment_type !== 'unassigned') {
    throw conflict('That task already has an owner');
  }

  // Claiming makes it a fixed assignment, per the requirements.
  const claimed = await queryRequired<TaskRow>(
    `UPDATE tasks SET assignment_type = 'manual', assigned_user_id = $1
     WHERE id = $2 RETURNING ${TASK_COLUMNS}`,
    [userId, taskId],
  );

  await notifyHousehold({
    environmentId: task.environment_id,
    actorId: userId,
    type: 'task_claimed',
    detail: `took on "${task.short_description}"`,
    taskId: task.id,
  });

  res.json({ task: toTask(claimed) });
});
