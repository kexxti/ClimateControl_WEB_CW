import { getRecentImportantEvents } from '../repositories/eventRepository';
import { getRoomHistory, getRooms } from '../repositories/roomRepository';
import type { Algorithm, BuildingHistoryPoint, RoomHistoryPoint } from '../types/climate';

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

export const getDashboardSummary = async () => {
  const rooms = await getRooms();
  const totalRooms = rooms.length;
  const avgTemp = totalRooms > 0 ? rooms.reduce((sum, room) => sum + room.currentTemp, 0) / totalRooms : 0;
  const roomsOutsideSetpoint = rooms.filter((room) => Math.abs(room.currentTemp - room.setpoint) >= 1).length;
  const activeAlgorithms = rooms.reduce<Record<Algorithm, number>>(
    (acc, room) => ({ ...acc, [room.algorithm]: acc[room.algorithm] + 1 }),
    { PID: 0, 'On/Off': 0, Time: 0, ML: 0 },
  );

  const roomHistoryResults = await Promise.all(
    rooms.map(async (room) => [room.roomID, await getRoomHistory(room, { period: 'day' })] as const),
  );
  const roomHistoryEntries = roomHistoryResults.map(([roomID, result]) => [roomID, result.history] as const);
  const roomHistories = Object.fromEntries(roomHistoryEntries);
  const selectedRoomHistory = roomHistoryEntries[0]?.[1] ?? [];
  const historyMeta = roomHistoryResults[0]?.[1].meta ?? {
    period: 'day' as const,
    bucket: 'raw' as const,
    dateFrom: new Date().toISOString(),
    dateTo: new Date().toISOString(),
  };
  const buildingHistory = buildBuildingHistory(roomHistories);
  const recentEvents = await getRecentImportantEvents();

  return {
    statistics: {
      totalRooms,
      avgTemp: Number(avgTemp.toFixed(1)),
      roomsOutsideSetpoint,
      activeAlgorithms,
    },
    rooms,
    selectedRoomHistory,
    roomHistories,
    buildingHistory,
    historyMeta,
    recentEvents,
  };
};

export const getDashboardData = getDashboardSummary;
