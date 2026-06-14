import type { LogLevel, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type LogsFilter = {
  roomID?: string;
  deviceUid?: string;
  level?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

type DeviceLogWithRelations = Prisma.DeviceLogGetPayload<{
  include: {
    room: true;
    device: true;
  };
}>;

const getRoomWhere = (roomID: string) => {
  const numericRoomId = Number(roomID);
  const idCondition = Number.isInteger(numericRoomId) && numericRoomId > 0 ? { id: BigInt(numericRoomId) } : undefined;

  return {
    OR: [
      ...(idCondition ? [idCondition] : []),
      {
        name: {
          contains: roomID,
        },
      },
    ],
  };
};

const buildLogWhere = (filter: LogsFilter): Prisma.DeviceLogWhereInput => ({
  ...(filter.roomID
    ? {
        room: getRoomWhere(filter.roomID),
      }
    : {}),
  ...(filter.deviceUid
    ? {
        device: {
          deviceUid: filter.deviceUid,
        },
      }
    : {}),
  ...(filter.level ? { level: filter.level as LogLevel } : {}),
  ...(filter.dateFrom || filter.dateTo
    ? {
        receivedAt: {
          ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
          ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
        },
      }
    : {}),
});

const mapLog = (log: DeviceLogWithRelations) => ({
  id: Number(log.id),
  level: log.level,
  type: log.type,
  message: log.message,
  deviceSequence: log.deviceSequence ? Number(log.deviceSequence) : null,
  deviceUptimeMs: log.deviceUptimeMs ? Number(log.deviceUptimeMs) : null,
  receivedAt: log.receivedAt.toISOString(),
  createdAt: log.createdAt.toISOString(),
  roomName: log.room?.name ?? null,
  deviceUid: log.device.deviceUid,
});

export const getDeviceLogs = async (filter: LogsFilter) => {
  const logs = await prisma.deviceLog.findMany({
    where: buildLogWhere(filter),
    include: {
      room: true,
      device: true,
    },
    orderBy: {
      receivedAt: 'desc',
    },
    take: filter.limit ?? 100,
  });

  return logs.map(mapLog);
};

export const getRoomLogs = async (filter: LogsFilter) => {
  return getDeviceLogs(filter);
};
