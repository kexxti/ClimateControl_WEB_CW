import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { getDashboard, getLogs, getSettings, getStatistics } from '../../lib/routes';
import { useToast } from '../../lib/toast';
import { trpc } from '../../lib/trpcClient';
import css from './index.module.scss';

const roleLabel = {
  admin: 'Администратор',
  user: 'Пользователь',
};

export const Layout = () => {
  const { user, logout, refreshSession, isBackendUnavailable } = useAuth();
  const { showToast } = useToast();
  const utils = trpc.useContext();
  const { data: settings } = trpc.settings.get.useQuery(undefined, {
    staleTime: 60_000,
  });
  const changePassword = trpc.auth.changePassword.useMutation();
  const [isNavigationCollapsed, setIsNavigationCollapsed] = useState(
    () => localStorage.getItem('navigationCollapsed') === 'true',
  );
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const avatarLetter = user?.login.slice(0, 1).toUpperCase() ?? '?';

  useEffect(() => {
    const theme = settings?.application.theme === 'dark' ? 'dark' : 'light';
    document.body.dataset.theme = theme;
  }, [settings?.application.theme]);

  const toggleNavigation = () => {
    setIsNavigationCollapsed((current) => {
      const nextValue = !current;
      localStorage.setItem('navigationCollapsed', String(nextValue));
      return nextValue;
    });
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setIsPasswordModalOpen(false);
      showToast({
        tone: 'success',
        title: 'Пароль изменён',
      });
      await utils.events.getRecent.invalidate();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Не удалось изменить пароль',
        message: error instanceof Error ? error.message : 'Попробуйте ещё раз.',
      });
    }
  };

  return (
    <div className={`${css.layout} ${isNavigationCollapsed ? css.collapsedLayout : ''}`}>
      <aside className={css.navigation}>
        <div>
          <div className={css.navTop}>
            <div className={css.logo} title="ClimateController">
              {isNavigationCollapsed ? 'CC' : 'ClimateController'}
            </div>
            <button
              className={css.collapseButton}
              type="button"
              aria-label={isNavigationCollapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'}
              onClick={toggleNavigation}
            >
              <span className={css.collapseIcon} aria-hidden="true" />
            </button>
          </div>
          <div className={`${css.connectionState} ${isBackendUnavailable ? css.offline : css.online}`}>
            <span aria-hidden="true" />
            <strong>{isBackendUnavailable ? 'Backend offline' : 'Backend online'}</strong>
          </div>
          <nav className={css.menu} aria-label="Главная навигация">
            <NavLink
              to={getDashboard()}
              className={({ isActive }) => `${css.link} ${isActive ? css.active : ''}`}
            >
              <span>D</span>
              <strong>Dashboard</strong>
            </NavLink>
            <NavLink
              to={getStatistics()}
              className={({ isActive }) => `${css.link} ${isActive ? css.active : ''}`}
            >
              <span>S</span>
              <strong>Statistics</strong>
            </NavLink>
            <NavLink
              to={getLogs()}
              className={({ isActive }) => `${css.link} ${isActive ? css.active : ''}`}
            >
              <span>L</span>
              <strong>Logs</strong>
            </NavLink>
            <NavLink
              to={getSettings()}
              className={({ isActive }) => `${css.link} ${isActive ? css.active : ''}`}
            >
              <span>T</span>
              <strong>Settings</strong>
            </NavLink>
          </nav>
        </div>
        {user ? (
          <div className={css.userArea}>
            <button className={css.userCard} type="button" onClick={() => setIsUserMenuOpen((current) => !current)}>
              <div className={css.avatar} aria-hidden="true">
                {avatarLetter}
              </div>
              <div className={css.userInfo}>
                <strong>{user.login}</strong>
                <span>{roleLabel[user.role]}</span>
              </div>
            </button>
            {isUserMenuOpen ? (
              <div className={css.userMenu}>
                <div className={css.profileBlock}>
                  <span>Профиль</span>
                  <strong>{user.login}</strong>
                  <small>{roleLabel[user.role]}</small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void refreshSession();
                  }}
                >
                  Обновить сессию
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                >
                  Сменить пароль
                </button>
                <button type="button" onClick={() => void logout('manual')}>
                  Выйти
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>
      <main className={css.content}>
        <Outlet />
      </main>
      {isPasswordModalOpen ? (
        <div className={css.modalBackdrop} role="presentation">
          <form className={css.passwordModal} onSubmit={handlePasswordSubmit}>
            <div className={css.modalHeader}>
              <h2>Сменить пароль</h2>
              <button type="button" aria-label="Закрыть окно смены пароля" onClick={() => setIsPasswordModalOpen(false)}>
                ×
              </button>
            </div>
            <div className={css.modalBody}>
              <label>
                <span>Текущий пароль</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label>
                <span>Новый пароль</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </label>
            </div>
            <div className={css.modalActions}>
              <button type="button" onClick={() => setIsPasswordModalOpen(false)}>
                Отмена
              </button>
              <button type="submit" disabled={changePassword.isLoading || !currentPassword || newPassword.length < 6}>
                Сохранить
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};
