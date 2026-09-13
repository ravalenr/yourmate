import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, queryRequired } from '../db';
import { conflict, unauthorized } from '../lib/apiError';
import { requireEmail, requireString } from '../lib/validate';
import { toPrivateUser, USER_COLUMNS, type UserRow } from '../lib/serializers';
import { signToken } from '../middleware/auth';

export const authRoutes = Router();

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

authRoutes.post('/signup', async (req, res) => {
  const email = requireEmail(req.body);
  const password = requireString(req.body, 'password', { min: MIN_PASSWORD_LENGTH });
  const displayName = requireString(req.body, 'displayName', { max: 60 });

  const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    email,
  ]);
  if (existing) throw conflict('An account with that email already exists');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await queryRequired<UserRow>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING ${USER_COLUMNS}`,
    [email, passwordHash, displayName],
  );

  res.status(201).json({ token: signToken(user.id), user: toPrivateUser(user) });
});

authRoutes.post('/login', async (req, res) => {
  const email = requireEmail(req.body);
  const password = requireString(req.body, 'password');

  const row = await queryOne<UserRow & { password_hash: string }>(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [email],
  );

  // Deliberately the same error whether the email is unknown or the password is
  // wrong, so this endpoint can't be used to discover which emails have accounts.
  const passwordMatches = row !== null && (await bcrypt.compare(password, row.password_hash));
  if (!row || !passwordMatches) throw unauthorized('Incorrect email or password');

  res.json({ token: signToken(row.id), user: toPrivateUser(row) });
});
