import crypto from 'node:crypto';
import type { AlgorithmCode, Device, EventSeverity, Prisma, RoomSetting } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type {
  commandAckBodySchema,
  deviceBootstrapBodySchema,
  deviceLogsBatchBodySchema,
  heartbeatBodySchema,
  stateReportBodySchema,
  telemetryBatchBodySchema,
} from '../contracts/deviceRest';
import type { z } from 'zod';
import type { systemStateSchema } from '../contracts/common';

type DeviceWithRelations = Device & {
  settingsRoom?: never;
  room: {
    id: bigint;
    name: string;
    settings: RoomSetting | null;
  };
};

type BootstrapBody = z.infer<typeof deviceBootstrapBodySchema>;
type HeartbeatBody = z.infer<typeof heartbeatBodySchema>;
type TelemetryBatchBody = z.infer<typeof telemetryBatchBodySchema>;
type StateReportBody = z.infer<typeof stateReportBodySchema>;
type LogsBatchBody = z.infer<typeof deviceLogsBatchBodySchema>;
type CommandAckBody = z.infer<typeof commandAckBodySchema>;
type DeviceSystemState = z.infer<typeof systemStateSchema>;

export class DeviceRestError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const hashDeviceKey = (deviceKey: string) => crypto.createHash('sha256').update(deviceKey).digest('hex');

const getDevice = async (deviceUid: string) => {
  return prisma.device.findUnique({
    where: {
      deviceUid,
    },
    include: {
      room: {
        include: {
          settings: true,
        },
      },
    },
  });
};

const requireDevice = async (deviceUid: string, deviceKey: string | undefined): Promise<DeviceWithRelations> => {
  const device = await getDevice(deviceUid);

  if (!device) {
    throw new DeviceRestError(404, 'DEVICE_NOT_FOUND', 'Device was not found');
  }

  if (!device.isActive) {
    throw new DeviceRestError(403, 'DEVICE_INACTIVE', 'Device is inactive');
  }

  if (!deviceKey) {
    throw new DeviceRestError(401, 'DEVICE_AUTH_FAILED', 'Missing X-Device-Key header');
  }

  const hashedKey = hashDeviceKey(deviceKey);
  const isValidKey = device.apiKeyHash === deviceKey || device.apiKeyHash === hashedKey;

  if (!isValidKey) {
    throw new DeviceRestError(401, 'DEVICE_AUTH_FAILED', 'Invalid device key');
  }

  return device;
};

const markDeviceSeen = async (deviceId: bigint, data: { firmwareVersion?: string; ipAddress?: string | null } = {}) => {
  return prisma.device.update({
    where: {
      id: deviceId,
    },
    data: {
      lastSeenAt: new Date(),
      isOnline: true,
      ...(data.firmwareVersion ? { firmwareVersion: data.firmwareVersion } : {}),
      ...(data.ipAddress !== undefined ? { ipAddress: data.ipAddress } : {}),
    },
  });
};

const markDeviceSeenWithOnlineEvent = async (
  device: Pick<Device, 'id' | 'roomId' | 'isOnline'>,
  data: { firmwareVersion?: string; ipAddress?: string | null } = {},
) => {
  await markDeviceSeen(device.id, data);

  if (!device.isOnline) {
    await prisma.event.create({
      data: {
        roomId: device.roomId,
        deviceId: device.id,
        type: 'device_online',
        severity: 'info',
        message: 'Device came online',
      },
    });
  }
};

const getNumberSetting = async (key: string, fallback: number) => {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      key,
    },
  });

  return typeof setting?.value === 'number' ? setting.value : fallback;
};

const getDeviceConfig = async () => ({
  telemetryIntervalMs: await getNumberSetting('telemetry_interval_ms', 5000),
  heartbeatIntervalMs: await getNumberSetting('heartbeat_interval_ms', 30000),
  commandPollIntervalMs: await getNumberSetting('command_poll_interval_ms', 5000),
  logBatchIntervalMs: await getNumberSetting('log_batch_interval_ms', 30000),
  criticalTemperature: await getNumberSetting('critical_temperature', 35.0),
});

const toJson = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
};

const systemStateToRoomStatus = (state: DeviceSystemState) => {
  if (state === 'heating') {
    return 'heating' as const;
  }

  if (state === 'stable' || state === 'normal') {
    return 'stable' as const;
  }

  if (state === 'offline') {
    return 'offline' as const;
  }

  return 'error' as const;
};

const getAlgorithmId = async (code: AlgorithmCode) => {
  const algorithm = await prisma.regulationAlgorithm.findUnique({
    where: {
      code,
    },
  });

  return algorithm?.id ?? null;
};

