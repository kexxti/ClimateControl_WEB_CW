import { buildingHistory, selectedRoomHistory } from '../data/mockData';
import { getRoomHistory, getRooms } from '../repositories/roomRepository';
import type { Algorithm } from '../types/climate';

export const getDashboardData = async () => {
  const rooms = await getRooms();
  const totalRooms = rooms.length;
  const avgTemp = totalRooms > 0 ? rooms.reduce((sum, room) => sum + room.currentTemp, 0) / totalRooms : 0;
  const roomsOutsideSetpoint = rooms.filter((room) => Math.abs(room.currentTemp - room.setpoint) >= 1).length;
  const activeAlgorithms = rooms.reduce<Record<Algorithm, number>>(
    (acc, room) => ({ ...acc, [room.algorithm]: acc[room.algorithm] + 1 }),
    { PID: 0, 'On/Off': 0, Time: 0, ML: 0 },
  );

  const roomHistoryEntries = await Promise.all(rooms.map(async (room) => [room.roomID, await getRoomHistory(room)] as const));

  return {
    statistics: {
      totalRooms,
      avgTemp: Number(avgTemp.toFixed(1)),
      roomsOutsideSetpoint,
      activeAlgorithms,
    },
    rooms,
    selectedRoomHistory,
    roomHistories: Object.fromEntries(roomHistoryEntries),
    buildingHistory,
  };
};
