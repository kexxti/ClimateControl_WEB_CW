import { prisma } from '../lib/prisma';

export const getRecentEvents = async (limit = 20) => {
  const events = await prisma.event.findMany({
    include: {
      room: true,
      device: true,
      user: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  return events.map((event) => ({
    id: Number(event.id),
    type: event.type,
    severity: event.severity,
    message: event.message,
    createdAt: event.createdAt.toISOString(),
    roomName: event.room?.name ?? null,
    deviceUid: event.device?.deviceUid ?? null,
    userLogin: event.user?.login ?? null,
  }));
};
