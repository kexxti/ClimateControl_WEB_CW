import { getRecentImportantEvents } from '../repositories/eventRepository';
import { getRoomHistory, getRooms } from '../repositories/roomRepository';
import type { Algorithm } from '../types/climate';

const buildBuildingHistory = (roomHistories: Record<string, Awaited<ReturnType<typeof getRoomHistory>>>) => {
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

export const getDashboardSummary = async () => {
  const rooms = await getRooms();
  const totalRooms = rooms.length;
  const avgTemp = totalRooms > 0 ? rooms.reduce((sum, room) => sum + room.currentTemp, 0) / totalRooms : 0;
  const roomsOutsideSetpoint = rooms.filter((room) => Math.abs(room.currentTemp - room.setpoint) >= 1).length;
  const activeAlgorithms = rooms.reduce<Record<Algorithm, number>>(
    (acc, room) => ({ ...acc, [room.algorithm]: acc[room.algorithm] + 1 }),
    { PID: 0, 'On/Off': 0, Time: 0, ML: 0 },
  );

  const roomHistoryEntries = await Promise.all(rooms.map(async (room) => [room.roomID, await getRoomHistory(room)] as const));
  const roomHistories = Object.fromEntries(roomHistoryEntries);
  const selectedRoomHistory = roomHistoryEntries[0]?.[1] ?? [];
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
    recentEvents,
  };
};

export const getDashboardData = getDashboardSummary;
