import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { defaultPidParams, settingsData } from '../data/mockData';
import { algorithmUiToCode } from './roomRepository';
import type { Algorithm, ClimateMode, PidParams } from '../types/climate';

type ApplicationSettings = typeof settingsData.application;

type SystemSettings = typeof settingsData.system;

const getJsonSetting = async <T>(key: string, fallback: T): Promise<T> => {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      key,
    },
  });

  return (setting?.value as T | undefined) ?? fallback;
};

const upsertJsonSetting = async (key: string, value: Prisma.InputJsonValue) => {
  return prisma.systemSetting.upsert({
    where: {
      key,
    },
    update: {
      value,
    },
    create: {
      key,
      value,
    },
  });
};

export const getSettings = async () => {
  const application = await getJsonSetting<ApplicationSettings>('application_settings', settingsData.application);
  const system = await getJsonSetting<SystemSettings>('system_settings', settingsData.system);
  const pidParams = await getJsonSetting<PidParams>('pid_params', defaultPidParams);

  return {
    application,
    system,
    pidParams,
  };
};

export const updateApplicationSettings = async (settings: ApplicationSettings) => {
  await upsertJsonSetting('application_settings', settings);
  return getSettings();
};

export const updateSystemSettings = async (settings: SystemSettings & { pidParams: PidParams }) => {
  const { pidParams, ...system } = settings;

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: {
        key: 'system_settings',
      },
      update: {
        value: system,
      },
      create: {
        key: 'system_settings',
        value: system,
      },
    }),
    prisma.systemSetting.upsert({
      where: {
        key: 'pid_params',
      },
      update: {
        value: pidParams,
      },
      create: {
        key: 'pid_params',
        value: pidParams,
      },
    }),
  ]);

  return getSettings();
};

export const applyAlgorithmToRooms = async ({
  algorithm,
  target,
  roomIDs,
  floor,
}: {
  algorithm: Algorithm;
  target: 'all' | 'selected' | 'floor';
  roomIDs?: string[];
  floor?: number;
}) => {
  const algorithmRecord = await prisma.regulationAlgorithm.findUnique({
    where: {
      code: algorithmUiToCode(algorithm),
    },
  });

  if (!algorithmRecord) {
    return {
      affectedRooms: 0,
      commandsCreated: 0,
      desiredSaved: 0,
    };
  }

  const rooms = await prisma.room.findMany({
    where: {
      isActive: true,
      ...(target === 'selected' && roomIDs?.length
        ? {
            OR: roomIDs.map((roomID) => ({
              name: {
                contains: roomID,
              },
            })),
          }
        : {}),
      ...(target === 'floor' && typeof floor === 'number' ? { floor } : {}),
    },
    include: {
      device: true,
      settings: true,
    },
  });

  let commandsCreated = 0;
  let desiredSaved = 0;

  await prisma.$transaction(async (tx) => {
    for (const room of rooms) {
      if (!room.settings) {
        continue;
      }

      const isRemote = room.settings.controlMode === 'remote';

      await tx.roomSetting.update({
        where: {
          roomId: room.id,
        },
        data: isRemote
          ? {
              algorithmId: algorithmRecord.id,
              desiredAlgorithmId: null,
            }
          : {
              desiredAlgorithmId: algorithmRecord.id,
            },
      });

      if (isRemote && room.device) {
        await tx.deviceCommand.create({
          data: {
            roomId: room.id,
            deviceId: room.device.id,
            type: 'SET_ALGORITHM',
            payload: {
              algorithm: algorithmRecord.code,
            },
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        });
        commandsCreated += 1;
      } else {
        desiredSaved += 1;
      }

      await tx.event.create({
        data: {
          roomId: room.id,
          deviceId: room.device?.id,
          type: 'algorithm_changed',
          severity: 'info',
          message: isRemote ? `Algorithm applied globally: ${algorithm}` : `Desired algorithm saved globally: ${algorithm}`,
          payload: {
            algorithm: algorithmRecord.code,
            target,
            commandCreated: isRemote && Boolean(room.device),
          },
        },
      });
    }
  });

  return {
    affectedRooms: rooms.length,
    commandsCreated,
    desiredSaved,
  };
};
