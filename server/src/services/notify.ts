import { query, queryOne } from '../db';
import type { NotificationType } from '../lib/notificationTypes';

type NotifyOptions = {
  environmentId: string;
  /** Who did the thing. They don't get notified about their own actions. */
  actorId: string;
  type: NotificationType;
  /** Phrased to follow the actor's name, e.g. `added "Take the bins out"`. */
  detail: string;
  taskId?: string | null;
};

/**
 * Writes one notification row per household member, skipping the actor. The
 * INSERT ... SELECT fans out across the membership list in a single statement
 * rather than looping in JavaScript.
 *
 * Rows are written even for members on holiday. Holiday mode silences the unread
 * badge; it doesn't erase what happened, so they can catch up when they return
 * (ARCHITECTURE.md section 6.5).
 *
 * The actor's name is baked into the message, so the feed keeps reading correctly
 * as a historical record even if they rename themselves later.
 */
export async function notifyHousehold({
  environmentId,
  actorId,
  type,
  detail,
  taskId = null,
}: NotifyOptions): Promise<void> {
  await query(
    `INSERT INTO notifications (environment_id, user_id, actor_id, task_id, type, message)
     SELECT $1, m.user_id, $2, $3, $4,
            COALESCE((SELECT display_name FROM users WHERE id = $2), 'Someone') || ' ' || $5
     FROM memberships m
     WHERE m.environment_id = $1 AND m.user_id <> $2`,
    [environmentId, actorId, taskId, type, detail],
  );
}

export async function displayNameOf(userId: string): Promise<string> {
  const row = await queryOne<{ display_name: string }>(
    'SELECT display_name FROM users WHERE id = $1',
    [userId],
  );
  return row?.display_name ?? 'someone';
}
