export type ChartPeriod = 'day' | 'week' | 'month' | 'custom';

export type HistoryMeta = {
  period: ChartPeriod;
  bucket: 'raw' | 'minute' | '15m' | '30m' | 'hour' | 'day';
  dateFrom: string;
  dateTo: string;
};

export type RoomHistoryPoint = {
  time: string;
  timestamp: string;
  bucketStart: string;
  bucketEnd: string;
  temp: number;
  setpoint: number;
  power: number | null;
  minTemp: number;
  maxTemp: number;
  count: number;
  setpointChanged: boolean;
  isAggregated: boolean;
};

export type BuildingHistoryPoint = {
  time: string;
  timestamp: string;
  bucketStart: string;
  bucketEnd: string;
  avgTemp: number;
  avgSetpoint: number;
  avgPower: number | null;
  minTemp: number;
  maxTemp: number;
  count: number;
};

const MS_IN_HOUR = 60 * 60 * 1000;
const MS_IN_DAY = 24 * MS_IN_HOUR;

export const toDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const getPointDate = (point: { bucketStart?: string; timestamp: string }) => toDate(point.bucketStart ?? point.timestamp);

const average = (values: number[], fallback = 0) => {
  if (values.length === 0) {
    return fallback;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const averageNullable = (values: Array<number | null>) => {
  const numericValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return numericValues.length > 0 ? Number(average(numericValues).toFixed(2)) : null;
};

const getVisualBucketKey = (point: { time: string; bucketStart: string }, period?: ChartPeriod) => {
  if (period === 'day') {
    return point.time;
  }

  return point.bucketStart;
};

const warnDuplicateChartBuckets = <T extends { time: string; bucketStart: string }>(
  chartName: string,
  data: T[],
  period?: ChartPeriod,
) => {
  if (!import.meta.env.DEV) {
    return;
  }

  const seen = new Map<string, number>();
  data.forEach((point) => {
    const key = getVisualBucketKey(point, period);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  });

  const duplicates = [...seen.entries()].filter(([, count]) => count > 1);

  if (duplicates.length > 0) {
    console.warn(`[charts] ${chartName}: duplicate visual buckets detected`, duplicates);
  }
};

export const normalizeRoomHistoryPoints = (
  data: RoomHistoryPoint[],
  period?: ChartPeriod,
  chartName = 'room-history',
): RoomHistoryPoint[] => {
  warnDuplicateChartBuckets(chartName, data, period);

  const buckets = new Map<string, RoomHistoryPoint[]>();
  data.forEach((point) => {
    const key = getVisualBucketKey(point, period);
    buckets.set(key, [...(buckets.get(key) ?? []), point]);
  });

  return [...buckets.values()]
    .map((points) => {
      const sortedPoints = [...points].sort((a, b) => toDate(a.bucketStart).getTime() - toDate(b.bucketStart).getTime());
      const firstPoint = sortedPoints[0];
      const latestPoint = sortedPoints[sortedPoints.length - 1];
      const temps = sortedPoints.map((point) => point.temp);
      const setpoints = sortedPoints.map((point) => point.setpoint);

      return {
        ...firstPoint,
        timestamp: latestPoint.timestamp,
        bucketStart: firstPoint.bucketStart,
        bucketEnd: sortedPoints.reduce(
          (latest, point) => (toDate(point.bucketEnd).getTime() > toDate(latest).getTime() ? point.bucketEnd : latest),
          firstPoint.bucketEnd,
        ),
        temp: Number(average(temps, firstPoint.temp).toFixed(1)),
        setpoint: Number(average(setpoints, firstPoint.setpoint).toFixed(1)),
        power: averageNullable(sortedPoints.map((point) => point.power)),
        minTemp: Number(Math.min(...sortedPoints.map((point) => point.minTemp)).toFixed(1)),
        maxTemp: Number(Math.max(...sortedPoints.map((point) => point.maxTemp)).toFixed(1)),
        count: sortedPoints.reduce((sum, point) => sum + point.count, 0),
        setpointChanged: sortedPoints.some((point) => point.setpointChanged),
        isAggregated: sortedPoints.length > 1 || sortedPoints.some((point) => point.isAggregated),
      };
    })
    .sort((a, b) => toDate(a.bucketStart).getTime() - toDate(b.bucketStart).getTime());
};

export const normalizeBuildingHistoryPoints = (
  data: BuildingHistoryPoint[],
  period?: ChartPeriod,
  chartName = 'building-history',
): BuildingHistoryPoint[] => {
  warnDuplicateChartBuckets(chartName, data, period);

  const buckets = new Map<string, BuildingHistoryPoint[]>();
  data.forEach((point) => {
    const key = getVisualBucketKey(point, period);
    buckets.set(key, [...(buckets.get(key) ?? []), point]);
  });

  return [...buckets.values()]
    .map((points) => {
      const sortedPoints = [...points].sort((a, b) => toDate(a.bucketStart).getTime() - toDate(b.bucketStart).getTime());
      const firstPoint = sortedPoints[0];
      const latestPoint = sortedPoints[sortedPoints.length - 1];

      return {
        ...firstPoint,
        timestamp: latestPoint.timestamp,
        bucketStart: firstPoint.bucketStart,
        bucketEnd: sortedPoints.reduce(
          (latest, point) => (toDate(point.bucketEnd).getTime() > toDate(latest).getTime() ? point.bucketEnd : latest),
          firstPoint.bucketEnd,
        ),
        avgTemp: Number(average(sortedPoints.map((point) => point.avgTemp), firstPoint.avgTemp).toFixed(1)),
        avgSetpoint: Number(average(sortedPoints.map((point) => point.avgSetpoint), firstPoint.avgSetpoint).toFixed(1)),
        avgPower: averageNullable(sortedPoints.map((point) => point.avgPower)),
        minTemp: Number(Math.min(...sortedPoints.map((point) => point.minTemp)).toFixed(1)),
        maxTemp: Number(Math.max(...sortedPoints.map((point) => point.maxTemp)).toFixed(1)),
        count: sortedPoints.reduce((sum, point) => sum + point.count, 0),
      };
    })
    .sort((a, b) => toDate(a.bucketStart).getTime() - toDate(b.bucketStart).getTime());
};

export const getChartDomain = <T extends { bucketStart?: string; timestamp: string }>(
  data: T[],
  meta?: HistoryMeta,
): [Date, Date] => {
  if (meta) {
    return [toDate(meta.dateFrom), toDate(meta.dateTo)];
  }

  if (data.length === 0) {
    const now = new Date();
    return [new Date(now.getTime() - MS_IN_DAY), now];
  }

  return [getPointDate(data[0]), getPointDate(data[data.length - 1])];
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const pushTicksByStep = (start: Date, end: Date, stepMs: number) => {
  const ticks: Date[] = [];

  for (let time = start.getTime(); time <= end.getTime(); time += stepMs) {
    ticks.push(new Date(time));
  }

  return ticks;
};

export const getTimeTicks = (domain: [Date, Date], period: ChartPeriod, width: number) => {
  const [from, to] = domain;
  const maxTicks = Math.max(2, Math.floor(width / 95));

  if (period === 'day') {
    const stepHours = maxTicks >= 8 ? 3 : maxTicks >= 5 ? 6 : 12;
    return pushTicksByStep(startOfDay(from), to, stepHours * MS_IN_HOUR);
  }

  const days = Math.max(1, Math.ceil((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_IN_DAY) + 1);
  const dayStep = Math.max(1, Math.ceil(days / maxTicks));
  return pushTicksByStep(startOfDay(from), to, dayStep * MS_IN_DAY);
};

export const formatTick = (date: Date, period: ChartPeriod) => {
  if (period === 'day') {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  if (period === 'week') {
    const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '');
    const day = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    return `${weekday} ${day}`;
  }

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

export const formatPeriodRange = (point: { bucketStart: string; bucketEnd: string }, period: ChartPeriod) => {
  const start = toDate(point.bucketStart);
  const end = toDate(point.bucketEnd);

  if (start.getTime() === end.getTime()) {
    return start.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  if (period === 'day') {
    return `${start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  return start.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const makeTooltipLines = (
  title: string,
  values: {
    temperature: number;
    setpoint: number;
    power?: number | null;
    minTemp?: number;
    maxTemp?: number;
    count?: number;
  },
) => [
  title,
  `Температура: ${values.temperature.toFixed(1)}°C`,
  `Уставка: ${values.setpoint.toFixed(1)}°C`,
  values.power !== undefined && values.power !== null ? `Мощность: ${values.power.toFixed(2)}` : null,
  values.minTemp !== undefined && values.maxTemp !== undefined ? `Мин/макс: ${values.minTemp.toFixed(1)} / ${values.maxTemp.toFixed(1)}°C` : null,
  values.count !== undefined ? `Измерений: ${values.count}` : null,
].filter((line): line is string => Boolean(line));
