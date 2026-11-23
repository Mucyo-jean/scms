import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../api/api';
import { hasToken, setToken, setUnauthorizedHandler } from '../api/client';
import { refresh, resetState, useDb } from '../api/store';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const user = useDb((snapshot) => snapshot.me);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => resetState());
    let cancelled = false;
    (async () => {
      if (hasToken()) {
        try { await refresh(); } catch { setToken(null); resetState(); }
      }
      if (!cancelled) setBooted(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => api.login(email, password), []);
  const register = useCallback(async (data) => api.register(data), []);
  const logout = useCallback(() => { setToken(null); resetState(); }, []);

  const value = useMemo(
    () => ({ user, loading: !booted, login, register, logout }),
    [user, booted, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const homeFor = (user) => ({ student: '/student', officer: '/officer', admin: '/admin' }[user?.role] ?? '/login');
