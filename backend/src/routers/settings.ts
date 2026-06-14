import { adminProcedure, protectedProcedure, trpc } from '../trpcBase';
import {
  applyAlgorithmToRoomsInputSchema,
  updateApplicationSettingsInputSchema,
  updateSystemSettingsInputSchema,
} from '../contracts/trpc';
import { applyAlgorithm, changeApplicationSettings, changeSystemSettings, getSettingsData } from '../services/settingsService';

const nestedSettingsRouter = trpc.router({
  get: protectedProcedure.query(() => {
    return getSettingsData();
  }),
  updateApplicationSettings: protectedProcedure.input(updateApplicationSettingsInputSchema).mutation(({ input }) => {
    return changeApplicationSettings(input);
  }),
  updateSystemSettings: adminProcedure.input(updateSystemSettingsInputSchema).mutation(({ input }) => {
    return changeSystemSettings(input);
  }),
  applyAlgorithmToRooms: adminProcedure.input(applyAlgorithmToRoomsInputSchema).mutation(({ input }) => {
    return applyAlgorithm(input);
  }),
});

export const settingsRouter = {
  settings: nestedSettingsRouter,
  getSettingsData: protectedProcedure.query(() => {
    return getSettingsData();
  }),
};
