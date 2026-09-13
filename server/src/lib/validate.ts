import { badRequest, notFound } from './apiError';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids from the URL reach SQL as UUIDs, and Postgres errors on malformed ones. Since
 * a value that isn't a UUID can't identify anything, answer "not found" rather than
 * letting it become a 500.
 */
export function requireUuidParam(value: string | undefined): string {
  if (!value || !UUID_PATTERN.test(value)) throw notFound();
  return value;
}

function field(body: unknown, name: string): unknown {
  return (body as Record<string, unknown> | undefined)?.[name];
}

export function requireString(
  body: unknown,
  name: string,
  opts: { min?: number; max?: number } = {},
): string {
  const value = field(body, name);
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${name} is required`);
  }
  const trimmed = value.trim();
  if (opts.min !== undefined && trimmed.length < opts.min) {
    throw badRequest(`${name} must be at least ${opts.min} characters`);
  }
  if (opts.max !== undefined && trimmed.length > opts.max) {
    throw badRequest(`${name} must be at most ${opts.max} characters`);
  }
  return trimmed;
}

export function optionalString(
  body: unknown,
  name: string,
  opts: { max?: number } = {},
): string | null | undefined {
  const value = field(body, name);
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`${name} must be text`);
  const trimmed = value.trim();
  if (opts.max !== undefined && trimmed.length > opts.max) {
    throw badRequest(`${name} must be at most ${opts.max} characters`);
  }
  return trimmed;
}

export function optionalBoolean(body: unknown, name: string): boolean | undefined {
  const value = field(body, name);
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw badRequest(`${name} must be true or false`);
  return value;
}

export function requireEmail(body: unknown, name = 'email'): string {
  const value = requireString(body, name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw badRequest('Enter a valid email address');
  }
  return value.toLowerCase();
}
