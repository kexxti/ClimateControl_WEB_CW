import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RoomHistoryLineChart } from '../../components/charts';
import { MetricCard, PageHeader, Panel, SegmentedControl } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/uiState';
import type { getRoomParams } from '../../lib/routes';
import { algorithmOptions, controlModeLabel, roomPeriodLabel, roomStatusLabel, type Algorithm, type RoomPeriod } from '../../lib/climate';
import { formatTemp } from '../../lib/formatters';
import { getDashboard, getSettings, getStatistics } from '../../lib/routes';
import { useToast } from '../../lib/toast';
import { trpc } from '../../lib/trpcClient';
import styles from './index.module.scss';

const roomHistoryLineChartClasses = {
  chart: styles.chart,
  axis: styles.axis,
  grid: styles.grid,
  tooltip: styles.tooltip,
  tempLine: styles.tempLine,
  setpointLine: styles.setpointLine,
  tempDot: styles.tempDot,
  setpointMarker: styles.setpointMarker,
  legend: styles.legend,
  tempLegend: styles.tempLegend,
  setpointLegend: styles.setpointLegend,
};

const roomPeriodOptions: RoomPeriod[] = ['day', 'week', 'month'];

export const RoomPage = () => {
  const { roomID } = useParams() as getRoomParams;
  const utils = trpc.useContext();
  const { showToast } = useToast();
  const [period, setPeriod] = useState<RoomPeriod>('day');
  const { data, error, isLoading, isFetching, isError } = trpc.rooms.getById.useQuery({ roomID, period });
  const [setpointDraft, setSetpointDraft] = useState<number | null>(null);
  const [algorithmDraft, setAlgorithmDraft] = useState<Algorithm | null>(null);
  const [pidDraft, setPidDraft] = useState({ kp: 1.2, ki: 0.35, kd: 0.08, hysteresis: 0.4 });

  const room = data?.room;

  useEffect(() => {
    if (!data) {
      return;
    }

    setPidDraft(data.pidParams);
  }, [data]);

  const invalidateRoomData = async () => {
    await Promise.all([
      utils.rooms.getById.invalidate(),
      utils.rooms.getAll.invalidate(),
      utils.dashboard.getSummary.invalidate(),
      utils.statistics.getAnalytics.invalidate(),
      utils.getRoom.invalidate({ roomID }),
      utils.getDashboardData.invalidate(),
      utils.getStatisticsData.invalidate(),
    ]);
  };

  const updateSetpoint = trpc.rooms.updateSetpoint.useMutation({
    onSuccess: async (result) => {
      setSetpointDraft(null);
      showToast({
        tone: 'success',
        title: result.commandCreated ? 'Уставка сохранена' : 'Уставка сохранена как desired config',
        message: result.commandCreated ? 'Команда отправится контроллеру.' : 'Контроллер применит её после возврата в remote/online режим.',
      });
      await invalidateRoomData();
    },
    onError: (mutationError) => showToast({ tone: 'error', title: 'Не удалось сохранить уставку', message: mutationError.message }),
  });

  const updateAlgorithm = trpc.rooms.updateAlgorithm.useMutation({
    onSuccess: async (result) => {
      setAlgorithmDraft(null);
      showToast({
        tone: 'success',
        title: result.commandCreated ? 'Алгоритм сохранён' : 'Алгоритм сохранён как desired config',
        message: result.commandCreated ? 'Команда отправится контроллеру.' : 'Контроллер применит его после возврата в remote/online режим.',
      });
      await invalidateRoomData();
    },
    onError: (mutationError) => showToast({ tone: 'error', title: 'Не удалось сохранить алгоритм', message: mutationError.message }),
  });

  const updatePidParams = trpc.rooms.updatePidParams.useMutation({
    onSuccess: async (result) => {
      showToast({
        tone: 'success',
        title: result.commandCreated ? 'PID-параметры сохранены' : 'PID сохранён как desired config',
        message: result.commandCreated ? 'Команда отправится контроллеру.' : 'Контроллер применит параметры после возврата в remote/online режим.',
      });
      await invalidateRoomData();
    },
    onError: (mutationError) => showToast({ tone: 'error', title: 'Не удалось сохранить PID', message: mutationError.message }),
  });

  if (isLoading || isFetching) {
    return <LoadingState title="Загрузка помещения..." />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  if (!room) {
    return <EmptyState title="Помещение не найдено" message="Проверьте адрес страницы или вернитесь на Dashboard." />;
  }

  const chartData = data.history;
  const setpoint = setpointDraft ?? room.setpoint;
  const algorithm = algorithmDraft ?? room.algorithm;
  const isSaving = updateSetpoint.isLoading || updateAlgorithm.isLoading || updatePidParams.isLoading;

  return (
    <section className={styles.roomPage}>
      <PageHeader
        className={styles.header}
        title={room.name}
        description="Управление параметрами аудитории и мониторинг температуры"
        actions={(
          <div className={styles.headerLinks}>
          <Link to={getDashboard()}>Dashboard</Link>
          <Link to={getStatistics()}>Статистика</Link>
          </div>
        )}
      />

      <Panel
        className={styles.panel}
        headerClassName={styles.panelHeader}
        title="Текущие параметры"
        actions={(
          <Link aria-label="Настройки приложения" to={getSettings()}>
            ⚙
          </Link>
        )}
      >
        <div className={styles.currentGrid}>
          <MetricCard className={styles.metric} label="Температура" value={formatTemp(room.currentTemp)} />
          <MetricCard className={styles.metric} label="Уставка" value={formatTemp(setpoint)} />
          <MetricCard className={styles.metric} label="Алгоритм" value={algorithm} />
          <MetricCard className={styles.metric} label="Статус" value={roomStatusLabel[room.status]} />
          <MetricCard className={styles.metric} label="Режим управления" value={controlModeLabel[room.controlMode ?? 'remote']} />
        </div>
        {room.controlMode === 'local' || room.status === 'offline' ? (
          <p className={styles.modeNotice}>
            {room.status === 'offline'
              ? 'Устройство offline: изменения будут сохранены как желаемая конфигурация.'
              : 'Локальный режим: веб-панель не управляет устройством напрямую.'}
          </p>
        ) : null}
        <div className={styles.controlsGrid}>
          <label>
            <span>Изменить уставку</span>
            <input
              type="number"
              min="16"
              max="30"
              step="0.5"
              value={setpoint}
              onChange={(event) => setSetpointDraft(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Выбрать алгоритм</span>
            <select value={algorithm} onChange={(event) => setAlgorithmDraft(event.target.value as Algorithm)}>
              {algorithmOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
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
          <button type="button" disabled={isSaving} onClick={() => updateSetpoint.mutate({ roomID, setpointValue: setpoint })}>
            Сохранить уставку
          </button>
          <button type="button" disabled={isSaving} onClick={() => updateAlgorithm.mutate({ roomID, algorithm })}>
            Сохранить алгоритм
          </button>
          <button type="button" disabled={isSaving} onClick={() => updatePidParams.mutate({ roomID, pidParams: pidDraft })}>
            Сохранить PID
          </button>
        </div>
      </Panel>

      <Panel
        className={styles.panel}
        headerClassName={styles.panelHeader}
        title="Температура"
        actions={(
          <SegmentedControl
            className={styles.segmented}
            activeClassName={styles.activeSegment}
            value={period}
            options={roomPeriodOptions}
            getLabel={(item) => roomPeriodLabel[item]}
            onChange={setPeriod}
          />
        )}
      >
        <RoomHistoryLineChart data={chartData} meta={data.historyMeta} period={period} classNames={roomHistoryLineChartClasses} />
      </Panel>
    </section>
  );
};
