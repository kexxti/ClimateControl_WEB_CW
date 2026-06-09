import { dashboardRouter } from './routers/dashboard';
import { roomsRouter } from './routers/rooms';
import { settingsRouter } from './routers/settings';
import { statisticsRouter } from './routers/statistics';
import { trpc } from './trpcBase';

export const trpcRouter = trpc.router({
  ...dashboardRouter,
  ...statisticsRouter,
  ...settingsRouter,
  ...roomsRouter,
});

export type TrpcRouter = typeof trpcRouter;
