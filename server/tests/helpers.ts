import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import { pool } from '../src/db';

/**
 * Test accounts all sit under this domain so cleanup can target them precisely.
 *
 * Node runs each test file in its own process, in parallel, against the same
 * database. Every file therefore picks its own `scope` and only ever touches
 * addresses under it — otherwise one file's cleanup would delete another's users
 * mid-run.
 */
export const TEST_DOMAIN = 'test.yourmate.local';

export const PASSWORD = 'correct-horse-battery';

let server: Server;
let baseUrl: string;

export async function startTestServer() {
  // Port 0 means "any free port", so tests never clash with a running dev server.
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
}

export async function stopTestServer() {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

export function testEmail(scope: string, name: string): string {
  return `${name}@${scope}.${TEST_DOMAIN}`;
}

export async function deleteTestData(scope: string) {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%@${scope}.${TEST_DOMAIN}`]);
  // Deleting those users cascades their memberships, which can leave an environment
  // with nobody in it. The app never produces memberless environments, so anything
  // in that state is test leftovers.
  await pool.query(`
    DELETE FROM environments
    WHERE NOT EXISTS (
      SELECT 1 FROM memberships m WHERE m.environment_id = environments.id
    )
  `);
}

type Response = { status: number; body: any };

async function request(
  method: string,
  path: string,
  options: { body?: unknown; rawBody?: string; token?: string } = {},
): Promise<Response> {
  const hasBody = options.body !== undefined || options.rawBody !== undefined;
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

export const get = (path: string, token?: string) => request('GET', path, { token });

export const post = (path: string, body: unknown, token?: string) =>
  request('POST', path, { body, token });

export const patch = (path: string, body: unknown, token?: string) =>
  request('PATCH', path, { body, token });

export const del = (path: string, token?: string) => request('DELETE', path, { token });

/** Sends a raw string body, for testing malformed input. */
export const postRaw = (path: string, rawBody: string) => request('POST', path, { rawBody });

export type TestUser = { token: string; userId: string; email: string; displayName: string };

/** Creates an account and returns its token, for tests that need a signed-in user. */
export async function signUp(scope: string, name: string): Promise<TestUser> {
  const email = testEmail(scope, name);
  const response = await post('/auth/signup', { email, password: PASSWORD, displayName: name });
  if (response.status !== 201) {
    throw new Error(`signUp failed for ${email}: ${JSON.stringify(response.body)}`);
  }
  return { token: response.body.token, userId: response.body.user.id, email, displayName: name };
}
