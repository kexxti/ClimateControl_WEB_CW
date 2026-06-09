import { trpc } from '../trpcBase';
import { getDashboardData } from '../services/dashboardService';

export const dashboardRouter = {
  getDashboardData: trpc.procedure.query(() => {
    return getDashboardData();
  }),
};
