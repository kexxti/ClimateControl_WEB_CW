import { changePasswordInputSchema, loginInputSchema } from '../contracts/trpc';
import { changePassword, getCurrentUser, loginUser, logoutUser, refreshSession } from '../services/authService';
import { protectedProcedure, trpc } from '../trpcBase';

const nestedAuthRouter = trpc.router({
  login: trpc.procedure.input(loginInputSchema).mutation(({ input }) => {
    return loginUser(input.login, input.password);
  }),
  me: trpc.procedure.query(({ ctx }) => {
    return getCurrentUser(ctx);
  }),
  refresh: protectedProcedure.mutation(({ ctx }) => {
    return refreshSession(ctx);
  }),
  changePassword: protectedProcedure.input(changePasswordInputSchema).mutation(({ ctx, input }) => {
    return changePassword(ctx, input);
  }),
  logout: protectedProcedure.mutation(({ ctx }) => {
    return logoutUser(ctx);
  }),
});

export const authRouter = {
  auth: nestedAuthRouter,
};
