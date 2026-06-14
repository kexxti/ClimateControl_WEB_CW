import { createUserInputSchema, deactivateUserInputSchema, updateUserRoleInputSchema } from '../contracts/trpc';
import { createUser, deactivateUser, getUsers, updateUserRole } from '../services/userService';
import { adminProcedure, trpc } from '../trpcBase';

const nestedUsersRouter = trpc.router({
  getAll: adminProcedure.query(() => {
    return getUsers();
  }),
  create: adminProcedure.input(createUserInputSchema).mutation(({ ctx, input }) => {
    return createUser(input, ctx.user.id);
  }),
  updateRole: adminProcedure.input(updateUserRoleInputSchema).mutation(({ ctx, input }) => {
    return updateUserRole(input, ctx.user.id);
  }),
  deactivate: adminProcedure.input(deactivateUserInputSchema).mutation(({ ctx, input }) => {
    return deactivateUser(input.userId, ctx.user.id);
  }),
});

export const usersRouter = {
  users: nestedUsersRouter,
};
