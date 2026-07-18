import type { BuildingHistoryPoint, HistoryMeta, Room, RoomHistoryPoint } from '@WEB_CW/backend/src/types/climate';

export type RoomListItem = Room;

export type DashboardData = {
  rooms: Room[];
  selectedRoomHistory: RoomHistoryPoint[];
  roomHistories: Record<string, RoomHistoryPoint[]>;
  buildingHistory: BuildingHistoryPoint[];
  historyMeta: HistoryMeta;
};
