import { z } from 'zod';
import {
  algorithmSchema,
  climateModeSchema,
  controlModeSchema,
  eventSeveritySchema,
  isoDateStringSchema,
  logLevelSchema,
  roomStatusSchema,
  userRoleSchema,
} from './common';

export const roomSchema = z.object({
  id: z.number().int().positive().optional(),
  roomID: z.string(),
  name: z.string(),
  location: z.string().nullable().optional(),
  floor: z.number().int().nullable().optional(),
  currentTemp: z.number(),
  setpoint: z.number(),
  algorithm: algorithmSchema,
  status: roomStatusSchema,
  controlMode: controlModeSchema.optional(),
  isActive: z.boolean().optional(),
});

export const roomHistoryPointSchema = z.object({
  time: z.string(),
  timestamp: isoDateStringSchema,
  bucketStart: isoDateStringSchema,
  bucketEnd: isoDateStringSchema,
  temp: z.number(),
  setpoint: z.number(),
  power: z.number().nullable(),
  minTemp: z.number(),
  maxTemp: z.number(),
  count: z.number().int().nonnegative(),
  setpointChanged: z.boolean(),
  isAggregated: z.boolean(),
});

export const buildingHistoryPointSchema = z.object({
  time: z.string(),
  timestamp: isoDateStringSchema,
  bucketStart: isoDateStringSchema,
  bucketEnd: isoDateStringSchema,
  avgTemp: z.number(),
  avgSetpoint: z.number(),
  avgPower: z.number().nullable(),
  minTemp: z.number(),
  maxTemp: z.number(),
  count: z.number().int().nonnegative(),
});

export const pidParamsSchema = z.object({
  kp: z.number().min(0).max(100),
  ki: z.number().min(0).max(100),
  kd: z.number().min(0).max(100),
  hysteresis: z.number().min(0).max(20),
});

export const getRoomInputSchema = z.object({
  roomID: z.string().min(1),
  period: z.enum(['day', 'week', 'month', 'custom']).default('day').optional(),
  dateFrom: isoDateStringSchema.optional(),
  dateTo: isoDateStringSchema.optional(),
  bucket: z.enum(['auto', 'raw', 'minute', '15m', '30m', 'hour', 'day']).default('auto').optional(),
});

export const updateSetpointInputSchema = z.object({
  roomID: z.string().min(1),
  setpointValue: z.number().min(5).max(35),
});

export const updateAlgorithmInputSchema = z.object({
  roomID: z.string().min(1),
  algorithm: algorithmSchema,
});

export const updatePidParamsInputSchema = z.object({
  roomID: z.string().min(1),
  pidParams: pidParamsSchema,
});

export const createRoomInputSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  location: z.string().trim().max(255).optional(),
  floor: z.number().int().min(-5).max(100).optional(),
  setpoint: z.number().min(5).max(35),
  algorithm: algorithmSchema,
  criticalTemperature: z.number().min(5).max(80).default(35).optional(),
  deviceUid: z.string().trim().min(3).max(120).optional(),
  deviceName: z.string().trim().min(1).max(160).optional(),
});

export const softDeleteRoomInputSchema = z.object({
  roomID: z.string().min(1),
});

export const roomDetailsOutputSchema = z.object({
  room: roomSchema.nullable(),
  history: z.array(roomHistoryPointSchema),
  historyMeta: z.object({
    period: z.enum(['day', 'week', 'month', 'custom']),
    bucket: z.enum(['raw', 'minute', '15m', '30m', 'hour', 'day']),
    dateFrom: isoDateStringSchema,
    dateTo: isoDateStringSchema,
  }),
  pidParams: pidParamsSchema,
});

