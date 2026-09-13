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

export function requireEnum<T extends string>(
  body: unknown,
  name: string,
  allowed: readonly T[],
): T {
  const value = field(body, name);
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${name} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts a calendar date as 'YYYY-MM-DD'. Deadlines carry no time of day. */
export function requireDate(body: unknown, name: string): string {
  const value = field(body, name);
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw badRequest(`${name} must be a date in YYYY-MM-DD format`);
  }
  // Catches things like 2026-02-31, which matches the pattern but isn't a real day.
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw badRequest(`${name} is not a real date`);
  }
  return value;
}

export function optionalPositiveInt(body: unknown, name: string): number | undefined {
  const value = field(body, name);
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw badRequest(`${name} must be a whole number of 1 or more`);
  }
  return value;
}

/** Returns undefined when absent, null when explicitly cleared, else a UUID. */
export function optionalUuid(body: unknown, name: string): string | null | undefined {
  const value = field(body, name);
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw badRequest(`${name} must be a valid id`);
  }
  return value;
}

export function requireEmail(body: unknown, name = 'email'): string {
  const value = requireString(body, name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw badRequest('Enter a valid email address');
  }
  return value.toLowerCase();
}
