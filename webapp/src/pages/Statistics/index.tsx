import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../lib/routes';
import { trpc } from '../../lib/trpcClient';
import styles from './index.module.scss';

type Period = 'day' | 'week' | 'month' | 'custom';
type RoomStatus = 'heating' | 'cooling' | 'stable' | 'offline' | 'error';

type Room = {
  roomID: string;
  name: string;
  currentTemp: number;
  setpoint: number;
  status: RoomStatus;
};

type RoomHistoryPoint = {
  time: string;
  temp: number;
  setpoint: number;
};

type SetpointPoint = {
  name: string;
  currentTemp: number;
  setpoint: number;
};

type TemperaturePoint = {
  time: string;
  avgTemp: number;
  avgSetpoint: number;
};

type StatePoint = {
  status: RoomStatus;
  label: string;
  value: number;
};

const periodLabel: Record<Period, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  custom: 'Выбрать период',
};

const statusLabel: Record<RoomStatus, string> = {
  heating: 'Нагрев',
  cooling: 'Охлаждение',
  stable: 'Поддержка',
  offline: 'Оффлайн',
  error: 'Ошибка',
};

const formatTemp = (value: number) => `${value.toFixed(1)}°C`;

const SetpointBarChart = ({ data }: { data: SetpointPoint[] }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const width = 720;
    const height = 330;
    const margin = { top: 28, right: 20, bottom: 58, left: 52 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const keys = ['currentTemp', 'setpoint'] as const;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');

    const x0 = d3
      .scaleBand<string>()
      .domain(data.map((item) => item.name))
      .range([0, innerWidth])
      .padding(0.28);
    const x1 = d3.scaleBand<(typeof keys)[number]>().domain(keys).range([0, x0.bandwidth()]).padding(0.12);
    const values = data.flatMap((item) => [item.currentTemp, item.setpoint]);
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
      .call(d3.axisBottom(x0).tickSizeOuter(0));
    chart.append('g').attr('class', styles.axis).call(d3.axisLeft(y).ticks(5).tickFormat((value) => `${value}°`));

    const groups = chart
      .selectAll('g.roomBars')
      .data(data)
      .join('g')
      .attr('class', 'roomBars')
      .attr('transform', (item) => `translate(${x0(item.name) ?? 0}, 0)`);

    groups
      .selectAll('rect')
      .data((item) => keys.map((key) => ({ key, value: item[key] })))
      .join('rect')
      .attr('x', (item) => x1(item.key) ?? 0)
      .attr('y', (item) => y(item.value))
      .attr('width', x1.bandwidth())
      .attr('height', (item) => innerHeight - y(item.value))
      .attr('rx', 4)
      .attr('class', (item) => (item.key === 'currentTemp' ? styles.tempBar : styles.setpointBar));

    const legend = svg.append('g').attr('class', styles.legend).attr('transform', `translate(${margin.left}, 12)`);
    [
      { label: 'Температура', className: styles.tempBar },
      { label: 'Уставка', className: styles.setpointBar },
    ].forEach((item, index) => {
      const group = legend.append('g').attr('transform', `translate(${index * 130}, 0)`);
      group.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('class', item.className);
      group.append('text').attr('x', 16).attr('y', 10).text(item.label);
    });
  }, [data]);

  return <svg ref={svgRef} className={styles.chart} aria-label="Сравнение температуры и уставки" />;
};

const TemperatureLineChart = ({ data }: { data: TemperaturePoint[] }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const width = 720;
    const height = 330;
    const margin = { top: 28, right: 24, bottom: 48, left: 52 };
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

    const tempLine = d3
      .line<TemperaturePoint>()
      .x((item) => x(item.time) ?? 0)
      .y((item) => y(item.avgTemp))
      .curve(d3.curveMonotoneX);
    const setpointLine = d3
      .line<TemperaturePoint>()
      .x((item) => x(item.time) ?? 0)
      .y((item) => y(item.avgSetpoint))
      .curve(d3.curveMonotoneX);

    chart.append('path').datum(data).attr('class', styles.avgTempLine).attr('d', tempLine);
    chart.append('path').datum(data).attr('class', styles.avgSetpointLine).attr('d', setpointLine);
    chart
      .selectAll('circle.tempDot')
      .data(data)
      .join('circle')
      .attr('class', styles.tempDot)
      .attr('cx', (item) => x(item.time) ?? 0)
      .attr('cy', (item) => y(item.avgTemp))
      .attr('r', 4);
  }, [data]);

  return <svg ref={svgRef} className={styles.chart} aria-label="Температура за выбранный период" />;
};

