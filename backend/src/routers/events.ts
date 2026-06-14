import { recentEventsInputSchema } from '../contracts/trpc';
import { getRecentEvents } from '../services/eventsService';
import { protectedProcedure, trpc } from '../trpcBase';

const nestedEventsRouter = trpc.router({
  getRecent: protectedProcedure.input(recentEventsInputSchema).query(({ input }) => {
    return getRecentEvents(input?.limit ?? 20);
  }),
});

export const eventsRouter = {
  events: nestedEventsRouter,
};
