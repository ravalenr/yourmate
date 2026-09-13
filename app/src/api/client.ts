import { API_BASE_URL } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Held in memory and set by the auth context on sign-in and on app launch.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/**
 * Avatars are fetched by <Image>, not by this client, so that component needs the
 * token to put in its own Authorization header.
 */
export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(API_BASE_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects when the request never reached the server at all.
    throw new ApiError(0, `Can't reach the server at ${API_BASE_URL}. Is it running?`);
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? 'Something went wrong');
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