const StatePieChart = ({ data }: { data: StatePoint[] }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const width = 520;
    const height = 360;
    const radius = 118;
    const color = d3
      .scaleOrdinal<RoomStatus, string>()
      .domain(['heating', 'cooling', 'stable', 'offline', 'error'])
      .range(['#f59e0b', '#3b82f6', '#10b981', '#64748b', '#ef4444']);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');

    const chart = svg.append('g').attr('transform', `translate(${width / 2 - 42}, ${height / 2})`);
    const pie = d3.pie<StatePoint>().value((item) => item.value).sort(null);
    const arc = d3.arc<d3.PieArcDatum<StatePoint>>().innerRadius(0).outerRadius(radius);

    chart
      .selectAll('path')
      .data(pie(data))
      .join('path')
      .attr('d', arc)
      .attr('fill', (item) => color(item.data.status))
      .attr('stroke', '#fff')
      .attr('stroke-width', 3);

    const legend = svg.append('g').attr('class', styles.legend).attr('transform', `translate(${width - 150}, 120)`);
    data.forEach((item, index) => {
      const group = legend.append('g').attr('transform', `translate(0, ${index * 28})`);
      group.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', color(item.status));
      group.append('text').attr('x', 20).attr('y', 11).text(`${item.label}: ${item.value}`);
    });
  }, [data]);

  return <svg ref={svgRef} className={styles.pieChart} aria-label="Диаграмма состояний помещений" />;
};

