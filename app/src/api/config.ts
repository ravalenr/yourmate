import Constants from 'expo-constants';

/** The API server's port — keep in sync with PORT in server/.env. */
const API_PORT = 3000;

/**
 * Where the API server lives.
 *
 * Expo tells us which machine is serving the JS bundle — `hostUri` looks like
 * '192.168.68.59:8081' — and that's the same Mac running the API. Reusing that
 * address means the iOS Simulator and a real phone on the same Wi-Fi both reach
 * the server with nothing to edit here.
 *
 * `hostUri` is only set while a dev server is attached, so the localhost
 * fallback covers a production build. The MVP doesn't ship one yet; when it
 * does, this should point at the deployed API instead.
 */
function resolveApiBaseUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:${API_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();
