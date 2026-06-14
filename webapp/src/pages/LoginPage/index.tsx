import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { getDashboard } from '../../lib/routes';
import { useToast } from '../../lib/toast';
import { trpc } from '../../lib/trpcClient';
import styles from './index.module.scss';

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isCheckingSession, setSession } = useAuth();
  const { showToast } = useToast();
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const from = (location.state as LoginLocationState | null)?.from?.pathname ?? getDashboard();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (result) => {
      await setSession(result.token, result.user);
      showToast({
        tone: 'success',
        title: 'Вход выполнен',
        message: `Вы вошли как ${result.user.login}`,
      });
      navigate(from, { replace: true });
    },
    onError: (error) =>
      showToast({
        tone: 'error',
        title: 'Не удалось войти',
        message: error.message,
      }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate({ login, password });
  };

  if (isCheckingSession) {
    return <div className={styles.state}>Проверяем сессию...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <section className={styles.loginPage}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.panelHeader}>
          <h1>Вход</h1>
          <p>Авторизация для управления настройками и пользователями</p>
        </div>
        <div className={styles.formGrid}>
          <label>
            <span>Логин</span>
            <input value={login} onChange={(event) => setLogin(event.target.value)} />
          </label>
          <label>
            <span>Пароль</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        </div>
        <div className={styles.actionsRow}>
          <button type="submit" disabled={loginMutation.isLoading}>
            Войти
          </button>
          <span>admin/admin123 или user/user123</span>
        </div>
      </form>
    </section>
  );
};
