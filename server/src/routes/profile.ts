import { Router, type Request } from 'express';
import { query, queryOne, queryRequired } from '../db';
import { badRequest, notFound } from '../lib/apiError';
import { toPrivateUser, USER_COLUMNS, type UserRow } from '../lib/serializers';
import {
  optionalBoolean,
  optionalString,
  requireEnum,
  requireString,
  requireUuidParam,
} from '../lib/validate';
import { currentUserId, requireAuth } from '../middleware/auth';

export const profileRoutes = Router();

const MAX_BIO_LENGTH = 280;
const MAX_AVATAR_BYTES = 1_000_000;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

async function loadUser(userId: string) {
  return queryRequired<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
}

profileRoutes.get('/me', requireAuth, async (req, res) => {
  res.json({ user: toPrivateUser(await loadUser(currentUserId(req))) });
});

profileRoutes.patch('/me', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const body = req.body ?? {};

  // Column names are literals from this file, so the SET clause can't be injected.
  const updates: Record<string, unknown> = {};

  if (body.displayName !== undefined) {
    updates.display_name = requireString(body, 'displayName', { max: 60 });
  }
  if (body.bio !== undefined) {
    updates.bio = optionalString(body, 'bio', { max: MAX_BIO_LENGTH });
  }
  const holidayMode = optionalBoolean(body, 'holidayMode');
  if (holidayMode !== undefined) {
    updates.holiday_mode = holidayMode;
  }

  const columns = Object.keys(updates);
  if (columns.length === 0) throw badRequest('No changes were provided');

  const setClause = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  const updated = await queryRequired<UserRow>(
    `UPDATE users SET ${setClause} WHERE id = $${columns.length + 1} RETURNING ${USER_COLUMNS}`,
    [...columns.map((column) => updates[column]), userId],
  );

  res.json({ user: toPrivateUser(updated) });
});

profileRoutes.put('/me/avatar', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const mimeType = requireEnum(req.body, 'mimeType', ALLOWED_IMAGE_TYPES);
  const base64 = requireString(req.body, 'data');

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0) throw badRequest('That image could not be read');
  if (bytes.length > MAX_AVATAR_BYTES) {
    throw badRequest('That picture is too large — please pick a smaller one');
  }

  await query('UPDATE users SET avatar_data = $1, avatar_mime = $2 WHERE id = $3', [
    bytes,
    mimeType,
    userId,
  ]);

  res.json({ user: toPrivateUser(await loadUser(userId)) });
});

profileRoutes.delete('/me/avatar', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  await query('UPDATE users SET avatar_data = NULL, avatar_mime = NULL WHERE id = $1', [userId]);
  res.json({ user: toPrivateUser(await loadUser(userId)) });
});

/**
 * Serves a user's picture as an actual image so the app can point an <Image> at it.
 * Still behind auth — the app sends the token as a header on the image request.
 */
profileRoutes.get('/users/:id/avatar', requireAuth, async (req: Request<{ id: string }>, res) => {
  const userId = requireUuidParam(req.params.id);

  const row = await queryOne<{ avatar_data: Buffer | null; avatar_mime: string | null }>(
    'SELECT avatar_data, avatar_mime FROM users WHERE id = $1',
    [userId],
  );
  if (!row?.avatar_data || !row.avatar_mime) throw notFound('No picture set');

  res.setHeader('Content-Type', row.avatar_mime);
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.send(row.avatar_data);
});
