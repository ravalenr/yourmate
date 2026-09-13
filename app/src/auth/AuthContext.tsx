import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setAuthToken } from '../api/client';
import type { User } from '../types';

const TOKEN_KEY = 'yourmate.token';

type AuthValue = {
  user: User | null;
  /** True while the saved token is being checked at launch. */
  isRestoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

type AuthResponse = { token: string; user: User };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // On launch, use any saved token — but only trust it if the server still accepts
  // it, otherwise an expired token would show a signed-in app that can't load data.
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          setAuthToken(saved);
          const { user: me } = await api.get<{ user: User }>('/me');
          setUser(me);
        }
      } catch {
        setAuthToken(null);
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      } finally {
        setIsRestoring(false);
      }
    })();
  }, []);

  const applySession = useCallback(async ({ token, user: signedIn }: AuthResponse) => {
    setAuthToken(token);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setUser(signedIn);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      applySession(await api.post<AuthResponse>('/auth/login', { email, password }));
    },
    [applySession],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      applySession(
        await api.post<AuthResponse>('/auth/signup', { email, password, displayName }),
      );
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    // Tokens are stateless, so signing out is just forgetting ours.
    setAuthToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: me } = await api.get<{ user: User }>('/me');
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isRestoring, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an AuthProvider');
  return value;
}
