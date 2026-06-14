import { useMemo, useState } from 'react';
import { trpc } from '../../lib/trpcClient';
import styles from './index.module.scss';

type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';

const levelLabel: Record<LogLevel, string> = {
  debug: 'Debug',
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
  critical: 'Critical',
};

export const LogsPage = () => {
  const [roomID, setRoomID] = useState('');
  const [deviceUid, setDeviceUid] = useState('');
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters = useMemo(
    () => ({
      roomID: roomID || undefined,
      deviceUid: deviceUid || undefined,
      level: level || undefined,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
      limit: 100,
    }),
    [dateFrom, dateTo, deviceUid, level, roomID],
  );

  const { data, error, isLoading, isFetching, isError } = trpc.logs.getDeviceLogs.useQuery(filters);

  return (
    <section className={styles.logsPage}>
      <header className={styles.header}>
        <div>
          <h1>Логи устройств</h1>
          <p>Технические сообщения от контроллеров и важные предупреждения</p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Фильтры</h2>
        </div>
        <div className={styles.filtersGrid}>
          <label>
            <span>Комната</span>
            <input placeholder="203" value={roomID} onChange={(event) => setRoomID(event.target.value)} />
          </label>
          <label>
            <span>Device UID</span>
            <input placeholder="arduino-203" value={deviceUid} onChange={(event) => setDeviceUid(event.target.value)} />
          </label>
          <label>
            <span>Уровень</span>
            <select value={level} onChange={(event) => setLevel(event.target.value as LogLevel | '')}>
              <option value="">Все</option>
              {(Object.keys(levelLabel) as LogLevel[]).map((item) => (
                <option key={item} value={item}>
                  {levelLabel[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>С даты</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            <span>По дату</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Записи</h2>
          {isFetching ? <span>Обновление...</span> : null}
        </div>
        {isLoading ? <div className={styles.state}>Загрузка логов...</div> : null}
        {isError ? <div className={styles.state}>Ошибка: {error.message}</div> : null}
        {!isLoading && !isError && data?.length === 0 ? <div className={styles.state}>Логов по фильтрам нет</div> : null}
        {data && data.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Уровень</th>
                  <th>Комната</th>
                  <th>Устройство</th>
                  <th>Тип</th>
                  <th>Сообщение</th>
                </tr>
              </thead>
              <tbody>
                {data.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.receivedAt).toLocaleString('ru-RU')}</td>
                    <td>
                      <span className={`${styles.level} ${styles[log.level]}`}>{levelLabel[log.level as LogLevel]}</span>
                    </td>
                    <td>{log.roomName ?? '-'}</td>
                    <td>{log.deviceUid}</td>
                    <td>{log.type}</td>
                    <td>{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
};
