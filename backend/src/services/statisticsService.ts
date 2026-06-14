import { prisma } from '../lib/prisma';
import { getRecentImportantEvents } from '../repositories/eventRepository';
import { getRooms } from '../repositories/roomRepository';
import { buildRoomHistoryPoints } from './historyService';
import type { Room, RoomHistoryPoint, RoomStatus } from '../types/climate';

type StatisticsPeriod = 'day' | 'week' | 'month' | 'custom';

type StatisticsAnalyticsInput = {
  roomIDs?: string[];
  period?: StatisticsPeriod;
  dateFrom?: string;
  dateTo?: string;
};

const getPeriodRange = (input?: StatisticsAnalyticsInput) => {
  const now = new Date();
  const period = input?.period ?? 'day';

  if (period === 'custom') {
    return {
      dateFrom: input?.dateFrom ? new Date(input.dateFrom) : new Date(now.getTime() - 24 * 60 * 60 * 1000),
      dateTo: input?.dateTo ? new Date(input.dateTo) : now,
    };
  }

  const durationMsByPeriod: Record<Exclude<StatisticsPeriod, 'custom'>, number> = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };

  return {
    dateFrom: new Date(now.getTime() - durationMsByPeriod[period]),
    dateTo: now,
  };
};

const buildRoomHistories = async (rooms: Room[], period: StatisticsPeriod, dateFrom: Date, dateTo: Date) => {
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

      const history = buildRoomHistoryPoints({
        measurements,
        setpoints,
        currentTemp: room.currentTemp,
        currentSetpoint: room.setpoint,
        settingsUpdatedAt: settings?.updatedAt,
        period,
        appendCurrentPoint: dateTo.getTime() >= Date.now() - 60 * 1000,
      });

      return [room.roomID, history] as const;
    }),
  );

  return Object.fromEntries(entries);
};

const buildBuildingHistory = (roomHistories: Record<string, RoomHistoryPoint[]>) => {
  const buckets = new Map<string, { temps: number[]; setpoints: number[] }>();

  Object.values(roomHistories).forEach((history) => {
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
};

const getLatestPoint = (history: RoomHistoryPoint[]) => history[history.length - 1];

export const getStatisticsAnalytics = async (input?: StatisticsAnalyticsInput) => {
  const rooms = await getRooms();
  const effectiveRooms = input?.roomIDs?.length ? rooms.filter((room) => input.roomIDs?.includes(room.roomID)) : rooms;
  const period = input?.period ?? 'day';
  const { dateFrom, dateTo } = getPeriodRange(input);
  const roomHistories = await buildRoomHistories(effectiveRooms, period, dateFrom, dateTo);

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
