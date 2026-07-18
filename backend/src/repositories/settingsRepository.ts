import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { defaultPidParams, settingsData } from '../data/mockData';
import { algorithmUiToCode } from './roomRepository';
import type { Algorithm, PidParams } from '../types/climate';

type ApplicationSettings = typeof settingsData.application;

type SystemSettings = typeof settingsData.system;

const normalizeApplicationSettings = (settings: Partial<ApplicationSettings>): ApplicationSettings => ({
  ...settingsData.application,
  ...settings,
  theme: settings.theme === 'dark' ? 'dark' : 'light',
});

const getJsonSetting = async <T>(key: string, fallback: T): Promise<T> => {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      key,
    },
  });

  return (setting?.value as T | undefined) ?? fallback;
};

const upsertJsonSetting = (key: string, value: Prisma.InputJsonValue) => {
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

const getUserTheme = async (userId: bigint) => {
  const themeSetting = await prisma.userSetting.findUnique({
    where: {
      userId_key: {
        userId,
        key: 'theme',
      },
    },
  });

  return themeSetting?.value === 'dark' ? 'dark' : themeSetting?.value === 'light' ? 'light' : null;
};

const upsertUserTheme = (userId: bigint, theme: ApplicationSettings['theme']) => {
  return prisma.userSetting.upsert({
    where: {
      userId_key: {
        userId,
        key: 'theme',
      },
    },
    update: {
      value: theme,
    },
    create: {
      userId,
      key: 'theme',
      value: theme,
    },
  });
};

export const getSettings = async (userId: bigint) => {
  const systemApplication = normalizeApplicationSettings(
    await getJsonSetting<Partial<ApplicationSettings>>('application_settings', settingsData.application),
  );
  const userTheme = await getUserTheme(userId);
  const system = await getJsonSetting<SystemSettings>('system_settings', settingsData.system);
  const pidParams = await getJsonSetting<PidParams>('pid_params', defaultPidParams);

  return {
    application: {
      ...systemApplication,
      theme: userTheme ?? settingsData.application.theme,
    },
    system,
    pidParams,
  };
};

export const updateApplicationSettings = async (userId: bigint, settings: ApplicationSettings) => {
  const normalizedSettings = normalizeApplicationSettings(settings);

  await prisma.$transaction([
    upsertUserTheme(userId, normalizedSettings.theme),
    upsertJsonSetting('application_settings', {
      refreshInterval: normalizedSettings.refreshInterval,
      connectionProfile: normalizedSettings.connectionProfile,
    }),
  ]);

  return getSettings(userId);
};

export const updateSystemSettings = async (userId: bigint, settings: SystemSettings & { pidParams: PidParams }) => {
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

  return getSettings(userId);
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
