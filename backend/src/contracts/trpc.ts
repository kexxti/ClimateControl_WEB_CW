import { z } from 'zod';
import { algorithmSchema, climateModeSchema, controlModeSchema, isoDateStringSchema, roomStatusSchema } from './common';

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
  temp: z.number(),
  setpoint: z.number(),
});

export const buildingHistoryPointSchema = z.object({
  time: z.string(),
  avgTemp: z.number(),
  avgSetpoint: z.number(),
});

export const pidParamsSchema = z.object({
  kp: z.number(),
  ki: z.number(),
  kd: z.number(),
  hysteresis: z.number(),
});

export const getRoomInputSchema = z.object({
  roomID: z.string().min(1),
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

export const roomDetailsOutputSchema = z.object({
  room: roomSchema.nullable(),
  history: z.array(roomHistoryPointSchema),
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
    theme: z.string(),
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

export const logsFilterInputSchema = z.object({
  roomID: z.string().optional(),
  deviceUid: z.string().optional(),
  level: z.string().optional(),
  dateFrom: isoDateStringSchema.optional(),
  dateTo: isoDateStringSchema.optional(),
});
