import type { AlgorithmCode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { buildRoomHistoryPoints, getHistoryRange, resolveHistoryMeta } from '../services/historyService';
import type { Algorithm, HistoryBucket, HistoryMeta, HistoryPeriod, PidParams, Room, RoomHistoryPoint } from '../types/climate';

const roomInclude = {
  device: true,
  settings: {
    include: {
      algorithm: true,
      desiredAlgorithm: true,
    },
  },
  algorithmParameters: {
    where: {
      isActive: true,
    },
    include: {
      algorithm: true,
    },
    take: 1,
    orderBy: {
      updatedAt: 'desc' as const,
    },
  },
  measurements: {
    take: 24,
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
  setpoints: {
    take: 50,
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
};

type RoomRecord = NonNullable<Awaited<ReturnType<typeof getRoomRecordByIdentifier>>>;

type HistoryOptions = {
  period?: HistoryPeriod;
  dateFrom?: string;
  dateTo?: string;
  bucket?: HistoryBucket;
};

type CreateRoomInput = {
  name?: string;
  location?: string;
  floor?: number;
  setpoint: number;
  algorithm: Algorithm;
  criticalTemperature?: number;
  deviceUid?: string;
  deviceName?: string;
};

export const algorithmCodeToUi = (code: AlgorithmCode): Algorithm => {
  if (code === 'ON_OFF') {
    return 'On/Off';
  }

  if (code === 'TIME') {
    return 'Time';
  }

  return code;
};

export const algorithmUiToCode = (algorithm: Algorithm): AlgorithmCode => {
  if (algorithm === 'On/Off') {
    return 'ON_OFF';
  }

  if (algorithm === 'Time') {
    return 'TIME';
  }

  return algorithm;
};

const getRoomPublicId = (room: { id: bigint; name: string }) => {
  const roomNumber = room.name.match(/\d+/)?.[0];
  return roomNumber || room.id.toString();
};

const mapRoom = (room: RoomRecord): Room => {
  const latestMeasurement = room.measurements[0];
  const setpoint = Number(room.settings?.currentSetpoint ?? 0);
  const algorithmCode = room.settings?.algorithm.code ?? 'PID';

  return {
    id: Number(room.id),
    roomID: getRoomPublicId(room),
    name: room.name,
    location: room.location,
    floor: room.floor,
    currentTemp: Number(latestMeasurement?.temperature ?? setpoint),
    setpoint,
    algorithm: algorithmCodeToUi(algorithmCode),
    status: room.settings?.status ?? 'offline',
    controlMode: room.settings?.controlMode ?? 'remote',
    isActive: room.isActive,
  };
};

const mapHistory = (
  room: RoomRecord,
  measurements = room.measurements,
  setpoints = room.setpoints,
  historyOptions?: HistoryOptions,
): RoomHistoryPoint[] => {
  const currentSetpoint = Number(room.settings?.currentSetpoint ?? 0);
  const latestMeasurement = measurements[measurements.length - 1] ?? room.measurements[0];
  const range = getHistoryRange(historyOptions);

  return buildRoomHistoryPoints({
    measurements,
    setpoints,
    currentTemp: Number(latestMeasurement?.temperature ?? currentSetpoint),
    currentSetpoint,
    settingsUpdatedAt: room.settings?.updatedAt,
    period: range.period,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    bucket: historyOptions?.bucket,
    appendCurrentPoint: range.dateTo.getTime() >= Date.now() - 60 * 1000,
  });
};

const mapPidParams = (room: RoomRecord): PidParams => {
  const params = room.algorithmParameters[0];

  return {
    kp: Number(params?.kp ?? 1.2),
    ki: Number(params?.ki ?? 0.35),
    kd: Number(params?.kd ?? 0.08),
    hysteresis: Number(params?.hysteresis ?? 0.4),
  };
};

export const getRoomRecordByIdentifier = async (roomID: string) => {
  const numericRoomId = Number(roomID);
  const idCondition = Number.isInteger(numericRoomId) && numericRoomId > 0 ? { id: BigInt(numericRoomId) } : undefined;

  return prisma.room.findFirst({
    where: {
      OR: [
        ...(idCondition ? [idCondition] : []),
        {
          name: {
            contains: roomID,
          },
        },
      ],
    },
    include: roomInclude,
  });
};

export const getRooms = async () => {
  const rooms = await prisma.room.findMany({
    where: {
      isActive: true,
    },
    include: roomInclude,
    orderBy: {
      name: 'asc',
    },
  });

  return rooms.map(mapRoom);
};

export const createRoom = async (input: CreateRoomInput, userId: bigint) => {
  const algorithmRecord = await findAlgorithmByUiName(input.algorithm);

  if (!algorithmRecord) {
    return null;
  }

  const room = await prisma.$transaction(async (tx) => {
    const createdRoom = await tx.room.create({
      data: {
        name: input.name?.trim() || 'Новая аудитория',
        location: input.location?.trim() || null,
        floor: input.floor ?? null,
      },
    });
    const deviceUid = input.deviceUid?.trim() || `placeholder-room-${createdRoom.id.toString()}`;
    const deviceName = input.deviceName?.trim() || `Placeholder controller ${createdRoom.id.toString()}`;

    const device = await tx.device.create({
      data: {
        roomId: createdRoom.id,
        deviceUid,
        name: deviceName,
        apiKeyHash: `dev-only-api-key-${deviceUid}`,
        firmwareVersion: 'placeholder',
        isOnline: false,
        isActive: true,
      },
    });

    await tx.roomSetting.create({
      data: {
        roomId: createdRoom.id,
        currentSetpoint: input.setpoint,
        algorithmId: algorithmRecord.id,
        mode: 'standard',
        controlMode: 'remote',
        status: 'offline',
        criticalTemperature: input.criticalTemperature ?? 35,
        updatedByUserId: userId,
      },
    });

    await tx.roomAlgorithmParameter.create({
      data: {
        roomId: createdRoom.id,
        algorithmId: algorithmRecord.id,
        kp: 1.2,
        ki: 0.35,
        kd: 0.08,
        hysteresis: 0.4,
        createdByUserId: userId,
      },
    });

    await tx.setpoint.create({
      data: {
        roomId: createdRoom.id,
        createdByUserId: userId,
        value: input.setpoint,
        source: 'system',
      },
    });

    await tx.event.create({
      data: {
        roomId: createdRoom.id,
        deviceId: device.id,
        userId,
        type: 'room_created',
        severity: 'info',
        message: `Room created: ${createdRoom.name}`,
        payload: {
          setpoint: input.setpoint,
          algorithm: algorithmRecord.code,
          deviceUid,
          placeholderDevice: !input.deviceUid,
        },
      },
    });

    return tx.room.findUniqueOrThrow({
      where: {
        id: createdRoom.id,
      },
      include: roomInclude,
    });
  });

  return mapRoom(room);
};

export const softDeleteRoom = async (roomID: string, userId: bigint) => {
  const room = await getRoomRecordByIdentifier(roomID);

  if (!room || !room.isActive) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.room.update({
      where: {
        id: room.id,
      },
      data: {
        isActive: false,
      },
    });

    if (room.device) {
      await tx.device.update({
        where: {
          id: room.device.id,
        },
        data: {
          isActive: false,
          isOnline: false,
        },
      });
    }

    await tx.event.create({
      data: {
        roomId: room.id,
        deviceId: room.device?.id,
        userId,
        type: 'room_deleted',
        severity: 'warning',
        message: `Room deleted softly: ${room.name}`,
        payload: {
          roomID,
          deviceUid: room.device?.deviceUid,
          softDelete: true,
        },
      },
    });
  });

  return {
    roomID: getRoomPublicId(room),
    roomName: room.name,
    deviceUid: room.device?.deviceUid ?? null,
  };
};

export const getRoomById = async (roomID: string) => {
  const room = await getRoomRecordByIdentifier(roomID);
  return room ? mapRoom(room) : null;
};

export const getRoomDetailsById = async (roomID: string, historyOptions?: HistoryOptions) => {
  const room = await getRoomRecordByIdentifier(roomID);
  const range = getHistoryRange(historyOptions);

  if (!room) {
    return {
      room: null,
      history: [],
      historyMeta: resolveHistoryMeta(historyOptions, 0),
      pidParams: {
        kp: 1.2,
        ki: 0.35,
        kd: 0.08,
        hysteresis: 0.4,
      },
    };
  }

  const [measurements, setpoints] = await Promise.all([
    prisma.measurement.findMany({
      where: {
        roomId: room.id,
        createdAt: {
          gte: range.dateFrom,
          lte: range.dateTo,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
    prisma.setpoint.findMany({
      where: {
        roomId: room.id,
        createdAt: {
          lte: range.dateTo,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
  ]);

  const history = mapHistory(room, measurements, setpoints, historyOptions);

  return {
    room: mapRoom(room),
    history,
    historyMeta: resolveHistoryMeta(historyOptions, measurements.length),
    pidParams: mapPidParams(room),
  };
};

export const getRoomHistory = async (room: Room, historyOptions?: HistoryOptions): Promise<{ history: RoomHistoryPoint[]; meta: HistoryMeta }> => {
  const details = await getRoomDetailsById(room.roomID, historyOptions);
  return {
    history: details.history,
    meta: details.historyMeta,
  };
};

export const findAlgorithmByUiName = async (algorithm: Algorithm) => {
  const code = algorithmUiToCode(algorithm);
  return prisma.regulationAlgorithm.findUnique({
    where: {
      code,
    },
  });
};

export const updateRoomSetpoint = async (roomID: string, setpointValue: number) => {
  const room = await getRoomRecordByIdentifier(roomID);

  if (!room || !room.settings || !room.device) {
    return null;
  }

  const { device, settings } = room;
  const isRemote = settings.controlMode === 'remote';
  const commandExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.roomSetting.update({
      where: {
        roomId: room.id,
      },
      data: isRemote
        ? {
            currentSetpoint: setpointValue,
            desiredSetpoint: null,
          }
        : {
            desiredSetpoint: setpointValue,
          },
    });

    if (isRemote) {
      await tx.setpoint.create({
        data: {
          roomId: room.id,
          value: setpointValue,
          source: 'system',
        },
      });

      const latestMeasurement = room.measurements[0];

      if (latestMeasurement) {
        await tx.measurement.update({
          where: {
            id: latestMeasurement.id,
          },
          data: {
            setpointValue,
          },
        });
      }
    }

    if (isRemote) {
      await tx.deviceCommand.create({
        data: {
          deviceId: device.id,
          roomId: room.id,
          type: 'SET_SETPOINT',
          payload: {
            setpointValue,
          },
          expiresAt: commandExpiresAt,
        },
      });
    }

    await tx.event.create({
      data: {
        roomId: room.id,
        deviceId: device.id,
        type: 'setpoint_changed',
        severity: 'info',
        message: isRemote ? `Setpoint changed to ${setpointValue}` : `Desired setpoint saved as ${setpointValue}`,
        payload: {
          setpointValue,
          controlMode: settings.controlMode,
          commandCreated: isRemote,
        },
      },
    });
  });

  return {
    commandCreated: isRemote,
    savedAsDesired: !isRemote,
  };
};

export const updateRoomAlgorithm = async (roomID: string, algorithm: Algorithm) => {
  const room = await getRoomRecordByIdentifier(roomID);
  const algorithmRecord = await findAlgorithmByUiName(algorithm);

  if (!room || !room.settings || !room.device || !algorithmRecord) {
    return null;
  }

  const { device, settings } = room;
  const isRemote = settings.controlMode === 'remote';
  const commandExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
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

    if (isRemote) {
      await tx.deviceCommand.create({
        data: {
          deviceId: device.id,
          roomId: room.id,
          type: 'SET_ALGORITHM',
          payload: {
            algorithm: algorithmRecord.code,
          },
          expiresAt: commandExpiresAt,
        },
      });
    }

    await tx.event.create({
      data: {
        roomId: room.id,
        deviceId: device.id,
        type: 'algorithm_changed',
        severity: 'info',
        message: isRemote ? `Algorithm changed to ${algorithm}` : `Desired algorithm saved as ${algorithm}`,
        payload: {
          algorithm: algorithmRecord.code,
          controlMode: settings.controlMode,
          commandCreated: isRemote,
        },
      },
    });
  });

  return {
    commandCreated: isRemote,
    savedAsDesired: !isRemote,
  };
};

export const updateRoomPidParams = async (roomID: string, pidParams: PidParams) => {
  const room = await getRoomRecordByIdentifier(roomID);

  if (!room || !room.settings || !room.device) {
    return null;
  }

  const { device, settings } = room;
  const commandExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.roomAlgorithmParameter.upsert({
      where: {
        roomId_algorithmId_isActive: {
          roomId: room.id,
          algorithmId: settings.algorithmId,
          isActive: true,
        },
      },
      update: {
        kp: pidParams.kp,
        ki: pidParams.ki,
        kd: pidParams.kd,
        hysteresis: pidParams.hysteresis,
      },
      create: {
        roomId: room.id,
        algorithmId: settings.algorithmId,
        kp: pidParams.kp,
        ki: pidParams.ki,
        kd: pidParams.kd,
        hysteresis: pidParams.hysteresis,
      },
    });

    if (settings.controlMode === 'remote') {
      await tx.deviceCommand.create({
        data: {
          deviceId: device.id,
          roomId: room.id,
          type: 'SET_PID_PARAMS',
          payload: pidParams,
          expiresAt: commandExpiresAt,
        },
      });
    }

    await tx.event.create({
      data: {
        roomId: room.id,
        deviceId: device.id,
        type: 'pid_params_changed',
        severity: 'info',
        message: settings.controlMode === 'remote' ? 'PID params changed' : 'Desired PID params saved',
        payload: {
          ...pidParams,
          controlMode: settings.controlMode,
          commandCreated: settings.controlMode === 'remote',
        },
      },
    });
  });

  return {
    commandCreated: settings.controlMode === 'remote',
    savedAsDesired: settings.controlMode !== 'remote',
  };
};
