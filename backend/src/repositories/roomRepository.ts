import type { AlgorithmCode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { Algorithm, PidParams, Room, RoomHistoryPoint } from '../types/climate';

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
};

type RoomRecord = NonNullable<Awaited<ReturnType<typeof getRoomRecordByIdentifier>>>;

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

const mapHistory = (room: RoomRecord): RoomHistoryPoint[] => {
  const history = [...room.measurements].reverse().map((measurement) => ({
    time: measurement.createdAt.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    temp: Number(measurement.temperature),
    setpoint: Number(measurement.setpointValue ?? room.settings?.currentSetpoint ?? 0),
  }));

  if (history.length > 0) {
    return history;
  }

  return [
    {
      time: 'Сейчас',
      temp: Number(room.settings?.currentSetpoint ?? 0),
      setpoint: Number(room.settings?.currentSetpoint ?? 0),
    },
  ];
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

export const getRoomById = async (roomID: string) => {
  const room = await getRoomRecordByIdentifier(roomID);
  return room ? mapRoom(room) : null;
};

export const getRoomDetailsById = async (roomID: string) => {
  const room = await getRoomRecordByIdentifier(roomID);

  if (!room) {
    return {
      room: null,
      history: [],
      pidParams: {
        kp: 1.2,
        ki: 0.35,
        kd: 0.08,
        hysteresis: 0.4,
      },
    };
  }

  return {
    room: mapRoom(room),
    history: mapHistory(room),
    pidParams: mapPidParams(room),
  };
};

export const getRoomHistory = async (room: Room) => {
  const details = await getRoomDetailsById(room.roomID);
  return details.history;
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

    await tx.setpoint.create({
      data: {
        roomId: room.id,
        value: setpointValue,
        source: 'system',
      },
    });

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
