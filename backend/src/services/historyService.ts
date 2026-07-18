import type { HistoryBucket, HistoryMeta, HistoryPeriod, RoomHistoryPoint } from '../types/climate';

type ResolvedHistoryBucket = Exclude<HistoryBucket, 'auto'>;

type MeasurementLike = {
  createdAt: Date;
  temperature: unknown;
  setpointValue?: unknown;
  power?: unknown;
};

type SetpointLike = {
  createdAt: Date;
  value: unknown;
};

type HistoryRangeInput = {
  period?: HistoryPeriod;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  bucket?: HistoryBucket;
};

type BuildHistoryInput = {
  measurements: MeasurementLike[];
  setpoints: SetpointLike[];
  currentTemp: number;
  currentSetpoint: number;
  settingsUpdatedAt?: Date;
  period?: HistoryPeriod;
  dateFrom?: Date;
  dateTo?: Date;
  bucket?: HistoryBucket;
  appendCurrentPoint?: boolean;
};

const MS_IN_MINUTE = 60 * 1000;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
const MS_IN_DAY = 24 * MS_IN_HOUR;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const startOfWeek = (date: Date) => {
  const start = startOfDay(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return start;
};

const endOfWeek = (date: Date) => {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return endOfDay(end);
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

const toDate = (value: string | Date | undefined, fallback: Date) => {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const getBucketDurationMs = (bucket: ResolvedHistoryBucket) => {
  if (bucket === 'minute') {
    return MS_IN_MINUTE;
  }

  if (bucket === '15m') {
    return 15 * MS_IN_MINUTE;
  }

  if (bucket === '30m') {
    return 30 * MS_IN_MINUTE;
  }

  if (bucket === 'hour') {
    return MS_IN_HOUR;
  }

  if (bucket === 'day') {
    return MS_IN_DAY;
  }

  return 0;
};

const floorToBucket = (date: Date, bucket: ResolvedHistoryBucket) => {
  if (bucket === 'raw') {
    return new Date(date);
  }

  if (bucket === 'day') {
    return startOfDay(date);
  }

  const durationMs = getBucketDurationMs(bucket);
  return new Date(Math.floor(date.getTime() / durationMs) * durationMs);
};

const getBucketEnd = (bucketStart: Date, bucket: ResolvedHistoryBucket) => {
  if (bucket === 'raw') {
    return new Date(bucketStart);
  }

  if (bucket === 'day') {
    return endOfDay(bucketStart);
  }

  return new Date(bucketStart.getTime() + getBucketDurationMs(bucket) - 1);
};

const resolveHistoryBucket = (
  period: HistoryPeriod,
  dateFrom: Date,
  dateTo: Date,
  measurementsCount: number,
  bucket: HistoryBucket = 'auto',
): ResolvedHistoryBucket => {
  if (bucket !== 'auto') {
    return bucket;
  }

  if (period === 'week' || period === 'month') {
    return 'day';
  }

  const durationMs = dateTo.getTime() - dateFrom.getTime();

  if (period === 'custom' && durationMs > 2 * MS_IN_DAY) {
    return 'day';
  }

  if (measurementsCount > 288) {
    return 'hour';
  }

  if (measurementsCount > 96) {
    return '30m';
  }

  if (measurementsCount > 48) {
    return '15m';
  }

  return 'minute';
};

export const getHistoryRange = (input?: HistoryRangeInput): { dateFrom: Date; dateTo: Date; period: HistoryPeriod } => {
  const now = new Date();
  const period = input?.period ?? 'day';

  if (period === 'custom') {
    return {
      period,
      dateFrom: startOfDay(toDate(input?.dateFrom, now)),
      dateTo: endOfDay(toDate(input?.dateTo, now)),
    };
  }

  if (period === 'week') {
    return {
      period,
      dateFrom: startOfWeek(now),
      dateTo: endOfWeek(now),
    };
  }

  if (period === 'month') {
    return {
      period,
      dateFrom: startOfMonth(now),
      dateTo: endOfMonth(now),
    };
  }

  return {
    period,
    dateFrom: startOfDay(now),
    dateTo: endOfDay(now),
  };
};

export const formatHistoryPointTime = (date: Date, period: HistoryPeriod = 'day') => {
  if (period === 'week') {
    const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '');
    const day = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    return `${weekday} ${day}`;
  }

  if (period === 'month' || period === 'custom') {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toNumber = (value: unknown, fallback: number) => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const average = (values: number[], fallback = 0) => {
  if (values.length === 0) {
    return fallback;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const averageNullable = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }

  return Number(average(values).toFixed(2));
};

const getSetpointAt = (date: Date, setpoints: SetpointLike[], measurementSetpoint: unknown, fallback: number) => {
  const matchingSetpoint = [...setpoints]
    .filter((setpoint) => setpoint.createdAt.getTime() <= date.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  if (matchingSetpoint) {
    return toNumber(matchingSetpoint.value, fallback);
  }

  return toNumber(measurementSetpoint, fallback);
};

const hasSetpointChange = (bucketStart: Date, bucketEnd: Date, setpoints: SetpointLike[]) =>
  setpoints.some(
    (setpoint) =>
      setpoint.createdAt.getTime() >= bucketStart.getTime() && setpoint.createdAt.getTime() <= bucketEnd.getTime(),
  );

export const buildHistoryMeta = (
  period: HistoryPeriod,
  dateFrom: Date,
  dateTo: Date,
  bucket: ResolvedHistoryBucket,
): HistoryMeta => ({
  period,
  bucket,
  dateFrom: dateFrom.toISOString(),
  dateTo: dateTo.toISOString(),
});

export const buildRoomHistoryPoints = ({
  measurements,
  setpoints,
  currentTemp,
  currentSetpoint,
  settingsUpdatedAt,
  period = 'day',
  dateFrom,
  dateTo,
  bucket = 'auto',
  appendCurrentPoint = true,
}: BuildHistoryInput): RoomHistoryPoint[] => {
  const range = getHistoryRange({ period, dateFrom, dateTo });
  const sortedMeasurements = [...measurements].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const sortedSetpoints = [...setpoints].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const resolvedBucket = resolveHistoryBucket(period, range.dateFrom, range.dateTo, sortedMeasurements.length, bucket);

  if (sortedMeasurements.length === 0) {
    const now = new Date();

    return [
      {
        time: period === 'day' ? 'Сейчас' : formatHistoryPointTime(now, period),
        timestamp: now.toISOString(),
        bucketStart: now.toISOString(),
        bucketEnd: now.toISOString(),
        temp: currentTemp,
        setpoint: currentSetpoint,
        power: null,
        minTemp: currentTemp,
        maxTemp: currentTemp,
        count: 0,
        setpointChanged: false,
        isAggregated: false,
      },
    ];
  }

  const buckets = new Map<
    string,
    {
      bucketStart: Date;
      bucketEnd: Date;
      measurements: MeasurementLike[];
    }
  >();

  sortedMeasurements.forEach((measurement) => {
    const bucketStart = floorToBucket(measurement.createdAt, resolvedBucket);
    const bucketEnd = getBucketEnd(bucketStart, resolvedBucket);
    const key = bucketStart.toISOString();
    const currentBucket = buckets.get(key) ?? { bucketStart, bucketEnd, measurements: [] };
    currentBucket.measurements.push(measurement);
    buckets.set(key, currentBucket);
  });

  const history = [...buckets.values()]
    .sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime())
    .map((bucketItem) => {
      const temps = bucketItem.measurements.map((measurement) => toNumber(measurement.temperature, currentTemp));
      const setpointValues = bucketItem.measurements.map((measurement) =>
        getSetpointAt(measurement.createdAt, sortedSetpoints, measurement.setpointValue, currentSetpoint),
      );
      const powerValues = bucketItem.measurements
        .map((measurement) => (measurement.power === null || measurement.power === undefined ? null : Number(measurement.power)))
        .filter((value): value is number => value !== null && Number.isFinite(value));
      const bucketTime = resolvedBucket === 'raw' ? bucketItem.measurements[0].createdAt : bucketItem.bucketStart;

      return {
        time: formatHistoryPointTime(bucketTime, period),
        timestamp: bucketTime.toISOString(),
        bucketStart: bucketItem.bucketStart.toISOString(),
        bucketEnd: bucketItem.bucketEnd.toISOString(),
        temp: Number(average(temps, currentTemp).toFixed(1)),
        setpoint: Number(average(setpointValues, currentSetpoint).toFixed(1)),
        power: averageNullable(powerValues),
        minTemp: Number(Math.min(...temps).toFixed(1)),
        maxTemp: Number(Math.max(...temps).toFixed(1)),
        count: bucketItem.measurements.length,
        setpointChanged: hasSetpointChange(bucketItem.bucketStart, bucketItem.bucketEnd, sortedSetpoints),
        isAggregated: resolvedBucket !== 'raw' || bucketItem.measurements.length > 1,
      };
    });

  if (!appendCurrentPoint) {
    return history;
  }

  const latestMeasurement = sortedMeasurements[sortedMeasurements.length - 1];
  const latestPoint = history[history.length - 1];
  const setpointChangedAfterLatestMeasurement =
    settingsUpdatedAt && settingsUpdatedAt.getTime() > latestMeasurement.createdAt.getTime();
  const latestPointHasOldSetpoint = Number(latestPoint.setpoint.toFixed(2)) !== Number(currentSetpoint.toFixed(2));
  const now = new Date();

  if (setpointChangedAfterLatestMeasurement || latestPointHasOldSetpoint) {
    const latestPower =
      latestMeasurement.power === null || latestMeasurement.power === undefined ? null : Number(latestMeasurement.power);
    const currentBucketStart = floorToBucket(now, resolvedBucket);
    const currentBucketEnd = getBucketEnd(currentBucketStart, resolvedBucket);

    if (latestPoint.bucketStart === currentBucketStart.toISOString()) {
      return [
        ...history.slice(0, -1),
        {
          ...latestPoint,
          timestamp: now.toISOString(),
          bucketEnd: currentBucketEnd.toISOString(),
          setpoint: currentSetpoint,
          setpointChanged: true,
        },
      ];
    }

    return [
      ...history,
      {
        time: 'Сейчас',
        timestamp: now.toISOString(),
        bucketStart: currentBucketStart.toISOString(),
        bucketEnd: currentBucketEnd.toISOString(),
        temp: toNumber(latestMeasurement.temperature, currentTemp),
        setpoint: currentSetpoint,
        power: latestPower !== null && Number.isFinite(latestPower) ? latestPower : null,
        minTemp: toNumber(latestMeasurement.temperature, currentTemp),
        maxTemp: toNumber(latestMeasurement.temperature, currentTemp),
        count: 1,
        setpointChanged: true,
        isAggregated: false,
      },
    ];
  }

  return history;
};

export const resolveHistoryMeta = (
  input: HistoryRangeInput | undefined,
  measurementsCount: number,
): HistoryMeta => {
  const range = getHistoryRange(input);
  const bucket = resolveHistoryBucket(range.period, range.dateFrom, range.dateTo, measurementsCount, input?.bucket);
  return buildHistoryMeta(range.period, range.dateFrom, range.dateTo, bucket);
};
