import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { RequireRole } from '../../lib/RequireRole';
import { getDashboard } from '../../lib/routes';
import { useToast } from '../../lib/toast';
import { trpc } from '../../lib/trpcClient';
import { EmptyState, ErrorState, LoadingState } from '../../components/uiState';
import { algorithmOptions, climateModeLabel, type Algorithm, type ClimateMode } from '../../lib/climate';
import styles from './index.module.scss';

type UserRole = 'admin' | 'user';
type AppTheme = 'light' | 'dark';
type SettingsSection = 'application' | 'system' | 'users';

const normalizeTheme = (theme: string): AppTheme => (theme === 'dark' ? 'dark' : 'light');

export const SettingsPage = () => {
  const utils = trpc.useContext();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const isAdmin = currentUser?.role === 'admin';
  const { data, error, isLoading, isFetching, isError } = trpc.settings.get.useQuery();
  const { data: users, error: usersError } = trpc.users.getAll.useQuery(undefined, {
    enabled: isAdmin,
  });
  const [themeDraft, setThemeDraft] = useState<AppTheme | null>(null);
  const [refreshIntervalDraft, setRefreshIntervalDraft] = useState<string | null>(null);
  const [connectionProfileDraft, setConnectionProfileDraft] = useState<string | null>(null);
  const [algorithmDraft, setAlgorithmDraft] = useState<Algorithm | null>(null);
  const [modeDraft, setModeDraft] = useState<ClimateMode | null>(null);
  const [pidPresetDraft, setPidPresetDraft] = useState<string | null>(null);
  const [applyTargetDraft, setApplyTargetDraft] = useState<string | null>(null);
  const [pidDraft, setPidDraft] = useState({ kp: 1.2, ki: 0.35, kd: 0.08, hysteresis: 0.4 });
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [openSections, setOpenSections] = useState<Record<SettingsSection, boolean>>({
    application: true,
    system: true,
    users: true,
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    setPidDraft(data.pidParams);
  }, [data]);

  const invalidateSettings = async () => {
    await Promise.all([utils.settings.get.invalidate(), utils.getSettingsData.invalidate(), utils.getDashboardData.invalidate()]);
  };

  const updateApplicationSettings = trpc.settings.updateApplicationSettings.useMutation({
    onSuccess: async () => {
      setThemeDraft(null);
      setRefreshIntervalDraft(null);
      setConnectionProfileDraft(null);
      showToast({ tone: 'success', title: 'Настройки приложения сохранены' });
      await invalidateSettings();
    },
    onError: (mutationError) => showToast({ tone: 'error', title: 'Не удалось сохранить настройки', message: mutationError.message }),
  });

  const updateSystemSettings = trpc.settings.updateSystemSettings.useMutation({
    onSuccess: async () => {
      setAlgorithmDraft(null);
      setModeDraft(null);
      setPidPresetDraft(null);
      setApplyTargetDraft(null);
      showToast({ tone: 'success', title: 'Настройки системы сохранены' });
      await invalidateSettings();
    },
    onError: (mutationError) => showToast({ tone: 'error', title: 'Требуется роль admin', message: mutationError.message }),
  });

  const applyAlgorithmToRooms = trpc.settings.applyAlgorithmToRooms.useMutation({
    onSuccess: async (result) => {
      showToast({
        tone: 'success',
        title: 'Алгоритм применён',
        message: `Помещений: ${result.affectedRooms}, команд: ${result.commandsCreated}`,
      });
      await invalidateSettings();
      await utils.dashboard.getSummary.invalidate();
      await utils.statistics.getAnalytics.invalidate();
    },
    onError: (mutationError) => showToast({ tone: 'error', title: 'Требуется роль admin', message: mutationError.message }),
  });

  const createUser = trpc.users.create.useMutation({
    onSuccess: async () => {
      setNewUserLogin('');
      setNewUserPassword('');
      setNewUserRole('user');
      showToast({ tone: 'success', title: 'Пользователь создан' });
      await utils.users.getAll.invalidate();
    },
    onError: (mutationError) => showToast({ tone: 'error', title: 'Не удалось создать пользователя', message: mutationError.message }),
  });

  const updateUserRole = trpc.users.updateRole.useMutation({
    onSuccess: async () => {
      showToast({ tone: 'success', title: 'Роль пользователя обновлена' });
      await utils.users.getAll.invalidate();
    },
    onError: (mutationError) => showToast({ tone: 'error', title: 'Не удалось изменить роль', message: mutationError.message }),
  });

  const deactivateUser = trpc.users.deactivate.useMutation({
    onSuccess: async () => {
      showToast({ tone: 'success', title: 'Пользователь отключен' });
      await utils.users.getAll.invalidate();
    },
    onError: (mutationError) => showToast({ tone: 'error', title: 'Не удалось отключить пользователя', message: mutationError.message }),
  });

  const toggleSection = (section: SettingsSection) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  };

  if (isLoading || isFetching) {
    return <LoadingState title="Загрузка настроек..." />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  if (!data) {
    return <EmptyState title="Нет данных настроек" message="Backend не вернул конфигурацию приложения." />;
  }

  const theme = themeDraft ?? normalizeTheme(data.application.theme);
  const refreshInterval = refreshIntervalDraft ?? data.application.refreshInterval;
  const connectionProfile = connectionProfileDraft ?? data.application.connectionProfile;
  const algorithm = algorithmDraft ?? data.system.algorithm;
  const mode = modeDraft ?? data.system.mode;
  const pidPreset = pidPresetDraft ?? data.system.pidPreset;
  const applyTarget = applyTargetDraft ?? data.system.applyTarget;
  const isSaving = updateApplicationSettings.isLoading || updateSystemSettings.isLoading || applyAlgorithmToRooms.isLoading;

  return (
    <section className={styles.settingsPage}>
      <header className={styles.header}>
        <div>
          <h1>Настройки</h1>
          <p>Параметры интерфейса, подключения и глобального управления климатом</p>
          <span className={styles.userState}>
            {currentUser ? `Вы вошли как ${currentUser.login} (${currentUser.role})` : 'Вы не вошли в систему'}
          </span>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.dashboardLink} to={getDashboard()}>
            Dashboard
          </Link>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Настройки приложения</h2>
          <button type="button" onClick={() => toggleSection('application')}>
            {openSections.application ? 'Свернуть' : 'Развернуть'}
          </button>
        </div>
        {openSections.application ? (
          <>
            <div className={styles.settingsGrid}>
              <label>
                <span>Тема</span>
                <select value={theme} onChange={(event) => setThemeDraft(event.target.value as AppTheme)}>
                  <option value="light">Светлая</option>
                  <option value="dark">Тёмная</option>
                </select>
              </label>
              <label>
                <span>Интервал обновления</span>
                <select value={refreshInterval} onChange={(event) => setRefreshIntervalDraft(event.target.value)}>
                  <option value="10 sec">10 секунд</option>
                  <option value="30 sec">30 секунд</option>
                  <option value="1 min">1 минута</option>
                  <option value="5 min">5 минут</option>
                </select>
              </label>
              <label>
                <span>Параметры подключения</span>
                <select value={connectionProfile} onChange={(event) => setConnectionProfileDraft(event.target.value)}>
                  <option value="localhost">localhost</option>
                  <option value="test-stand">Тестовый стенд</option>
                  <option value="production">Production</option>
                </select>
              </label>
            </div>
            <div className={styles.actionsRow}>
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  updateApplicationSettings.mutate({
                    theme,
                    refreshInterval,
                    connectionProfile,
                  })
                }
              >
                Сохранить настройки приложения
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Настройки системы</h2>
          <button type="button" onClick={() => toggleSection('system')}>
            {openSections.system ? 'Свернуть' : 'Развернуть'}
          </button>
        </div>
        {openSections.system ? (
          <>
            {!isAdmin ? <div className={styles.roleNotice}>Для изменения системных настроек требуется роль admin.</div> : null}
            <div className={styles.settingsGrid}>
          <label>
            <span>Алгоритм</span>
            <div className={styles.inlineControl}>
              <button
                type="button"
                disabled={isSaving || !isAdmin}
                title={!isAdmin ? 'Требуется роль admin' : undefined}
                onClick={() => applyAlgorithmToRooms.mutate({ algorithm, target: 'all' })}
              >
                Назначить всем
              </button>
              <select value={algorithm} onChange={(event) => setAlgorithmDraft(event.target.value as Algorithm)}>
                {algorithmOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </label>
          <label>
            <span>Режим</span>
            <select value={mode} onChange={(event) => setModeDraft(event.target.value as ClimateMode)}>
              {(Object.keys(climateModeLabel) as ClimateMode[]).map((item) => (
                <option key={item} value={item}>
                  {climateModeLabel[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>PID пресет</span>
            <select value={pidPreset} onChange={(event) => setPidPresetDraft(event.target.value)}>
              <option value="soft">Мягкий</option>
              <option value="balanced">Сбалансированный</option>
              <option value="fast">Быстрый</option>
            </select>
          </label>
          <label>
            <span>Область применения</span>
            <select value={applyTarget} onChange={(event) => setApplyTargetDraft(event.target.value)}>
              <option value="all">Все аудитории</option>
              <option value="selected">Выбранные аудитории</option>
              <option value="floor">Текущий этаж</option>
            </select>
          </label>
            </div>

            <div className={styles.pidGrid}>
          <label>
            <span>Kp</span>
            <input
              type="number"
              step="0.1"
              value={pidDraft.kp}
              onChange={(event) => setPidDraft((current) => ({ ...current, kp: Number(event.target.value) }))}
            />
          </label>
          <label>
            <span>Ki</span>
            <input
              type="number"
              step="0.05"
              value={pidDraft.ki}
              onChange={(event) => setPidDraft((current) => ({ ...current, ki: Number(event.target.value) }))}
            />
          </label>
          <label>
            <span>Kd</span>
            <input
              type="number"
              step="0.01"
              value={pidDraft.kd}
              onChange={(event) => setPidDraft((current) => ({ ...current, kd: Number(event.target.value) }))}
            />
          </label>
          <label>
            <span>Гистерезис</span>
            <input
              type="number"
              step="0.1"
              value={pidDraft.hysteresis}
              onChange={(event) => setPidDraft((current) => ({ ...current, hysteresis: Number(event.target.value) }))}
            />
          </label>
            </div>
            <div className={styles.actionsRow}>
          <button
            type="button"
            disabled={isSaving || !isAdmin}
            title={!isAdmin ? 'Требуется роль admin' : undefined}
            onClick={() =>
              updateSystemSettings.mutate({
                algorithm,
                mode,
                pidPreset,
                applyTarget,
                pidParams: pidDraft,
              })
            }
          >
            Сохранить настройки системы
          </button>
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Пользователи</h2>
          <button type="button" onClick={() => toggleSection('users')}>
            {openSections.users ? 'Свернуть' : 'Развернуть'}
          </button>
        </div>
        {openSections.users ? (
          <RequireRole role="admin" fallback={<div className={styles.roleNotice}>Управление пользователями доступно только администратору.</div>}>
          <>
            <div className={styles.settingsGrid}>
              <label>
                <span>Логин</span>
                <input value={newUserLogin} onChange={(event) => setNewUserLogin(event.target.value)} />
              </label>
              <label>
                <span>Пароль</span>
                <input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
              </label>
              <label>
                <span>Роль</span>
                <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as UserRole)}>
                  <option value="user">Пользователь</option>
                  <option value="admin">Администратор</option>
                </select>
              </label>
            </div>
            <div className={styles.actionsRow}>
              <button
                type="button"
                disabled={createUser.isLoading || !newUserLogin || !newUserPassword}
                onClick={() => createUser.mutate({ login: newUserLogin, password: newUserPassword, role: newUserRole })}
              >
                Добавить пользователя
              </button>
            </div>

            {usersError ? <div className={styles.state}>Ошибка пользователей: {usersError.message}</div> : null}
            {users && users.length === 0 ? (
              <EmptyState title="Пользователей нет" message="Создайте первого пользователя с нужной ролью." />
            ) : null}
            {users && users.length > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.usersTable}>
                  <thead>
                    <tr>
                      <th>Логин</th>
                      <th>Роль</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.login}</td>
                        <td>
                          <select
                            value={user.role}
                            disabled={!user.isActive || updateUserRole.isLoading}
                            onChange={(event) => updateUserRole.mutate({ userId: user.id, role: event.target.value as UserRole })}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td>{user.isActive ? 'Активен' : 'Отключен'}</td>
                        <td>
                          <button type="button" disabled={!user.isActive} onClick={() => deactivateUser.mutate({ userId: user.id })}>
                            Отключить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
          </RequireRole>
        ) : null}
      </section>
    </section>
  );
};
