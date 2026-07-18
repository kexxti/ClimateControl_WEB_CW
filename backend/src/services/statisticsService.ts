import { prisma } from '../lib/prisma';
import { getRecentImportantEvents } from '../repositories/eventRepository';
import { getRooms } from '../repositories/roomRepository';
import { buildRoomHistoryPoints, getHistoryRange, resolveHistoryMeta } from './historyService';
import type { BuildingHistoryPoint, HistoryBucket, HistoryMeta, Room, RoomHistoryPoint, RoomStatus } from '../types/climate';

type StatisticsPeriod = 'day' | 'week' | 'month' | 'custom';

type StatisticsAnalyticsInput = {
  roomIDs?: string[];
  period?: StatisticsPeriod;
  dateFrom?: string;
  dateTo?: string;
  bucket?: HistoryBucket;
};

const buildRoomHistories = async (
  rooms: Room[],
  period: StatisticsPeriod,
  dateFrom: Date,
  dateTo: Date,
  bucket?: HistoryBucket,
): Promise<{ roomHistories: Record<string, RoomHistoryPoint[]>; historyMeta: HistoryMeta }> => {
  let maxMeasurementsCount = 0;
  const entries = await Promise.all(
    rooms.map(async (room) => {
      const roomId = BigInt(room.id ?? 0);
      const [measurements, setpoints, settings] = await Promise.all([
        prisma.measurement.findMany({
          where: {
            roomId,
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        }),
        prisma.setpoint.findMany({
          where: {
            roomId,
            createdAt: {
              lte: dateTo,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        }),
        prisma.roomSetting.findUnique({
          where: {
            roomId,
          },
        }),
      ]);
      maxMeasurementsCount = Math.max(maxMeasurementsCount, measurements.length);

      const history = buildRoomHistoryPoints({
        measurements,
        setpoints,
        currentTemp: room.currentTemp,
        currentSetpoint: room.setpoint,
        settingsUpdatedAt: settings?.updatedAt,
        period,
        dateFrom,
        dateTo,
        bucket,
        appendCurrentPoint: dateTo.getTime() >= Date.now() - 60 * 1000,
      });

      return [room.roomID, history] as const;
    }),
  );

  return {
    roomHistories: Object.fromEntries(entries),
    historyMeta: resolveHistoryMeta({ period, dateFrom, dateTo, bucket }, maxMeasurementsCount),
  };
};

const buildBuildingHistory = (roomHistories: Record<string, RoomHistoryPoint[]>): BuildingHistoryPoint[] => {
  const buckets = new Map<
    string,
    {
      time: string;
      timestamp: string;
      bucketStart: string;
      bucketEnd: string;
      temps: number[];
      setpoints: number[];
      powers: number[];
      minTemps: number[];
      maxTemps: number[];
      count: number;
    }
  >();

  Object.values(roomHistories).forEach((history) => {
    history.forEach((point) => {
      const bucket = buckets.get(point.bucketStart) ?? {
        time: point.time,
        timestamp: point.timestamp,
        bucketStart: point.bucketStart,
        bucketEnd: point.bucketEnd,
        temps: [],
        setpoints: [],
        powers: [],
        minTemps: [],
        maxTemps: [],
        count: 0,
      };
      bucket.temps.push(point.temp);
      bucket.setpoints.push(point.setpoint);
      if (point.power !== null) {
        bucket.powers.push(point.power);
      }
      bucket.minTemps.push(point.minTemp);
      bucket.maxTemps.push(point.maxTemp);
      bucket.count += point.count;
      buckets.set(point.bucketStart, bucket);
    });
  });

  return [...buckets.values()].map((bucket) => ({
    time: bucket.time,
    timestamp: bucket.timestamp,
    bucketStart: bucket.bucketStart,
    bucketEnd: bucket.bucketEnd,
    avgTemp: Number((bucket.temps.reduce((sum, value) => sum + value, 0) / bucket.temps.length).toFixed(1)),
    avgSetpoint: Number((bucket.setpoints.reduce((sum, value) => sum + value, 0) / bucket.setpoints.length).toFixed(1)),
    avgPower:
      bucket.powers.length > 0
        ? Number((bucket.powers.reduce((sum, value) => sum + value, 0) / bucket.powers.length).toFixed(2))
        : null,
    minTemp: Number(Math.min(...bucket.minTemps).toFixed(1)),
    maxTemp: Number(Math.max(...bucket.maxTemps).toFixed(1)),
    count: bucket.count,
  }));
};

const getLatestPoint = (history: RoomHistoryPoint[]) => history[history.length - 1];

export const getStatisticsAnalytics = async (input?: StatisticsAnalyticsInput) => {
  const rooms = await getRooms();
  const effectiveRooms = input?.roomIDs?.length ? rooms.filter((room) => input.roomIDs?.includes(room.roomID)) : rooms;
  const period = input?.period ?? 'day';
  const { dateFrom, dateTo } = getHistoryRange(input);
  const { roomHistories, historyMeta } = await buildRoomHistories(effectiveRooms, period, dateFrom, dateTo, input?.bucket);

  const setpointComparison = effectiveRooms.map((room) => {
    const latestPoint = getLatestPoint(roomHistories[room.roomID] ?? []);

    return {
      roomID: room.roomID,
      name: room.name,
      currentTemp: latestPoint?.temp ?? room.currentTemp,
      setpoint: latestPoint?.setpoint ?? room.setpoint,
      error: Number(Math.abs((latestPoint?.temp ?? room.currentTemp) - (latestPoint?.setpoint ?? room.setpoint)).toFixed(1)),
    };
  });

  const stateLabels: Record<RoomStatus, string> = {
    heating: 'Нагрев',
    cooling: 'Охлаждение',
    stable: 'Поддержка',
    offline: 'Оффлайн',
    error: 'Ошибка',
  };
  const states: RoomStatus[] = ['heating', 'cooling', 'stable', 'offline', 'error'];
  const stateDistribution = states.map((status) => ({
    status,
    label: stateLabels[status],
    value: effectiveRooms.filter((room) => room.status === status).length,
  }));

  const totalRooms = effectiveRooms.length;
  const avgTemp =
    totalRooms > 0 ? setpointComparison.reduce((sum, room) => sum + room.currentTemp, 0) / totalRooms : 0;
  const roomsOutsideSetpoint = setpointComparison.filter((room) => room.error >= 1).length;
  const activeAlgorithms = effectiveRooms.reduce<Record<Room['algorithm'], number>>(
    (acc, room) => ({ ...acc, [room.algorithm]: acc[room.algorithm] + 1 }),
    { PID: 0, 'On/Off': 0, Time: 0, ML: 0 },
  );
  const buildingHistory = buildBuildingHistory(roomHistories);
  const selectedRoomHistory = Object.values(roomHistories)[0] ?? [];
  const recentEvents = await getRecentImportantEvents();

  const allErrors = Object.values(roomHistories)
    .flat()
    .map((point) => Math.abs(point.temp - point.setpoint));
  const errors = allErrors.length > 0 ? allErrors : setpointComparison.map((room) => room.error);
  const avgError = errors.length > 0 ? errors.reduce((sum, error) => sum + error, 0) / errors.length : 0;
  const maxDeviation = errors.length > 0 ? Math.max(...errors) : 0;
  const energyConsumption = Object.values(roomHistories)
    .flat()
    .reduce((sum, point) => sum + Math.abs(point.temp - point.setpoint) * 1.8 + 2, 0);

  return {
    statistics: {
      totalRooms,
      avgTemp: Number(avgTemp.toFixed(1)),
      roomsOutsideSetpoint,
      activeAlgorithms,
    },
    rooms: effectiveRooms,
    selectedRoomHistory,
    roomHistories,
    buildingHistory,
    historyMeta,
    recentEvents,
    setpointComparison,
    stateDistribution,
    numericIndicators: {
      avgTemp: Number(avgTemp.toFixed(1)),
      avgError: Number(avgError.toFixed(1)),
      maxDeviation: Number(maxDeviation.toFixed(1)),
      energyConsumption: Number(energyConsumption.toFixed(1)),
    },
  };
};

export const getStatisticsData = async () => {
  return getStatisticsAnalytics();
};