export const bootstrapDevice = async (deviceUid: string, deviceKey: string | undefined, body: BootstrapBody, ipAddress?: string) => {
  const device = await requireDevice(deviceUid, deviceKey);

  await markDeviceSeenWithOnlineEvent(device, {
    firmwareVersion: body.firmware.version,
    ipAddress,
  });

  await prisma.deviceLog.create({
    data: {
      deviceId: device.id,
      roomId: device.roomId,
      level: 'info',
      type: 'boot',
      message: 'Device bootstrapped',
      payload: body,
      deviceSequence: BigInt(body.deviceSequence),
      deviceUptimeMs: BigInt(body.deviceUptimeMs),
    },
  });

  return {
    accepted: true,
    serverTime: new Date().toISOString(),
    device: {
      deviceUid: device.deviceUid,
      roomId: Number(device.roomId),
    },
    config: await getDeviceConfig(),
  };
};

export const heartbeatDevice = async (deviceUid: string, deviceKey: string | undefined, body: HeartbeatBody) => {
  const device = await requireDevice(deviceUid, deviceKey);
  await markDeviceSeenWithOnlineEvent(device);

  if (device.room.settings) {
    await prisma.roomSetting.update({
      where: {
        roomId: device.roomId,
      },
      data: {
        controlMode: body.status.controlMode,
        status: systemStateToRoomStatus(body.status.systemState),
      },
    });
  }

  const hasPendingCommands = await prisma.deviceCommand.count({
    where: {
      deviceId: device.id,
      status: 'pending',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  return {
    accepted: true,
    serverTime: new Date().toISOString(),
    hasPendingCommands: hasPendingCommands > 0,
  };
};

export const saveTelemetryBatch = async (deviceUid: string, deviceKey: string | undefined, body: TelemetryBatchBody) => {
  const device = await requireDevice(deviceUid, deviceKey);
  await markDeviceSeenWithOnlineEvent(device);

  let accepted = 0;
  let duplicates = 0;
  let failed = 0;

  for (const reading of body.readings) {
    const algorithmId = await getAlgorithmId(reading.algorithm);
    const deviceSequence = BigInt(reading.sampleSequence);

    try {
      await prisma.measurement.create({
        data: {
          roomId: device.roomId,
          deviceId: device.id,
          temperature: reading.temperature,
          humidity: reading.humidity,
          outsideTemperature: reading.outsideTemperature,
          power: reading.power,
          setpointValue: reading.setpointValue,
          heaterState: reading.actuators.heater,
          coolerState: reading.actuators.cooler,
          algorithmId,
          deviceSequence,
          deviceUptimeMs: BigInt(reading.sampleUptimeMs),
          rawPayload: reading,
        },
      });
      accepted += 1;
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        duplicates += 1;
      } else {
        failed += 1;
      }
    }

    if (device.room.settings) {
      await prisma.roomSetting.update({
        where: {
          roomId: device.roomId,
        },
        data: {
          controlMode: reading.controlMode,
          currentSetpoint: reading.setpointValue ?? device.room.settings.currentSetpoint,
          algorithmId: algorithmId ?? device.room.settings.algorithmId,
          status: reading.safety.overheat || reading.safety.emergencyShutdown ? 'error' : device.room.settings.status,
          criticalTemperature: reading.safety.criticalTemperature,
        },
      });
    }

    if (reading.safety.overheat || reading.safety.emergencyShutdown) {
      await prisma.event.create({
        data: {
          roomId: device.roomId,
          deviceId: device.id,
          type: reading.safety.emergencyShutdown ? 'emergency_shutdown' : 'temperature_too_high',
          severity: 'critical',
          message: reading.safety.emergencyShutdown ? 'Emergency shutdown reported' : 'Overheat reported',
          payload: reading,
        },
      });
    }
  }

  return {
    accepted,
    duplicates,
    failed,
    serverTime: new Date().toISOString(),
  };
};

export const saveStateReport = async (deviceUid: string, deviceKey: string | undefined, body: StateReportBody) => {
  const device = await requireDevice(deviceUid, deviceKey);
  await markDeviceSeenWithOnlineEvent(device);
  const algorithmId = await getAlgorithmId(body.state.algorithm);

  await prisma.$transaction(async (tx) => {
    if (device.room.settings) {
      await tx.roomSetting.update({
        where: {
          roomId: device.roomId,
        },
        data: {
          controlMode: body.state.controlMode,
          status: systemStateToRoomStatus(body.state.systemState),
          currentSetpoint: body.state.setpointValue,
          algorithmId: algorithmId ?? device.room.settings.algorithmId,
          criticalTemperature: body.state.safety.criticalTemperature,
        },
      });

      if (body.state.controlMode === 'remote') {
        const desiredSetpoint = device.room.settings.desiredSetpoint;
        const desiredAlgorithmId = device.room.settings.desiredAlgorithmId;

        if (desiredSetpoint !== null) {
          await tx.deviceCommand.create({
            data: {
              deviceId: device.id,
              roomId: device.roomId,
              type: 'SET_SETPOINT',
              payload: {
                setpointValue: Number(desiredSetpoint),
              },
              expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
          });
        }

        if (desiredAlgorithmId !== null) {
          const desiredAlgorithm = await tx.regulationAlgorithm.findUnique({
            where: {
              id: desiredAlgorithmId,
            },
          });

          if (desiredAlgorithm) {
            await tx.deviceCommand.create({
              data: {
                deviceId: device.id,
                roomId: device.roomId,
                type: 'SET_ALGORITHM',
                payload: {
                  algorithm: desiredAlgorithm.code,
                },
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
              },
            });
          }
        }
      }
    }

    await tx.deviceLog.create({
      data: {
        deviceId: device.id,
        roomId: device.roomId,
        level: body.state.systemState === 'normal' ? 'info' : 'warning',
        type: 'state_report',
        message: `State report: ${body.state.systemState}`,
        payload: body,
        deviceSequence: BigInt(body.deviceSequence),
        deviceUptimeMs: BigInt(body.deviceUptimeMs),
      },
    });

    if (body.state.controlMode === 'failsafe' || body.state.safety.emergencyShutdown || body.state.safety.overheat) {
      await tx.event.create({
        data: {
          roomId: device.roomId,
          deviceId: device.id,
          type: body.state.safety.emergencyShutdown ? 'emergency_shutdown' : 'device_state_warning',
          severity: body.state.controlMode === 'failsafe' || body.state.safety.emergencyShutdown ? 'critical' : 'warning',
          message: `Device state: ${body.state.systemState}`,
          payload: body.state,
        },
      });
    }
  });

  return {
    accepted: true,
  };
};

export const saveDeviceLogs = async (deviceUid: string, deviceKey: string | undefined, body: LogsBatchBody) => {
  const device = await requireDevice(deviceUid, deviceKey);
  await markDeviceSeenWithOnlineEvent(device);
  let accepted = 0;
  let failed = 0;

  for (const log of body.logs) {
    try {
      await prisma.deviceLog.create({
        data: {
          deviceId: device.id,
          roomId: device.roomId,
          level: log.level,
          type: log.type,
          message: log.message,
          payload: toJson(log.payload),
          deviceSequence: BigInt(log.logSequence),
          deviceUptimeMs: log.uptimeMs !== undefined ? BigInt(log.uptimeMs) : BigInt(body.deviceUptimeMs),
        },
      });
      accepted += 1;

      if (log.level === 'warning' || log.level === 'error' || log.level === 'critical') {
        await prisma.event.create({
          data: {
            roomId: device.roomId,
            deviceId: device.id,
            type: log.type,
            severity: log.level as EventSeverity,
            message: log.message,
            payload: toJson(log.payload),
          },
        });
      }
    } catch {
      failed += 1;
    }
  }

  return {
    accepted,
    duplicates: 0,
    failed,
  };
};

export const getDeviceCommands = async (deviceUid: string, deviceKey: string | undefined, limit: number) => {
  const device = await requireDevice(deviceUid, deviceKey);
  await markDeviceSeenWithOnlineEvent(device);

  await prisma.deviceCommand.updateMany({
    where: {
      deviceId: device.id,
      status: {
        in: ['pending', 'sent'],
      },
      expiresAt: {
        lt: new Date(),
      },
    },
    data: {
      status: 'expired',
    },
  });

  const commands = await prisma.deviceCommand.findMany({
    where: {
      deviceId: device.id,
      status: 'pending',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: limit,
  });

  await prisma.deviceCommand.updateMany({
    where: {
      id: {
        in: commands.map((command) => command.id),
      },
    },
    data: {
      status: 'sent',
      sentAt: new Date(),
    },
  });

  return {
    commands: commands.map((command) => ({
      commandId: Number(command.id),
      type: command.type,
      createdAt: command.createdAt.toISOString(),
      expiresAt: command.expiresAt?.toISOString() ?? null,
      payload: command.payload,
    })),
  };
};

export const acknowledgeDeviceCommand = async (
  deviceUid: string,
  deviceKey: string | undefined,
  commandId: number,
  body: CommandAckBody,
) => {
  const device = await requireDevice(deviceUid, deviceKey);
  await markDeviceSeenWithOnlineEvent(device);

  const command = await prisma.deviceCommand.findFirst({
    where: {
      id: BigInt(commandId),
      deviceId: device.id,
    },
  });

  if (!command) {
    throw new DeviceRestError(404, 'COMMAND_NOT_FOUND', 'Command was not found');
  }

  await prisma.deviceCommand.update({
    where: {
      id: command.id,
    },
    data: body.success
      ? {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          errorMessage: null,
        }
      : {
          status: 'failed',
          failedAt: new Date(),
          errorMessage: body.message,
        },
  });

  await prisma.event.create({
    data: {
      roomId: command.roomId,
      deviceId: device.id,
      type: body.success ? 'command_acknowledged' : 'command_failed',
      severity: body.success ? 'info' : 'warning',
      message: body.message ?? (body.success ? 'Command acknowledged' : 'Command failed'),
      payload: body,
    },
  });

  return {
    accepted: true,
  };
};
