import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'user']);

export const algorithmSchema = z.enum(['PID', 'On/Off', 'Time', 'ML']);

export const algorithmCodeSchema = z.enum(['PID', 'ON_OFF', 'TIME', 'ML']);

export const roomStatusSchema = z.enum(['heating', 'cooling', 'stable', 'offline', 'error']);

export const climateModeSchema = z.enum(['standard', 'energySaving', 'energy_saving', 'night', 'manual']);

export const controlModeSchema = z.enum(['local', 'remote', 'failsafe']);

export const commandTypeSchema = z.enum([
  'SET_SETPOINT',
  'SET_ALGORITHM',
  'SET_PID_PARAMS',
  'SET_MODE',
  'SET_CONTROL_MODE',
  'SET_CYCLE_CONFIG',
  'SET_SAFETY_LIMITS',
  'REBOOT_DEVICE',
  'REQUEST_STATUS',
]);

export const commandStatusSchema = z.enum(['pending', 'sent', 'acknowledged', 'failed', 'expired']);

export const commandAckStatusSchema = z.enum([
  'applied',
  'rejected_local_mode',
  'rejected_invalid_payload',
  'rejected_safety',
  'queued_desired_config',
  'failed',
  'expired',
]);

export const eventSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

export const logLevelSchema = z.enum(['debug', 'info', 'warning', 'error', 'critical']);

export const setpointSourceSchema = z.enum(['manual', 'schedule', 'algorithm', 'system', 'potentiometer', 'remote', 'default', 'failsafe']);

export const systemStateSchema = z.enum(['normal', 'heating', 'stable', 'overheat', 'sensor_error', 'offline', 'error']);

export const isoDateStringSchema = z.string().datetime();

export const jsonObjectSchema = z.record(z.string(), z.unknown());
