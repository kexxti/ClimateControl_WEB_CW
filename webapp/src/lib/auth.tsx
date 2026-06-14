import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { trpc } from './trpcClient';
import { useToast } from './toast';

type UserRole = 'admin' | 'user';

type AuthUser = {
  id: number;
  login: string;
  role: UserRole;
  isActive: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isCheckingSession: boolean;
  isBackendUnavailable: boolean;
  setSession: (token: string, user: AuthUser) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: (reason?: 'manual' | 'expired') => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const utils = trpc.useContext();
  const { showToast } = useToast();
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));
  const [backendUnavailableShown, setBackendUnavailableShown] = useState(false);
  const hasToken = Boolean(token);
  const currentUser = trpc.auth.me.useQuery(undefined, {
    enabled: hasToken,
    retry: false,
  });
  const logoutMutation = trpc.auth.logout.useMutation();
  const refreshMutation = trpc.auth.refresh.useMutation();

  const isUnauthorized = currentUser.error?.data?.code === 'UNAUTHORIZED';
  const isBackendUnavailable = Boolean(hasToken && currentUser.isError && !isUnauthorized);

  const clearSession = useCallback(async () => {
    localStorage.removeItem('authToken');
    setToken(null);
    await utils.invalidate();
  }, [utils]);

  const logout = useCallback(
    async (reason: 'manual' | 'expired' = 'manual') => {
      if (reason === 'manual' && hasToken) {
        await logoutMutation.mutateAsync().catch(() => undefined);
      }
      await clearSession();
      showToast({
        tone: reason === 'expired' ? 'warning' : 'info',
        title: reason === 'expired' ? 'Сессия истекла' : 'Вы вышли из системы',
        message: reason === 'expired' ? 'Войдите снова, чтобы продолжить работу.' : undefined,
      });
    },
    [clearSession, hasToken, logoutMutation, showToast],
  );

  const setSession = useCallback(
    async (nextToken: string, user: AuthUser) => {
      localStorage.setItem('authToken', nextToken);
      setToken(nextToken);
      setBackendUnavailableShown(false);
      utils.auth.me.setData(undefined, user);
      await utils.auth.me.invalidate();
    },
    [utils.auth.me],
  );

  const refreshSession = useCallback(async () => {
    const result = await refreshMutation.mutateAsync();
    localStorage.setItem('authToken', result.token);
    setToken(result.token);
    utils.auth.me.setData(undefined, result.user);
    showToast({
      tone: 'success',
      title: 'Сессия обновлена',
    });
  }, [refreshMutation, showToast, utils.auth.me]);

  useEffect(() => {
    if (!hasToken || !currentUser.isError || !isUnauthorized) {
      return;
    }

    void logout('expired');
  }, [currentUser.isError, hasToken, isUnauthorized, logout]);

  useEffect(() => {
    if (!isBackendUnavailable || backendUnavailableShown) {
      return;
    }

    setBackendUnavailableShown(true);
    showToast({
      tone: 'error',
      title: 'Backend недоступен',
      message: 'Проверьте, запущен ли backend-сервер на localhost:3000.',
    });
  }, [backendUnavailableShown, isBackendUnavailable, showToast]);

  const user = currentUser.data ?? null;
  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      isCheckingSession: hasToken && currentUser.isLoading,
      isBackendUnavailable,
      setSession,
      refreshSession,
      logout,
    }),
    [currentUser.isLoading, hasToken, isBackendUnavailable, logout, refreshSession, setSession, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
