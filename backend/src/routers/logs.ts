import { logsFilterInputSchema } from '../contracts/trpc';
import { getDeviceLogs, getRoomLogs } from '../services/logsService';
import { protectedProcedure, trpc } from '../trpcBase';

const nestedLogsRouter = trpc.router({
  getDeviceLogs: protectedProcedure.input(logsFilterInputSchema).query(({ input }) => {
    return getDeviceLogs(input);
  }),
  getRoomLogs: protectedProcedure.input(logsFilterInputSchema).query(({ input }) => {
    return getRoomLogs(input);
  }),
});

export const logsRouter = {
  logs: nestedLogsRouter,
};
