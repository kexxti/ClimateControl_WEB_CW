import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../lib/routes';
import { trpc } from '../../lib/trpcClient';
import styles from './index.module.scss';

type Algorithm = 'PID' | 'On/Off' | 'Time' | 'ML';
type ClimateMode = 'standard' | 'energySaving' | 'night';

const modeLabel: Record<ClimateMode, string> = {
  standard: 'Обычный',
  energySaving: 'Энергосберегающий',
  night: 'Ночной',
};

export const SettingsPage = () => {
  const { data, error, isLoading, isFetching, isError } = trpc.getSettingsData.useQuery();
  const [themeDraft, setThemeDraft] = useState<string | null>(null);
  const [refreshIntervalDraft, setRefreshIntervalDraft] = useState<string | null>(null);
  const [connectionProfileDraft, setConnectionProfileDraft] = useState<string | null>(null);
  const [algorithmDraft, setAlgorithmDraft] = useState<Algorithm | null>(null);
  const [modeDraft, setModeDraft] = useState<ClimateMode | null>(null);
  const [pidPresetDraft, setPidPresetDraft] = useState<string | null>(null);
  const [applyTargetDraft, setApplyTargetDraft] = useState<string | null>(null);

  if (isLoading || isFetching) {
    return <div className={styles.state}>Загрузка настроек...</div>;
  }

  if (isError) {
    return <div className={styles.state}>Ошибка: {error.message}</div>;
  }

  if (!data) {
    return <div className={styles.state}>Нет данных настроек</div>;
  }

  const theme = themeDraft ?? data.application.theme;
  const refreshInterval = refreshIntervalDraft ?? data.application.refreshInterval;
  const connectionProfile = connectionProfileDraft ?? data.application.connectionProfile;
  const algorithm = algorithmDraft ?? data.system.algorithm;
  const mode = modeDraft ?? data.system.mode;
  const pidPreset = pidPresetDraft ?? data.system.pidPreset;
  const applyTarget = applyTargetDraft ?? data.system.applyTarget;

  return (
    <section className={styles.settingsPage}>
      <header className={styles.header}>
        <div>
          <h1>Настройки</h1>
          <p>Параметры интерфейса, подключения и глобального управления климатом</p>
        </div>
        <Link className={styles.dashboardLink} to={getDashboard()}>
          Dashboard
        </Link>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Настройки приложения</h2>
        </div>
        <div className={styles.settingsGrid}>
          <label>
            <span>Тема</span>
            <select value={theme} onChange={(event) => setThemeDraft(event.target.value)}>
              <option value="system">Системная</option>
              <option value="light">Светлая</option>
              <option value="contrast">Контрастная</option>
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
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Настройки системы</h2>
        </div>
        <div className={styles.settingsGrid}>
          <label>
            <span>Алгоритм</span>
            <div className={styles.inlineControl}>
              <button type="button">Назначить всем</button>
              <select value={algorithm} onChange={(event) => setAlgorithmDraft(event.target.value as Algorithm)}>
                <option>PID</option>
                <option>On/Off</option>
                <option>Time</option>
                <option>ML</option>
              </select>
            </div>
          </label>
          <label>
            <span>Режим</span>
            <select value={mode} onChange={(event) => setModeDraft(event.target.value as ClimateMode)}>
              {(Object.keys(modeLabel) as ClimateMode[]).map((item) => (
                <option key={item} value={item}>
                  {modeLabel[item]}
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
            <input type="number" step="0.1" defaultValue={data.pidParams.kp} />
          </label>
          <label>
            <span>Ki</span>
            <input type="number" step="0.05" defaultValue={data.pidParams.ki} />
          </label>
          <label>
            <span>Kd</span>
            <input type="number" step="0.01" defaultValue={data.pidParams.kd} />
          </label>
          <label>
            <span>Гистерезис</span>
            <input type="number" step="0.1" defaultValue={data.pidParams.hysteresis} />
          </label>
        </div>
      </section>
    </section>
  );
};
