import { z } from 'zod';
import {
  algorithmCodeSchema,
  commandAckStatusSchema,
  commandTypeSchema,
  controlModeSchema,
  isoDateStringSchema,
  jsonObjectSchema,
  logLevelSchema,
  setpointSourceSchema,
  systemStateSchema,
} from './common';

export const deviceUidParamsSchema = z.object({
  deviceUid: z.string().min(1),
});

export const deviceCommandParamsSchema = deviceUidParamsSchema.extend({
  commandId: z.coerce.number().int().positive(),
});

export const deviceMessageBaseSchema = z.object({
  protocolVersion: z.string().min(1),
  messageId: z.string().min(1),
  deviceUid: z.string().min(1),
  deviceSequence: z.number().int().nonnegative(),
  deviceUptimeMs: z.number().int().nonnegative(),
});

export const deviceCapabilitiesSchema = z.object({
  localControl: z.boolean(),
  remoteControl: z.boolean(),
  pid: z.boolean(),
  temperature: z.boolean(),
  humidity: z.boolean(),
  co2: z.boolean(),
  airQuality: z.boolean(),
  heater: z.boolean(),
  cooler: z.boolean(),
  humidifier: z.boolean(),
  ventilation: z.boolean(),
});

export const deviceBootstrapBodySchema = deviceMessageBaseSchema.extend({
  hardware: z.object({
    controller: z.string(),
    wifiModule: z.string(),
    temperatureSensor: z.string(),
    display: z.string().optional(),
    heaterDriver: z.string().optional(),
  }),
  firmware: z.object({
    version: z.string(),
    build: z.string().optional(),
  }),
  capabilities: deviceCapabilitiesSchema,
});

export const heartbeatBodySchema = deviceMessageBaseSchema.extend({
  status: z.object({
    controlMode: controlModeSchema,
    systemState: systemStateSchema,
    wifiRssi: z.number().optional(),
    freeMemory: z.number().int().nonnegative().optional(),
  }),
});

export const actuatorsSchema = z.object({
  heater: z.boolean(),
  cooler: z.boolean().optional(),
  humidifier: z.boolean().optional(),
  ventilation: z.boolean().optional(),
});

export const safetySchema = z.object({
  overheat: z.boolean(),
  emergencyShutdown: z.boolean(),
  criticalTemperature: z.number(),
});

export const telemetryReadingSchema = z.object({
  sampleSequence: z.number().int().nonnegative(),
  sampleUptimeMs: z.number().int().nonnegative(),
  temperature: z.number(),
  humidity: z.number().nullable().optional(),
  outsideTemperature: z.number().nullable().optional(),
  setpointValue: z.number().nullable().optional(),
  controlMode: controlModeSchema,
  setpointSource: setpointSourceSchema,
  algorithm: algorithmCodeSchema,
  power: z.number().nullable().optional(),
  actuators: actuatorsSchema,
  pid: z
    .object({
      kp: z.number(),
      ki: z.number(),
      kd: z.number(),
      error: z.number().optional(),
      output: z.number().optional(),
    })
    .optional(),
  safety: safetySchema,
});

export const telemetryBatchBodySchema = deviceMessageBaseSchema.extend({
  readings: z.array(telemetryReadingSchema).min(1),
});

export const stateReportBodySchema = deviceMessageBaseSchema.extend({
  state: z.object({
    controlMode: controlModeSchema,
    systemState: systemStateSchema,
    temperature: z.number(),
    setpointValue: z.number(),
    localSetpointValue: z.number().nullable().optional(),
    remoteSetpointValue: z.number().nullable().optional(),
    setpointSource: setpointSourceSchema,
    algorithm: algorithmCodeSchema,
    cycleMs: z.number().int().positive(),
    display: z
      .object({
        type: z.string(),
        enabled: z.boolean(),
      })
      .optional(),
    inputs: z
      .object({
        potentiometerRaw: z.number().int().nonnegative().optional(),
        modeButtonPressed: z.boolean().optional(),
      })
      .optional(),
    actuators: actuatorsSchema.extend({
      heaterPwm: z.number().int().min(0).max(255).optional(),
    }),
    safety: safetySchema,
  }),
});

export const deviceLogItemSchema = z.object({
  logSequence: z.number().int().nonnegative(),
  level: logLevelSchema,
  type: z.string().min(1),
  message: z.string().min(1),
  uptimeMs: z.number().int().nonnegative().optional(),
  payload: jsonObjectSchema.optional(),
});

export const deviceLogsBatchBodySchema = deviceMessageBaseSchema.extend({
  logs: z.array(deviceLogItemSchema).min(1),
});

export const getCommandsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).default(5),
});

export const deviceCommandPayloadSchema = z.union([
  z.object({
    type: z.literal('SET_SETPOINT'),
    payload: z.object({
      setpointValue: z.number().min(5).max(35),
    }),
  }),
  z.object({
    type: z.literal('SET_CONTROL_MODE'),
    payload: z.object({
      controlMode: z.enum(['local', 'remote']),
    }),
  }),
  z.object({
    type: z.literal('SET_PID_PARAMS'),
    payload: z.object({
      kp: z.number(),
      ki: z.number(),
      kd: z.number(),
      hysteresis: z.number(),
    }),
  }),
  z.object({
    type: z.literal('SET_CYCLE_CONFIG'),
    payload: z.object({
      controlCycleMs: z.number().int().positive(),
      telemetryIntervalMs: z.number().int().positive(),
    }),
  }),
  z.object({
    type: z.literal('SET_SAFETY_LIMITS'),
    payload: z.object({
      criticalTemperature: z.number().min(5).max(60),
      restoreTemperature: z.number().min(5).max(60),
    }),
  }),
  z.object({
    type: z.literal('REQUEST_STATUS'),
    payload: z.object({}),
  }),
  z.object({
    type: z.literal('REBOOT_DEVICE'),
    payload: z.object({
      delayMs: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    type: commandTypeSchema,
    payload: jsonObjectSchema,
  }),
]);

export const commandAckBodySchema = deviceMessageBaseSchema.extend({
  success: z.boolean(),
  status: commandAckStatusSchema,
  message: z.string().optional(),
  appliedState: z
    .object({
      controlMode: controlModeSchema.optional(),
      setpointValue: z.number().optional(),
      algorithm: algorithmCodeSchema.optional(),
    })
    .optional(),
});

export const acceptedResponseSchema = z.object({
  accepted: z.boolean(),
  serverTime: isoDateStringSchema.optional(),
});
