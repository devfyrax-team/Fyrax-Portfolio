import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearTokens, refreshSession, setTokens, storedScope } from './api';

export type Role = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
export interface User {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
}
/** A super administrator: manages companies, belongs to none. */
export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null; // set for a company session
  admin: PlatformAdmin | null; // set for a platform (super admin) session
  loading: boolean;
  login: (tenant: string, email: string, password: string) => Promise<void>;
  loginPlatform: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>(null as never);
export const useAuth = () => useContext(AuthContext);

export const isHR = (r?: Role) => r === 'ADMIN' || r === 'HR';
export const canView = (r?: Role) => r === 'ADMIN' || r === 'HR' || r === 'MANAGER';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(storedScope() !== null);

  useEffect(() => {
    const scope = storedScope();
    if (!scope) return;
    (async () => {
      try {
        if (await refreshSession()) {
          if (scope === 'platform') setAdmin(await api.get<PlatformAdmin>('/platform/auth/me'));
          else setUser(await api.get<User>('/auth/me'));
        }
      } catch {
        clearTokens();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (tenant: string, email: string, password: string) => {
    setTokens(await api.post('/auth/login', { tenant, email, password }), 'tenant');
    setAdmin(null);
    setUser(await api.get<User>('/auth/me'));
  }, []);

  const loginPlatform = useCallback(async (email: string, password: string) => {
    setTokens(await api.post('/platform/auth/login', { email, password }), 'platform');
    setUser(null);
    setAdmin(await api.get<PlatformAdmin>('/platform/auth/me'));
  }, []);

  const logout = useCallback(() => {
    // Tell the server too, so the refresh token is revoked and not just forgotten by this browser.
    // Demo: signing out just reloads the demo, which opens signed in again.
    window.location.reload();
  }, []);

  return <AuthContext.Provider value={{ user, admin, loading, login, loginPlatform, logout }}>{children}</AuthContext.Provider>;
}
