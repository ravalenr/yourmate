import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { unauthorized } from '../lib/apiError';

const TOKEN_LIFETIME = '30d';

export function signToken(userId: string): string {
  return jwt.sign({}, env.jwtSecret, { subject: userId, expiresIn: TOKEN_LIFETIME });
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(header.slice('Bearer '.length), env.jwtSecret);
  } catch {
    throw unauthorized('Your session has expired, please sign in again');
  }

  const userId = typeof payload === 'string' ? undefined : payload.sub;
  if (!userId) throw unauthorized();

  req.userId = userId;
  next();
};

/** Use inside any route mounted behind requireAuth. */
export function currentUserId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
