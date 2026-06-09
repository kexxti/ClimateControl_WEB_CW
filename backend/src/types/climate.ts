export type UserRole = 'admin' | 'user';

export type Algorithm = 'PID' | 'On/Off' | 'Time' | 'ML';

export type AlgorithmCode = 'PID' | 'ON_OFF' | 'TIME' | 'ML';

export type RoomStatus = 'heating' | 'cooling' | 'stable' | 'offline' | 'error';

export type ClimateMode = 'standard' | 'energySaving' | 'energy_saving' | 'night' | 'manual';

export type ControlMode = 'local' | 'remote' | 'failsafe';

export type CommandType =
  | 'SET_SETPOINT'
  | 'SET_ALGORITHM'
  | 'SET_PID_PARAMS'
  | 'SET_MODE'
  | 'SET_CONTROL_MODE'
  | 'SET_CYCLE_CONFIG'
  | 'SET_SAFETY_LIMITS'
  | 'REBOOT_DEVICE'
  | 'REQUEST_STATUS';

export type CommandStatus = 'pending' | 'sent' | 'acknowledged' | 'failed' | 'expired';

export type CommandAckStatus =
  | 'applied'
  | 'rejected_local_mode'
  | 'rejected_invalid_payload'
  | 'rejected_safety'
  | 'queued_desired_config'
  | 'failed'
  | 'expired';

export type SettingScope = 'system' | 'user' | 'room';

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export type SetpointSource = 'manual' | 'schedule' | 'algorithm' | 'system' | 'potentiometer' | 'remote' | 'default' | 'failsafe';

export type SystemState = 'normal' | 'heating' | 'stable' | 'overheat' | 'sensor_error' | 'offline' | 'error';

export type Room = {
  id?: number;
  roomID: string;
  name: string;
  location?: string | null;
  floor?: number | null;
  currentTemp: number;
  setpoint: number;
  algorithm: Algorithm;
  status: RoomStatus;
  controlMode?: ControlMode;
  isActive?: boolean;
};

export type RoomHistoryPoint = {
  time: string;
  temp: number;
  setpoint: number;
};

export type BuildingHistoryPoint = {
  time: string;
  avgTemp: number;
  avgSetpoint: number;
};

export type PidParams = {
  kp: number;
  ki: number;
  kd: number;
  hysteresis: number;
};

export type Device = {
  id: number;
  roomId: number;
  deviceUid: string;
  name: string;
  firmwareVersion?: string | null;
  ipAddress?: string | null;
  lastSeenAt?: string | null;
  isOnline: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Measurement = {
  id: number;
  roomId: number;
  deviceId: number;
  temperature: number;
  humidity?: number | null;
  outsideTemperature?: number | null;
  power?: number | null;
  setpointValue?: number | null;
  heaterState?: boolean | null;
  coolerState?: boolean | null;
  algorithmId?: number | null;
  deviceSequence?: number | null;
  deviceUptimeMs?: number | null;
  rawPayload?: unknown;
  createdAt: string;
  receivedAt: string;
};

export type DeviceCommand = {
  id: number;
  deviceId: number;
  roomId: number;
  type: CommandType;
  payload: unknown;
  status: CommandStatus;
  createdByUserId?: number | null;
  createdAt: string;
  sentAt?: string | null;
  acknowledgedAt?: string | null;
  failedAt?: string | null;
  expiresAt?: string | null;
  errorMessage?: string | null;
};

export type DeviceLog = {
  id: number;
  deviceId: number;
  roomId?: number | null;
  level: LogLevel;
  type: string;
  message: string;
  payload?: unknown;
  deviceSequence?: number | null;
  deviceUptimeMs?: number | null;
  createdAt: string;
  receivedAt: string;
};

export type Event = {
  id: number;
  roomId?: number | null;
  deviceId?: number | null;
  userId?: number | null;
  type: string;
  severity: EventSeverity;
  message: string;
  payload?: unknown;
  createdAt: string;
};
