import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Link } from 'react-router-dom';
import { getLogs, getRoom, getStatistics } from '../../lib/routes';
import { trpc } from '../../lib/trpcClient';
import styles from './index.module.scss';

type RoomStatus = 'heating' | 'cooling' | 'stable' | 'offline' | 'error';
type Algorithm = 'PID' | 'On/Off' | 'Time' | 'ML';

type Room = {
  roomID: string;
  name: string;
  currentTemp: number;
  setpoint: number;
  algorithm: Algorithm;
  status: RoomStatus;
  controlMode?: 'local' | 'remote' | 'failsafe';
};

type RoomHistoryPoint = {
  time: string;
  temp: number;
  setpoint: number;
};

type BuildingHistoryPoint = {
  time: string;
  avgTemp: number;
  avgSetpoint: number;
};

const statusLabel: Record<RoomStatus, string> = {
  heating: 'Нагрев',
  cooling: 'Охлажд.',
  stable: 'Поддержка',
  offline: 'Оффлайн',
  error: 'Ошибка',
};

const controlModeLabel = {
  local: 'Local',
  remote: 'Remote',
  failsafe: 'Failsafe',
};

const formatTemp = (value: number) => `${value.toFixed(1)}°C`;

const RoomTemperatureChart = ({ data }: { data: RoomHistoryPoint[] }) => {
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

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');

    const x0 = d3
      .scaleBand<string>()
      .domain(data.map((item) => item.time))
      .range([0, innerWidth])
      .padding(0.24);

    const x1 = d3.scaleBand<(typeof keys)[number]>().domain(keys).range([0, x0.bandwidth()]).padding(0.16);

    const values = data.flatMap((item) => [item.temp, item.setpoint]);
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

    chart.append('g').attr('class', styles.axis).attr('transform', `translate(0, ${innerHeight})`).call(d3.axisBottom(x0));

    chart.append('g').attr('class', styles.axis).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value}°`));

    const groups = chart
      .selectAll('g.barGroup')
      .data(data)
      .join('g')
      .attr('class', 'barGroup')
      .attr('transform', (item) => `translate(${x0(item.time) ?? 0}, 0)`);

    groups
      .selectAll('rect')
      .data((item) => keys.map((key) => ({ key, value: item[key] })))
      .join('rect')
      .attr('x', (item) => x1(item.key) ?? 0)
      .attr('y', (item) => y(item.value))
      .attr('width', x1.bandwidth())
      .attr('height', (item) => innerHeight - y(item.value))
      .attr('rx', 4)
      .attr('class', (item) => (item.key === 'temp' ? styles.tempBar : styles.setpointBar));

    const legend = svg.append('g').attr('class', styles.legend).attr('transform', `translate(${margin.left}, 10)`);
    [
      { label: 'Температура', className: styles.tempBar },
      { label: 'Уставка', className: styles.setpointBar },
    ].forEach((item, index) => {
      const group = legend.append('g').attr('transform', `translate(${index * 130}, 0)`);
      group.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('class', item.className);
      group.append('text').attr('x', 16).attr('y', 10).text(item.label);
    });
  }, [data]);

  return <svg ref={svgRef} className={styles.chart} aria-label="Температура выбранного кабинета за день" />;
};

const BuildingLineChart = ({ data }: { data: BuildingHistoryPoint[] }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const width = 720;
    const height = 320;
    const margin = { top: 24, right: 24, bottom: 44, left: 48 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');

    const x = d3.scalePoint<string>().domain(data.map((item) => item.time)).range([0, innerWidth]).padding(0.35);
    const values = data.flatMap((item) => [item.avgTemp, item.avgSetpoint]);
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

    chart.append('g').attr('class', styles.axis).attr('transform', `translate(0, ${innerHeight})`).call(d3.axisBottom(x));

    chart.append('g').attr('class', styles.axis).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value}°`));

    const avgTempLine = d3
      .line<BuildingHistoryPoint>()
      .x((item) => x(item.time) ?? 0)
      .y((item) => y(item.avgTemp))
      .curve(d3.curveMonotoneX);

    const avgSetpointLine = d3
      .line<BuildingHistoryPoint>()
      .x((item) => x(item.time) ?? 0)
      .y((item) => y(item.avgSetpoint))
      .curve(d3.curveMonotoneX);

    chart.append('path').datum(data).attr('class', styles.avgTempLine).attr('d', avgTempLine);
    chart.append('path').datum(data).attr('class', styles.avgSetpointLine).attr('d', avgSetpointLine);

    chart
      .selectAll('circle.avgTempDot')
      .data(data)
      .join('circle')
      .attr('class', styles.avgTempDot)
      .attr('cx', (item) => x(item.time) ?? 0)
      .attr('cy', (item) => y(item.avgTemp))
      .attr('r', 4);

    const legend = svg.append('g').attr('class', styles.legend).attr('transform', `translate(${margin.left}, 10)`);
    [
      { label: 'Средняя температура', className: styles.avgTempLegend },
      { label: 'Средняя уставка', className: styles.avgSetpointLegend },
    ].forEach((item, index) => {
      const group = legend.append('g').attr('transform', `translate(${index * 170}, 0)`);
      group.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('class', item.className);
      group.append('text').attr('x', 16).attr('y', 10).text(item.label);
    });
  }, [data]);

  return <svg ref={svgRef} className={styles.chart} aria-label="Средние данные по зданию за день" />;
};

export const DashboardPage = () => {
  const { data, error, isLoading, isFetching, isError } = trpc.dashboard.getSummary.useQuery();
  const [selectedRoomID, setSelectedRoomID] = useState<string | null>(null);
  const selectedRoom = data?.rooms.find((room) => room.roomID === selectedRoomID) ?? data?.rooms[0] ?? null;
  const selectedRoomHistory = selectedRoom
    ? data?.roomHistories[selectedRoom.roomID] ?? data?.selectedRoomHistory ?? []
    : [];

  if (isLoading || isFetching) {
    return <div className={styles.state}>Загрузка дашборда...</div>;
  }

  if (isError) {
    return <div className={styles.state}>Ошибка: {error.message}</div>;
  }

  if (!data || !selectedRoom) {
    return <div className={styles.state}>Нет данных для дашборда</div>;
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
            <span>{data.rooms.length} активных</span>
          </div>

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
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((room: Room) => (
                  <tr
                    key={room.roomID}
                    className={selectedRoom.roomID === room.roomID ? styles.selectedRow : ''}
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
                    <td>{controlModeLabel[room.controlMode ?? 'remote']}</td>
                    <td>
                      <span className={`${styles.status} ${styles[room.status]}`}>{statusLabel[room.status as RoomStatus]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <section className={`${styles.card} ${styles.chartsCard}`}>
        <div className={styles.cardHeader}>
          <h2>Графики за день</h2>
          <span>Выбран кабинет: {selectedRoom.name}</span>
        </div>
        <div className={styles.chartsGrid}>
          <figure>
            <RoomTemperatureChart data={selectedRoomHistory} />
            <figcaption>Данные выбранного кабинета за день</figcaption>
          </figure>
          <figure>
            <BuildingLineChart data={data.buildingHistory} />
            <figcaption>Общие данные за день</figcaption>
          </figure>
        </div>
      </section>

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