export const dashboardOutputSchema = z.object({
  statistics: z.object({
    totalRooms: z.number().int().nonnegative(),
    avgTemp: z.number(),
    roomsOutsideSetpoint: z.number().int().nonnegative(),
    activeAlgorithms: z.record(algorithmSchema, z.number().int().nonnegative()),
  }),
  rooms: z.array(roomSchema),
  selectedRoomHistory: z.array(roomHistoryPointSchema),
  roomHistories: z.record(z.string(), z.array(roomHistoryPointSchema)),
  buildingHistory: z.array(buildingHistoryPointSchema),
  historyMeta: z.object({
    period: z.enum(['day', 'week', 'month', 'custom']),
    bucket: z.enum(['raw', 'minute', '15m', '30m', 'hour', 'day']),
    dateFrom: isoDateStringSchema,
    dateTo: isoDateStringSchema,
  }),
  recentEvents: z.array(
    z.object({
      id: z.number().int().positive(),
      type: z.string(),
      severity: eventSeveritySchema,
      message: z.string(),
      createdAt: isoDateStringSchema,
      roomName: z.string().nullable(),
      deviceUid: z.string().nullable(),
    }),
  ),
});

export const statisticsOutputSchema = dashboardOutputSchema.extend({
  setpointComparison: z.array(
    z.object({
      roomID: z.string(),
      name: z.string(),
      currentTemp: z.number(),
      setpoint: z.number(),
      error: z.number(),
    }),
  ),
  stateDistribution: z.array(
    z.object({
      status: roomStatusSchema,
      label: z.string(),
      value: z.number().int().nonnegative(),
    }),
  ),
  numericIndicators: z.object({
    avgTemp: z.number(),
    avgError: z.number(),
    maxDeviation: z.number(),
    energyConsumption: z.number(),
  }),
});

export const settingsOutputSchema = z.object({
  application: z.object({
    theme: z.enum(['light', 'dark']),
    refreshInterval: z.string(),
    connectionProfile: z.string(),
  }),
  system: z.object({
    algorithm: algorithmSchema,
    mode: climateModeSchema,
    pidPreset: z.string(),
    applyTarget: z.string(),
  }),
  pidParams: pidParamsSchema,
});

export const updateApplicationSettingsInputSchema = z.object({
  theme: z.enum(['light', 'dark']),
  refreshInterval: z.string().min(1),
  connectionProfile: z.string().min(1),
});

export const updateSystemSettingsInputSchema = z.object({
  algorithm: algorithmSchema,
  mode: climateModeSchema,
  pidPreset: z.string().min(1),
  applyTarget: z.string().min(1),
  pidParams: pidParamsSchema,
});

export const applyAlgorithmToRoomsInputSchema = z.object({
  algorithm: algorithmSchema,
  target: z.enum(['all', 'selected', 'floor']).default('all'),
  roomIDs: z.array(z.string().min(1)).optional(),
  floor: z.number().int().optional(),
});

export const logsFilterInputSchema = z.object({
  roomID: z.string().optional(),
  deviceUid: z.string().optional(),
  level: logLevelSchema.optional(),
  dateFrom: isoDateStringSchema.optional(),
  dateTo: isoDateStringSchema.optional(),
  limit: z.number().int().positive().max(200).default(100),
});

export const recentEventsInputSchema = z
  .object({
    limit: z.number().int().positive().max(100).default(20),
  })
  .optional();

export const loginInputSchema = z.object({
  login: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
});

export const createUserInputSchema = z.object({
  login: z.string().min(3).max(120),
  password: z.string().min(6).max(200),
  role: userRoleSchema.default('user'),
});

export const updateUserRoleInputSchema = z.object({
  userId: z.number().int().positive(),
  role: userRoleSchema,
});

export const deactivateUserInputSchema = z.object({
  userId: z.number().int().positive(),
});

export const statisticsPeriodSchema = z.enum(['day', 'week', 'month', 'custom']);

export const statisticsAnalyticsInputSchema = z
  .object({
    roomIDs: z.array(z.string().min(1)).optional(),
    period: statisticsPeriodSchema.default('day'),
    dateFrom: isoDateStringSchema.optional(),
    dateTo: isoDateStringSchema.optional(),
    bucket: z.enum(['auto', 'raw', 'minute', '15m', '30m', 'hour', 'day']).default('auto').optional(),
  })
  .optional();
