import { trpc } from '../trpcBase';
import { getSettingsData } from '../services/settingsService';

export const settingsRouter = {
  getSettingsData: trpc.procedure.query(() => {
    return getSettingsData();
  }),
};
