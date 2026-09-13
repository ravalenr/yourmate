import { Router, type Request } from 'express';
import { query, queryRequired } from '../db';
import {
  NOTIFICATION_COLUMNS,
  toNotification,
  type NotificationRow,
} from '../lib/serializers';
import { requireUuidParam } from '../lib/validate';
import { currentUserId } from '../middleware/auth';
import { requireMembership } from '../services/membership';

/** Mounted at /environments/:environmentId/notifications */
export const notificationRoutes = Router({ mergeParams: true });

type EnvironmentParams = { environmentId: string };

const FEED_LIMIT = 50;

notificationRoutes.get('/', async (req: Request<EnvironmentParams>, res) => {
  const environmentId = requireUuidParam(req.params.environmentId);
  const userId = currentUserId(req);
  await requireMembership(userId, environmentId);

  const notifications = await query<NotificationRow>(
    `SELECT ${NOTIFICATION_COLUMNS} FROM notifications
     WHERE user_id = $1 AND environment_id = $2
     ORDER BY created_at DESC, id
     LIMIT ${FEED_LIMIT}`,
    [userId, environmentId],
  );

  const counts = await queryRequired<{ holiday_mode: boolean; unread_count: string }>(
    `SELECT
       (SELECT holiday_mode FROM users WHERE id = $1) AS holiday_mode,
       (SELECT COUNT(*) FROM notifications
          WHERE user_id = $1 AND environment_id = $2 AND read_at IS NULL) AS unread_count`,
    [userId, environmentId],
  );

  res.json({
    notifications: notifications.map(toNotification),
    // Holiday mode silences the badge without hiding the feed, so there's something
    // to come back to rather than a silent gap.
    unreadCount: counts.holiday_mode ? 0 : Number(counts.unread_count),
    holidayMode: counts.holiday_mode,
  });
});

notificationRoutes.post('/read', async (req: Request<EnvironmentParams>, res) => {
  const environmentId = requireUuidParam(req.params.environmentId);
  const userId = currentUserId(req);
  await requireMembership(userId, environmentId);

  await query(
    `UPDATE notifications SET read_at = now()
     WHERE user_id = $1 AND environment_id = $2 AND read_at IS NULL`,
    [userId, environmentId],
  );

  res.json({ unreadCount: 0 });
});
