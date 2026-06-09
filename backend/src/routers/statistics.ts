import { trpc } from '../trpcBase';
import { getStatisticsData } from '../services/statisticsService';

export const statisticsRouter = {
  getStatisticsData: trpc.procedure.query(() => {
    return getStatisticsData();
  }),
};
