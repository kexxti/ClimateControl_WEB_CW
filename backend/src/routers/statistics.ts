import { protectedProcedure, trpc } from '../trpcBase';
import { statisticsAnalyticsInputSchema } from '../contracts/trpc';
import { getStatisticsAnalytics, getStatisticsData } from '../services/statisticsService';

const nestedStatisticsRouter = trpc.router({
  getAnalytics: protectedProcedure.input(statisticsAnalyticsInputSchema).query(({ input }) => {
    return getStatisticsAnalytics(input);
  }),
});

export const statisticsRouter = {
  statistics: nestedStatisticsRouter,
  getStatisticsData: protectedProcedure.query(() => {
    return getStatisticsData();
  }),
};
