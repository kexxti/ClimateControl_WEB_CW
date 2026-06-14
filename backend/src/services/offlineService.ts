import { prisma } from '../lib/prisma';

const DEFAULT_TELEMETRY_TIMEOUT_SECONDS = 45;

const getTelemetryTimeoutSeconds = async () => {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      key: 'telemetry_timeout_seconds',
    },
  });

  return typeof setting?.value === 'number' ? setting.value : DEFAULT_TELEMETRY_TIMEOUT_SECONDS;
};

export const detectOfflineDevices = async () => {
  const timeoutSeconds = await getTelemetryTimeoutSeconds();
  const staleBefore = new Date(Date.now() - timeoutSeconds * 1000);
  const staleDevices = await prisma.device.findMany({
    where: {
      isOnline: true,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleBefore } }],
    },
    include: {
      room: {
        include: {
          settings: true,
        },
      },
    },
  });

  for (const device of staleDevices) {
    await prisma.$transaction(async (tx) => {
      await tx.device.update({
        where: {
          id: device.id,
        },
        data: {
          isOnline: false,
        },
      });

      if (device.room.settings) {
        await tx.roomSetting.update({
          where: {
            roomId: device.roomId,
          },
          data: {
            status: 'offline',
          },
        });
      }

      await tx.event.create({
        data: {
          roomId: device.roomId,
          deviceId: device.id,
          type: 'device_offline',
          severity: 'warning',
          message: `Device ${device.deviceUid} is offline`,
          payload: {
            timeoutSeconds,
            lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
          },
        },
      });
    });
  }

  return {
    offlineCount: staleDevices.length,
  };
};

export const startOfflineDetection = () => {
  const interval = setInterval(() => {
    detectOfflineDevices().catch((error) => {
      console.error('Offline detection failed', error);
    });
  }, 15000);

  interval.unref();
};
