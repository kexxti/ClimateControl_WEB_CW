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

export const selectedRoomHistory = [
  { time: '09:00', temp: 21.5, setpoint: 23 },
  { time: '10:00', temp: 22.1, setpoint: 23 },
  { time: '11:00', temp: 22.8, setpoint: 23 },
  { time: '12:00', temp: 23.4, setpoint: 23 },
  { time: '13:00', temp: 23.1, setpoint: 23 },
  { time: '14:00', temp: 22.7, setpoint: 23 },
] satisfies RoomHistoryPoint[];

export const buildingHistory = [
  { time: '09:00', avgTemp: 21.4, avgSetpoint: 22.4 },
  { time: '10:00', avgTemp: 21.8, avgSetpoint: 22.3 },
  { time: '11:00', avgTemp: 22.6, avgSetpoint: 22.5 },
  { time: '12:00', avgTemp: 22.1, avgSetpoint: 22.4 },
  { time: '13:00', avgTemp: 22.9, avgSetpoint: 22.5 },
  { time: '14:00', avgTemp: 22.5, avgSetpoint: 22.4 },
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
    theme: 'system',
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
