import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import * as d3 from 'd3';
import { Link } from 'react-router-dom';
import { BuildingHistoryLineChart } from '../../components/charts';
import { StatusBadge } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/uiState';
import type { RoomListItem } from '../../lib/apiTypes';
import { useAuth } from '../../lib/auth';
import {
  formatPeriodRange,
  makeTooltipLines,
  normalizeRoomHistoryPoints,
  type HistoryMeta,
  type RoomHistoryPoint,
} from '../../lib/charting';
import { algorithmOptions, compactControlModeLabel, dashboardRoomStatusLabel, type Algorithm } from '../../lib/climate';
import { formatTemp } from '../../lib/formatters';
import { getLogs, getRoom, getStatistics } from '../../lib/routes';
import { useToast } from '../../lib/toast';
import { trpc } from '../../lib/trpcClient';
import styles from './index.module.scss';

const RoomTemperatureChart = ({ data, meta }: { data: RoomHistoryPoint[]; meta?: HistoryMeta }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const width = 720;
    const height = 320;
    const margin = { top: 24, right: 20, bottom: 44, left: 48 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const keys = ['temp', 'setpoint'] as const;
    const chartData = normalizeRoomHistoryPoints(data, meta?.period ?? 'day', 'Dashboard room temperature');

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');

    const domainKeys = chartData.map((item) => item.bucketStart);
    const labelByKey = new Map(chartData.map((item) => [item.bucketStart, item.time]));
    const maxTicks = Math.max(2, Math.floor(innerWidth / 92));
    const tickStep = Math.max(1, Math.ceil(domainKeys.length / maxTicks));
    const tickValues = domainKeys.filter((_, index) => index % tickStep === 0);
    const x0 = d3
      .scaleBand<string>()
      .domain(domainKeys)
      .range([0, innerWidth])
      .padding(0.24);

    const x1 = d3.scaleBand<(typeof keys)[number]>().domain(keys).range([0, x0.bandwidth()]).padding(0.16);

    const values = chartData.flatMap((item) => [item.temp, item.setpoint]);
    const y = d3
      .scaleLinear()
      .domain([Math.floor(d3.min(values) ?? 18) - 1, Math.ceil(d3.max(values) ?? 25) + 1])
      .nice()
      .range([innerHeight, 0]);

    const chart = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    chart
      .append('g')
      .attr('class', styles.grid)
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ''));

    chart
      .append('g')
      .attr('class', styles.axis)
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(
        d3
          .axisBottom(x0)
          .tickValues(tickValues)
          .tickFormat((value) => labelByKey.get(String(value)) ?? String(value)),
      );

    chart.append('g').attr('class', styles.axis).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value}°`));

    const groups = chart
      .selectAll('g.barGroup')
      .data(chartData)
      .join('g')
      .attr('class', 'barGroup')
      .attr('transform', (item) => `translate(${x0(item.bucketStart) ?? 0}, 0)`);

    const tooltip = chart.append('g').attr('class', styles.tooltip).style('display', 'none');
    const tooltipBg = tooltip.append('rect').attr('rx', 6).attr('height', 84);
    const tooltipText = tooltip.append('text').attr('x', 10).attr('y', 18);

    const showTooltip = (event: MouseEvent, item: RoomHistoryPoint) => {
      const lines = makeTooltipLines(formatPeriodRange(item, meta?.period ?? 'day'), {
        temperature: item.temp,
        setpoint: item.setpoint,
        power: item.power,
        minTemp: item.minTemp,
        maxTemp: item.maxTemp,
        count: item.count,
      });
      tooltipText.selectAll('tspan').remove();
      lines.forEach((line, index) => {
        tooltipText.append('tspan').attr('x', 10).attr('dy', index === 0 ? 0 : 16).text(line);
      });
      const [pointerX, pointerY] = d3.pointer(event, chart.node());
      const tooltipWidth = Math.max(...lines.map((line) => line.length)) * 7 + 24;
      const tooltipHeight = lines.length * 16 + 16;
      tooltipBg.attr('width', tooltipWidth).attr('height', tooltipHeight);
      tooltip
        .attr('transform', `translate(${Math.min(pointerX + 14, innerWidth - tooltipWidth)}, ${Math.max(4, pointerY - tooltipHeight - 8)})`)
        .style('display', null);
    };

    groups
      .selectAll('rect')
      .data((item) => keys.map((key) => ({ key, value: item[key] })))
      .join('rect')
      .attr('x', (item) => x1(item.key) ?? 0)
      .attr('y', (item) => y(item.value))
      .attr('width', x1.bandwidth())
      .attr('height', (item) => innerHeight - y(item.value))
      .attr('rx', 4)
      .attr('class', (item) => (item.key === 'temp' ? styles.tempBar : styles.setpointBar))
      .on('mouseenter', function (event) {
        const parentData = d3.select((event.currentTarget as SVGRectElement).parentNode as SVGGElement).datum() as RoomHistoryPoint;
        showTooltip(event, parentData);
      })
      .on('mousemove', function (event) {
        const parentData = d3.select((event.currentTarget as SVGRectElement).parentNode as SVGGElement).datum() as RoomHistoryPoint;
        showTooltip(event, parentData);
      })
      .on('mouseleave', () => tooltip.style('display', 'none'));

    const legend = svg.append('g').attr('class', styles.legend).attr('transform', `translate(${margin.left}, 10)`);
    [
      { label: 'Температура', className: styles.tempBar },
      { label: 'Уставка', className: styles.setpointBar },
    ].forEach((item, index) => {
      const group = legend.append('g').attr('transform', `translate(${index * 130}, 0)`);
      group.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('class', item.className);
      group.append('text').attr('x', 16).attr('y', 10).text(item.label);
    });
  }, [data, meta]);

  return <svg ref={svgRef} className={styles.chart} aria-label="Температура выбранного кабинета за день" />;
};

const buildingHistoryLineChartClasses = {
  chart: styles.chart,
  axis: styles.axis,
  grid: styles.grid,
  tooltip: styles.tooltip,
  avgTempLine: styles.avgTempLine,
  avgSetpointLine: styles.avgSetpointLine,
  avgTempDot: styles.avgTempDot,
  legend: styles.legend,
  avgTempLegend: styles.avgTempLegend,
  avgSetpointLegend: styles.avgSetpointLegend,
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const utils = trpc.useContext();
  const { data, error, isLoading, isFetching, isError } = trpc.dashboard.getSummary.useQuery();
  const [selectedRoomID, setSelectedRoomID] = useState<string | null>(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [createRoomForm, setCreateRoomForm] = useState({
    name: '',
    location: '',
    floor: '',
    setpoint: 22,
    algorithm: 'PID' as Algorithm,
    criticalTemperature: 35,
    deviceUid: '',
    deviceName: '',
  });
  const isAdmin = user?.role === 'admin';
  const selectedRoom = data?.rooms.find((room) => room.roomID === selectedRoomID) ?? data?.rooms[0] ?? null;
  const selectedRoomHistory = selectedRoom
    ? data?.roomHistories[selectedRoom.roomID] ?? data?.selectedRoomHistory ?? []
    : [];
  const createRoom = trpc.rooms.create.useMutation({
    onSuccess: async (room) => {
      setCreateRoomForm({
        name: '',
        location: '',
        floor: '',
        setpoint: 22,
        algorithm: 'PID',
        criticalTemperature: 35,
        deviceUid: '',
        deviceName: '',
      });
      setIsCreateRoomOpen(false);
      setSelectedRoomID(room.roomID);
      showToast({ tone: 'success', title: 'Комната создана', message: room.name });
      await utils.invalidate();
    },
    onError: (mutationError) => {
      showToast({ tone: 'error', title: 'Не удалось создать комнату', message: mutationError.message });
    },
  });
  const softDeleteRoom = trpc.rooms.softDelete.useMutation({
    onSuccess: async (result) => {
      if (selectedRoomID === result.roomID) {
        setSelectedRoomID(null);
      }
      showToast({ tone: 'success', title: 'Комната удалена', message: result.roomName });
      await utils.invalidate();
    },
    onError: (mutationError) => {
      showToast({ tone: 'error', title: 'Не удалось удалить комнату', message: mutationError.message });
    },
  });

  const handleCreateRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createRoom.mutate({
      name: createRoomForm.name || undefined,
      location: createRoomForm.location || undefined,
      floor: createRoomForm.floor ? Number(createRoomForm.floor) : undefined,
      setpoint: createRoomForm.setpoint,
      algorithm: createRoomForm.algorithm,
      criticalTemperature: createRoomForm.criticalTemperature,
      deviceUid: createRoomForm.deviceUid || undefined,
      deviceName: createRoomForm.deviceName || undefined,
    });
  };

  const handleDeleteRoom = (room: RoomListItem) => {
    const confirmed = window.confirm(`Удалить ${room.name}? История измерений и логи сохранятся.`);

    if (!confirmed) {
      return;
    }

    softDeleteRoom.mutate({ roomID: room.roomID });
  };

  if (isLoading || isFetching) {
    return <LoadingState title="Загрузка дашборда..." />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  if (!data) {
    return <EmptyState title="Нет данных для дашборда" message="Проверьте seed-данные и подключение к backend." />;
  }

  return (
    <section className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1>Dashboard</h1>
          <p>Мониторинг помещений, уставок и алгоритмов климат-контроля</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.statisticsLink} to={getLogs()}>
            Логи
          </Link>
          <Link className={styles.statisticsLink} to={getStatistics()}>
            Статистика
          </Link>
          <div className={styles.headerMetric}>
            <span>Средняя температура</span>
            <strong>{formatTemp(data.statistics.avgTemp)}</strong>
          </div>
        </div>
      </header>

      <div className={styles.topSection}>
        <article className={styles.card}>
          <h2>Общая статистика</h2>
          <dl className={styles.statsGrid}>
            <div>
              <dt>Помещений</dt>
              <dd>{data.statistics.totalRooms}</dd>
            </div>
            <div>
              <dt>Вне уставки</dt>
              <dd>{data.statistics.roomsOutsideSetpoint}</dd>
            </div>
            <div>
              <dt>Средняя температура</dt>
              <dd>{formatTemp(data.statistics.avgTemp)}</dd>
            </div>
          </dl>
          <div className={styles.algorithms}>
            <span>Активные алгоритмы</span>
            <ul>
              <li>PID: {data.statistics.activeAlgorithms.PID}</li>
              <li>On/Off: {data.statistics.activeAlgorithms['On/Off']}</li>
              <li>Time: {data.statistics.activeAlgorithms.Time}</li>
              <li>ML: {data.statistics.activeAlgorithms.ML}</li>
            </ul>
          </div>
        </article>

        <article className={`${styles.card} ${styles.roomsCard}`}>
          <div className={styles.cardHeader}>
            <h2>Помещения</h2>
            <div className={styles.cardHeaderActions}>
              <span>{data.rooms.length} активных</span>
              {isAdmin ? (
                <button type="button" onClick={() => setIsCreateRoomOpen((current) => !current)}>
                  {isCreateRoomOpen ? 'Скрыть форму' : 'Добавить'}
                </button>
              ) : null}
            </div>
          </div>

          {isAdmin && isCreateRoomOpen ? (
            <form className={styles.roomForm} onSubmit={handleCreateRoom}>
              <label>
                <span>Название</span>
                <input
                  placeholder="Кабинет 204"
                  value={createRoomForm.name}
                  onChange={(event) => setCreateRoomForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                <span>Расположение</span>
                <input
                  placeholder="Корпус 1"
                  value={createRoomForm.location}
                  onChange={(event) => setCreateRoomForm((current) => ({ ...current, location: event.target.value }))}
                />
              </label>
              <label>
                <span>Этаж</span>
                <input
                  type="number"
                  value={createRoomForm.floor}
                  onChange={(event) => setCreateRoomForm((current) => ({ ...current, floor: event.target.value }))}
                />
              </label>
              <label>
                <span>Уставка</span>
                <input
                  type="number"
                  min={5}
                  max={35}
                  step={0.5}
                  required
                  value={createRoomForm.setpoint}
                  onChange={(event) => setCreateRoomForm((current) => ({ ...current, setpoint: Number(event.target.value) }))}
                />
              </label>
              <label>
                <span>Алгоритм</span>
                <select
                  value={createRoomForm.algorithm}
                  onChange={(event) => setCreateRoomForm((current) => ({ ...current, algorithm: event.target.value as Algorithm }))}
                >
                  {algorithmOptions.map((algorithm) => (
                    <option key={algorithm} value={algorithm}>
                      {algorithm}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Критическая температура</span>
                <input
                  type="number"
                  min={5}
                  max={80}
                  step={0.5}
                  value={createRoomForm.criticalTemperature}
                  onChange={(event) => setCreateRoomForm((current) => ({ ...current, criticalTemperature: Number(event.target.value) }))}
                />
              </label>
              <label>
                <span>Device UID</span>
                <input
                  placeholder="placeholder будет создан автоматически"
                  value={createRoomForm.deviceUid}
                  onChange={(event) => setCreateRoomForm((current) => ({ ...current, deviceUid: event.target.value }))}
                />
              </label>
              <label>
                <span>Имя устройства</span>
                <input
                  placeholder="Placeholder controller"
                  value={createRoomForm.deviceName}
                  onChange={(event) => setCreateRoomForm((current) => ({ ...current, deviceName: event.target.value }))}
                />
              </label>
              <div className={styles.formActions}>
                <button type="submit" disabled={createRoom.isLoading}>
                  Создать комнату
                </button>
              </div>
            </form>
          ) : null}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Текущая температура</th>
                  <th>Уставка</th>
                  <th>Алгоритм</th>
                  <th>Режим</th>
                  <th>Статус</th>
                  {isAdmin ? <th>Действия</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((room: RoomListItem) => (
                  <tr
                    key={room.roomID}
                    className={selectedRoom?.roomID === room.roomID ? styles.selectedRow : ''}
                    onClick={() => setSelectedRoomID(room.roomID)}
                  >
                    <td>
                      <Link className={styles.roomLink} to={getRoom({ roomID: room.roomID })}>
                        {room.name}
                      </Link>
                    </td>
                    <td>{formatTemp(room.currentTemp)}</td>
                    <td>{formatTemp(room.setpoint)}</td>
                    <td>{room.algorithm}</td>
                    <td>{compactControlModeLabel[room.controlMode ?? 'remote']}</td>
                    <td>
                      <StatusBadge className={`${styles.status} ${styles[room.status]}`} label={dashboardRoomStatusLabel[room.status]} />
                    </td>
                    {isAdmin ? (
                      <td>
                        <button
                          className={styles.deleteRoomButton}
                          type="button"
                          disabled={softDeleteRoom.isLoading}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteRoom(room);
                          }}
                        >
                          Удалить
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.rooms.length === 0 ? (
              <div className={styles.tableEmpty}>Активных помещений нет. Администратор может добавить первую комнату.</div>
            ) : null}
          </div>
        </article>
      </div>

      {selectedRoom ? (
        <section className={`${styles.card} ${styles.chartsCard}`}>
          <div className={styles.cardHeader}>
            <h2>Графики за день</h2>
            <span>Выбран кабинет: {selectedRoom.name}</span>
          </div>
          <div className={styles.chartsGrid}>
            <figure>
              <RoomTemperatureChart data={selectedRoomHistory} meta={data.historyMeta} />
            <figcaption>Данные выбранного кабинета за день</figcaption>
          </figure>
          <figure>
            <BuildingHistoryLineChart
              data={data.buildingHistory}
              meta={data.historyMeta}
              period={data.historyMeta.period}
              classNames={buildingHistoryLineChartClasses}
              ariaLabel="Средние данные по зданию за день"
            />
            <figcaption>Общие данные за день</figcaption>
          </figure>
          </div>
        </section>
      ) : null}

      <section className={`${styles.card} ${styles.eventsCard}`}>
        <div className={styles.cardHeader}>
          <h2>Последние события</h2>
          <span>{data.recentEvents.length} записей</span>
        </div>
        <ul className={styles.eventsList}>
          {data.recentEvents.map((event) => (
            <li key={event.id}>
              <span className={`${styles.eventSeverity} ${styles[event.severity]}`}>{event.severity}</span>
              <div>
                <strong>{event.message}</strong>
                <small>
                  {event.roomName ?? 'Система'} · {new Date(event.createdAt).toLocaleString('ru-RU')}
                </small>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
};
