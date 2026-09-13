import express from 'express';
import { pool, queryRequired } from './db';
import { authRoutes } from './routes/auth';
import { environmentRoutes } from './routes/environments';
import { environmentTaskRoutes, taskRoutes } from './routes/tasks';
import { notificationRoutes } from './routes/notifications';
import { currentUserId, requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { toPrivateUser, USER_COLUMNS, type UserRow } from './lib/serializers';

/**
 * Builds the Express app without starting it. Kept separate from index.ts so tests
 * can run the app on a throwaway port instead of the real one.
 */
export function createApp() {
  const app = express();

  app.use(express.json({ limit: '2mb' }));

  app.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRoutes);
  // Registered before /environments so the more specific path is matched first.
  app.use('/environments/:environmentId/tasks', requireAuth, environmentTaskRoutes);
  app.use('/environments/:environmentId/notifications', requireAuth, notificationRoutes);
  app.use('/environments', requireAuth, environmentRoutes);
  app.use('/tasks', requireAuth, taskRoutes);

  // Temporary: proves the auth middleware works end to end. Moves into
  // routes/profile.ts when the profile endpoints are built.
  app.get('/me', requireAuth, async (req, res) => {
    const user = await queryRequired<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [
      currentUserId(req),
    ]);
    res.json({ user: toPrivateUser(user) });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
