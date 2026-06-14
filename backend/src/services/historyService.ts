import type { RoomHistoryPoint } from '../types/climate';

type HistoryPeriod = 'day' | 'week' | 'month' | 'custom';

type MeasurementLike = {
  createdAt: Date;
  temperature: unknown;
  setpointValue?: unknown;
};

type SetpointLike = {
  createdAt: Date;
  value: unknown;
};

type BuildHistoryInput = {
  measurements: MeasurementLike[];
  setpoints: SetpointLike[];
  currentTemp: number;
  currentSetpoint: number;
  settingsUpdatedAt?: Date;
  period?: HistoryPeriod;
  appendCurrentPoint?: boolean;
};

export const formatHistoryPointTime = (date: Date, period: HistoryPeriod = 'day') => {
  if (period === 'month' || period === 'week' || period === 'custom') {
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

const getSetpointAt = (date: Date, setpoints: SetpointLike[], measurementSetpoint: unknown, fallback: number) => {
  const matchingSetpoint = [...setpoints]
    .filter((setpoint) => setpoint.createdAt.getTime() <= date.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  if (matchingSetpoint) {
    return toNumber(matchingSetpoint.value, fallback);
  }

  return toNumber(measurementSetpoint, fallback);
};

export const buildRoomHistoryPoints = ({
  measurements,
  setpoints,
  currentTemp,
  currentSetpoint,
  settingsUpdatedAt,
  period = 'day',
  appendCurrentPoint = true,
}: BuildHistoryInput): RoomHistoryPoint[] => {
  const sortedMeasurements = [...measurements].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const sortedSetpoints = [...setpoints].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const history = sortedMeasurements.map((measurement) => ({
    time: formatHistoryPointTime(measurement.createdAt, period),
    temp: toNumber(measurement.temperature, currentTemp),
    setpoint: getSetpointAt(measurement.createdAt, sortedSetpoints, measurement.setpointValue, currentSetpoint),
  }));

  if (history.length === 0) {
    return [
      {
        time: 'Сейчас',
        temp: currentTemp,
        setpoint: currentSetpoint,
      },
    ];
  }

  if (!appendCurrentPoint) {
    return history;
  }

  const latestMeasurement = sortedMeasurements[sortedMeasurements.length - 1];
  const latestPoint = history[history.length - 1];
  const setpointChangedAfterLatestMeasurement =
    settingsUpdatedAt && settingsUpdatedAt.getTime() > latestMeasurement.createdAt.getTime();
  const latestPointHasOldSetpoint = Number(latestPoint.setpoint.toFixed(2)) !== Number(currentSetpoint.toFixed(2));

  if (setpointChangedAfterLatestMeasurement || latestPointHasOldSetpoint) {
    return [
      ...history,
      {
        time: 'Сейчас',
        temp: toNumber(latestMeasurement.temperature, currentTemp),
        setpoint: currentSetpoint,
      },
    ];
  }

  return history;
};
