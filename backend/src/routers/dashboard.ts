import { protectedProcedure, trpc } from '../trpcBase';
import { getDashboardSummary } from '../services/dashboardService';

const nestedDashboardRouter = trpc.router({
  getSummary: protectedProcedure.query(() => {
    return getDashboardSummary();
  }),
});

export const dashboardRouter = {
  dashboard: nestedDashboardRouter,
  getDashboardData: protectedProcedure.query(() => {
    return getDashboardSummary();
  }),
};
