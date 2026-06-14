import { prisma } from '../lib/prisma';
import type { EventSeverity } from '../types/climate';

export type DashboardEvent = {
  id: number;
  type: string;
  severity: EventSeverity;
  message: string;
  createdAt: string;
  roomName: string | null;
  deviceUid: string | null;
};

export const getRecentImportantEvents = async (limit = 5): Promise<DashboardEvent[]> => {
  const events = await prisma.event.findMany({
    where: {
      severity: {
        in: ['warning', 'error', 'critical'],
      },
    },
    include: {
      room: true,
      device: true,
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
  }));
};