export const StatisticsPage = () => {
  const [selectedRoomIDs, setSelectedRoomIDs] = useState<string[] | null>(null);
  const [period, setPeriod] = useState<Period>('day');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const statisticsInput = useMemo(
    () => ({
      roomIDs: selectedRoomIDs ?? undefined,
      period,
      dateFrom: period === 'custom' && dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
      dateTo: period === 'custom' && dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
    }),
    [dateFrom, dateTo, period, selectedRoomIDs],
  );
  const { data, error, isLoading, isFetching, isError } = trpc.statistics.getAnalytics.useQuery(statisticsInput);
  const { data: filterRooms } = trpc.rooms.getAll.useQuery();

  const effectiveRoomIDs = useMemo(
    () => selectedRoomIDs ?? filterRooms?.map((room) => room.roomID) ?? data?.rooms.map((room) => room.roomID) ?? [],
    [data?.rooms, filterRooms, selectedRoomIDs],
  );
  const selectedRooms = useMemo(
    () => data?.rooms.filter((room) => effectiveRoomIDs.includes(room.roomID)) ?? [],
    [data?.rooms, effectiveRoomIDs],
  );

  const setpointData = useMemo(
    () =>
      data?.setpointComparison
        .filter((room) => effectiveRoomIDs.includes(room.roomID))
        .map((room) => ({
          name: room.name.replace('Кабинет ', ''),
          currentTemp: room.currentTemp,
          setpoint: room.setpoint,
        })) ?? [],
    [data?.setpointComparison, effectiveRoomIDs],
  );

  const temperatureData = useMemo(() => {
    if (!data || selectedRooms.length === 0) {
      return [];
    }

    const histories = selectedRooms
      .map((room: Room) => data.roomHistories[room.roomID])
      .filter((history): history is RoomHistoryPoint[] => Boolean(history));

    if (histories.length === 0) {
      return [];
    }

    const buckets = new Map<string, { temps: number[]; setpoints: number[] }>();

    histories.forEach((history) => {
      history.forEach((point) => {
        const bucket = buckets.get(point.time) ?? { temps: [], setpoints: [] };
        bucket.temps.push(point.temp);
        bucket.setpoints.push(point.setpoint);
        buckets.set(point.time, bucket);
      });
    });

    return [...buckets.entries()].map(([time, bucket]) => ({
      time,
      avgTemp: Number((bucket.temps.reduce((sum, value) => sum + value, 0) / bucket.temps.length).toFixed(1)),
      avgSetpoint: Number((bucket.setpoints.reduce((sum, value) => sum + value, 0) / bucket.setpoints.length).toFixed(1)),
    }));
  }, [data, selectedRooms]);

  const stateData = useMemo<StatePoint[]>(() => data?.stateDistribution ?? [], [data?.stateDistribution]);

  const indicators = useMemo(() => {
    if (!data || selectedRooms.length === 0) {
      return null;
    }

    return data.numericIndicators;
  }, [data, selectedRooms.length]);

  const toggleRoom = (roomID: string) => {
    setSelectedRoomIDs((current) => {
      const activeIDs = current ?? filterRooms?.map((room) => room.roomID) ?? data?.rooms.map((room) => room.roomID) ?? [];
      const nextIDs = activeIDs.includes(roomID) ? activeIDs.filter((id) => id !== roomID) : [...activeIDs, roomID];
      return nextIDs.length ? nextIDs : activeIDs;
    });
  };

  if (isLoading || isFetching) {
    return <div className={styles.state}>Загрузка статистики...</div>;
  }

  if (isError) {
    return <div className={styles.state}>Ошибка: {error.message}</div>;
  }

  if (!data || !indicators) {
    return <div className={styles.state}>Нет данных для статистики</div>;
  }

  return (
    <section className={styles.statistics}>
      <header className={styles.header}>
        <div>
          <h1>Статистика</h1>
          <p>Аналитика по выбранным помещениям за период: {periodLabel[period].toLowerCase()}</p>
        </div>
        <Link className={styles.dashboardLink} to={getDashboard()}>
          Dashboard
        </Link>
      </header>

      <div className={styles.layout}>
        <main className={styles.content}>
          <figure className={styles.chartCard}>
            <SetpointBarChart data={setpointData} />
            <figcaption>Уставка</figcaption>
          </figure>

          <figure className={styles.chartCard}>
            <TemperatureLineChart data={temperatureData} />
            <figcaption>Температура</figcaption>
          </figure>

          <figure className={styles.chartCard}>
            <StatePieChart data={stateData} />
            <figcaption>Диаграмма состояний</figcaption>
          </figure>

          <section className={`${styles.chartCard} ${styles.indicatorsCard}`}>
            <h2>Числовые показатели</h2>
            <dl>
              <div>
                <dt>Ср. темп</dt>
                <dd>{formatTemp(indicators.avgTemp)}</dd>
              </div>
              <div>
                <dt>Ср. ошибка</dt>
                <dd>{indicators.avgError.toFixed(1)}°C</dd>
              </div>
              <div>
                <dt>Макс. откл.</dt>
                <dd>{indicators.maxDeviation.toFixed(1)}°C</dd>
              </div>
              <div>
                <dt>Энергопотребление</dt>
                <dd>{indicators.energyConsumption.toFixed(1)} кВт⋅ч</dd>
              </div>
            </dl>
          </section>
        </main>

        <aside className={styles.filters}>
          <h2>Фильтры</h2>

          <section>
            <h3>Помещения</h3>
            <div className={styles.controlList}>
              {(filterRooms ?? data.rooms).map((room: Room) => (
                <label key={room.roomID}>
                  <input
                    type="checkbox"
                    checked={effectiveRoomIDs.includes(room.roomID)}
                    onChange={() => toggleRoom(room.roomID)}
                  />
                  <span>{room.name}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3>Период</h3>
            <div className={styles.controlList}>
              {(Object.keys(periodLabel) as Period[]).map((item) => (
                <label key={item}>
                  <input type="radio" checked={period === item} onChange={() => setPeriod(item)} />
                  <span>{periodLabel[item]}</span>
                </label>
              ))}
            </div>
            {period === 'custom' ? (
              <div className={styles.dateFields}>
                <label>
                  <span>От</span>
                  <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                </label>
                <label>
                  <span>До</span>
                  <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                </label>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
};
