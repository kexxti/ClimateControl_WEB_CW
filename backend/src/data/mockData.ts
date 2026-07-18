import type { Algorithm, BuildingHistoryPoint, ClimateMode, PidParams, Room, RoomHistoryPoint } from '../types/climate';

export const rooms = [
  {
    roomID: '203',
    name: 'Кабинет 203',
    currentTemp: 22.8,
    setpoint: 23,
    algorithm: 'PID',
    status: 'heating',
  },
  {
    roomID: '201',
    name: 'Кабинет 201',
    currentTemp: 21.2,
    setpoint: 20,
    algorithm: 'PID',
    status: 'cooling',
  },
  {
    roomID: '105',
    name: 'Кабинет 105',
    currentTemp: 23.5,
    setpoint: 23,
    algorithm: 'On/Off',
    status: 'stable',
  },
  {
    roomID: '118',
    name: 'Кабинет 118',
    currentTemp: 19.9,
    setpoint: 21,
    algorithm: 'Time',
    status: 'heating',
  },
  {
    roomID: '302',
    name: 'Кабинет 302',
    currentTemp: 24.1,
    setpoint: 22,
    algorithm: 'ML',
    status: 'cooling',
  },
] satisfies Room[];

const today = new Date();
today.setHours(0, 0, 0, 0);

const makeDate = (hour: number) => new Date(today.getTime() + hour * 60 * 60 * 1000);

const makeRoomHistoryPoint = (hour: number, temp: number, setpoint: number): RoomHistoryPoint => {
  const date = makeDate(hour);
  return {
    time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    timestamp: date.toISOString(),
    bucketStart: date.toISOString(),
    bucketEnd: date.toISOString(),
    temp,
    setpoint,
    power: null,
    minTemp: temp,
    maxTemp: temp,
    count: 1,
    setpointChanged: false,
    isAggregated: false,
  };
};

const makeBuildingHistoryPoint = (hour: number, avgTemp: number, avgSetpoint: number): BuildingHistoryPoint => {
  const date = makeDate(hour);
  return {
    time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    timestamp: date.toISOString(),
    bucketStart: date.toISOString(),
    bucketEnd: date.toISOString(),
    avgTemp,
    avgSetpoint,
    avgPower: null,
    minTemp: avgTemp,
    maxTemp: avgTemp,
    count: rooms.length,
  };
};

export const selectedRoomHistory = [
  makeRoomHistoryPoint(9, 21.5, 23),
  makeRoomHistoryPoint(10, 22.1, 23),
  makeRoomHistoryPoint(11, 22.8, 23),
  makeRoomHistoryPoint(12, 23.4, 23),
  makeRoomHistoryPoint(13, 23.1, 23),
  makeRoomHistoryPoint(14, 22.7, 23),
] satisfies RoomHistoryPoint[];

export const buildingHistory = [
  makeBuildingHistoryPoint(9, 21.4, 22.4),
  makeBuildingHistoryPoint(10, 21.8, 22.3),
  makeBuildingHistoryPoint(11, 22.6, 22.5),
  makeBuildingHistoryPoint(12, 22.1, 22.4),
  makeBuildingHistoryPoint(13, 22.9, 22.5),
  makeBuildingHistoryPoint(14, 22.5, 22.4),
] satisfies BuildingHistoryPoint[];

export const historyTimes = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

export const tempOffsets = [-1.2, -0.7, -0.2, 0.3, 0.1, -0.1];

export const defaultPidParams = {
  kp: 1.2,
  ki: 0.35,
  kd: 0.08,
  hysteresis: 0.4,
} satisfies PidParams;

export const settingsData = {
  application: {
    theme: 'light',
    refreshInterval: '30 sec',
    connectionProfile: 'localhost',
  },
  system: {
    algorithm: 'PID' as Algorithm,
    mode: 'standard' as ClimateMode,
    pidPreset: 'balanced',
    applyTarget: 'all',
  },
  pidParams: defaultPidParams,
};
