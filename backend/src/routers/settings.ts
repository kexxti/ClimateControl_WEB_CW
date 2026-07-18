import { adminProcedure, protectedProcedure, trpc } from '../trpcBase';
import {
  applyAlgorithmToRoomsInputSchema,
  updateApplicationSettingsInputSchema,
  updateSystemSettingsInputSchema,
} from '../contracts/trpc';
import { applyAlgorithm, changeApplicationSettings, changeSystemSettings, getSettingsData } from '../services/settingsService';

const nestedSettingsRouter = trpc.router({
  get: protectedProcedure.query(({ ctx }) => {
    return getSettingsData(ctx.user.id);
  }),
  updateApplicationSettings: protectedProcedure.input(updateApplicationSettingsInputSchema).mutation(({ ctx, input }) => {
    return changeApplicationSettings(input, ctx.user.id);
  }),
  updateSystemSettings: adminProcedure.input(updateSystemSettingsInputSchema).mutation(({ ctx, input }) => {
    return changeSystemSettings(input, ctx.user.id);
  }),
  applyAlgorithmToRooms: adminProcedure.input(applyAlgorithmToRoomsInputSchema).mutation(({ input }) => {
    return applyAlgorithm(input);
  }),
});

export const settingsRouter = {
  settings: nestedSettingsRouter,
  getSettingsData: protectedProcedure.query(({ ctx }) => {
    return getSettingsData(ctx.user.id);
  }),
};
