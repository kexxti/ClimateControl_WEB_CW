import { authRouter } from './routers/auth';
import { dashboardRouter } from './routers/dashboard';
import { eventsRouter } from './routers/events';
import { logsRouter } from './routers/logs';
import { roomsRouter } from './routers/rooms';
import { settingsRouter } from './routers/settings';
import { statisticsRouter } from './routers/statistics';
import { trpc } from './trpcBase';
import { usersRouter } from './routers/users';

export const trpcRouter = trpc.router({
  ...authRouter,
  ...dashboardRouter,
  ...eventsRouter,
  ...logsRouter,
  ...statisticsRouter,
  ...settingsRouter,
  ...roomsRouter,
  ...usersRouter,
});

export type TrpcRouter = typeof trpcRouter;
