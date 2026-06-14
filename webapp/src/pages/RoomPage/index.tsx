import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Link, useParams } from 'react-router-dom';
import type { getRoomParams } from '../../lib/routes';
import { getDashboard, getSettings, getStatistics } from '../../lib/routes';
import { useToast } from '../../lib/toast';
import { trpc } from '../../lib/trpcClient';
import styles from './index.module.scss';

type Period = 'day' | 'week' | 'month';
type Algorithm = 'PID' | 'On/Off' | 'Time' | 'ML';
type RoomStatus = 'heating' | 'cooling' | 'stable' | 'offline' | 'error';

type RoomHistoryPoint = {
  time: string;
  temp: number;
  setpoint: number;
};

const periodLabel: Record<Period, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

const statusLabel: Record<RoomStatus, string> = {
  heating: 'Нагрев',
  cooling: 'Охлаждение',
  stable: 'Поддержка',
  offline: 'Оффлайн',
  error: 'Ошибка',
};

const controlModeLabel = {
  local: 'Локальный',
  remote: 'Дистанционный',
  failsafe: 'Аварийный',
};

const formatTemp = (value: number) => `${value.toFixed(1)}°C`;

const getPeriodData = (history: RoomHistoryPoint[], period: Period) => {
  if (period === 'day') {
    return history;
  }

  if (period === 'week') {
    return history.map((point, index) => ({
      ...point,
      time: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][index] ?? point.time,
      temp: Number((point.temp + (index % 2 === 0 ? 0.4 : -0.3)).toFixed(1)),
    }));
  }

  return history.map((point, index) => ({
    ...point,
    time: `${index + 1} нед.`,
    temp: Number((point.temp + index * 0.2 - 0.5).toFixed(1)),
  }));
};

const TemperatureChart = ({ data }: { data: RoomHistoryPoint[] }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const width = 900;
    const height = 360;
    const margin = { top: 30, right: 28, bottom: 52, left: 56 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');

    const x = d3.scalePoint<string>().domain(data.map((item) => item.time)).range([0, innerWidth]).padding(0.35);
    const values = data.flatMap((item) => [item.temp, item.setpoint]);
    const y = d3
      .scaleLinear()
      .domain([Math.floor(d3.min(values) ?? 18) - 1, Math.ceil(d3.max(values) ?? 26) + 1])
      .nice()
      .range([innerHeight, 0]);

    const chart = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    chart
      .append('g')
      .attr('class', styles.grid)
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ''));
    chart.append('g').attr('class', styles.axis).attr('transform', `translate(0, ${innerHeight})`).call(d3.axisBottom(x));
    chart.append('g').attr('class', styles.axis).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value}°`));

    const tempLine = d3
      .line<RoomHistoryPoint>()
      .x((item) => x(item.time) ?? 0)
      .y((item) => y(item.temp))
      .curve(d3.curveMonotoneX);
    const setpointLine = d3
      .line<RoomHistoryPoint>()
      .x((item) => x(item.time) ?? 0)
      .y((item) => y(item.setpoint))
      .curve(d3.curveMonotoneX);

    chart.append('path').datum(data).attr('class', styles.tempLine).attr('d', tempLine);
    chart.append('path').datum(data).attr('class', styles.setpointLine).attr('d', setpointLine);
    chart
      .selectAll('circle.tempDot')
      .data(data)
      .join('circle')
      .attr('class', styles.tempDot)
      .attr('cx', (item) => x(item.time) ?? 0)
      .attr('cy', (item) => y(item.temp))
      .attr('r', 4);

    const legend = svg.append('g').attr('class', styles.legend).attr('transform', `translate(${margin.left}, 12)`);
    [
      { label: 'Температура', className: styles.tempLegend },
      { label: 'Уставка', className: styles.setpointLegend },
    ].forEach((item, index) => {
      const group = legend.append('g').attr('transform', `translate(${index * 130}, 0)`);
      group.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('class', item.className);
      group.append('text').attr('x', 16).attr('y', 10).text(item.label);
    });
  }, [data]);

  return <svg ref={svgRef} className={styles.chart} aria-label="Температура помещения" />;
};

export const RoomPage = () => {
  const { roomID } = useParams() as getRoomParams;
  const utils = trpc.useContext();
  const { showToast } = useToast();
  const { data, error, isLoading, isFetching, isError } = trpc.rooms.getById.useQuery({ roomID });
  const [period, setPeriod] = useState<Period>('week');
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
      utils.rooms.getById.invalidate({ roomID }),
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
    return <div className={styles.state}>Загрузка помещения...</div>;
  }

  if (isError) {
    return <div className={styles.state}>Ошибка: {error.message}</div>;
  }

  if (!room) {
    return <div className={styles.state}>Room not found</div>;
  }

  const chartData = getPeriodData(data.history, period);
  const setpoint = setpointDraft ?? room.setpoint;
  const algorithm = algorithmDraft ?? room.algorithm;
  const isSaving = updateSetpoint.isLoading || updateAlgorithm.isLoading || updatePidParams.isLoading;

  return (
    <section className={styles.roomPage}>
      <header className={styles.header}>
        <div>
          <h1>{room.name}</h1>
          <p>Управление параметрами аудитории и мониторинг температуры</p>
        </div>
        <div className={styles.headerLinks}>
          <Link to={getDashboard()}>Dashboard</Link>
          <Link to={getStatistics()}>Статистика</Link>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Текущие параметры</h2>
          <Link aria-label="Настройки приложения" to={getSettings()}>
            ⚙
          </Link>
        </div>
        <div className={styles.currentGrid}>
          <div className={styles.metric}>
            <span>Температура</span>
            <strong>{formatTemp(room.currentTemp)}</strong>
          </div>
          <div className={styles.metric}>
            <span>Уставка</span>
            <strong>{formatTemp(setpoint)}</strong>
          </div>
          <div className={styles.metric}>
            <span>Алгоритм</span>
            <strong>{algorithm}</strong>
          </div>
          <div className={styles.metric}>
            <span>Статус</span>
            <strong>{statusLabel[room.status as RoomStatus]}</strong>
          </div>
          <div className={styles.metric}>
            <span>Режим управления</span>
            <strong>{controlModeLabel[room.controlMode ?? 'remote']}</strong>
          </div>
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
              <option>PID</option>
              <option>On/Off</option>
              <option>Time</option>
              <option>ML</option>
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
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Температура</h2>
          <div className={styles.segmented}>
            {(Object.keys(periodLabel) as Period[]).map((item) => (
              <button
                key={item}
                className={period === item ? styles.activeSegment : ''}
                type="button"
                onClick={() => setPeriod(item)}
              >
                {periodLabel[item]}
              </button>
            ))}
          </div>
        </div>
        <TemperatureChart data={chartData} />
      </section>
    </section>
  );
};
