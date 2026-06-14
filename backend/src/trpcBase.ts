import { initTRPC } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { TRPCError } from '@trpc/server';
import type { UserRole } from '@prisma/client';
import { verifySessionToken } from './lib/auth';

export type TrpcContext = {
  user: {
    id: bigint;
    login: string;
    role: UserRole;
  } | null;
};

export const createTrpcContext = ({ req }: CreateExpressContextOptions): TrpcContext => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;
  const payload = token ? verifySessionToken(token) : null;

  return {
    user: payload
      ? {
          id: BigInt(payload.userId),
          login: payload.login,
          role: payload.role,
        }
      : null,
  };
};

export const trpc = initTRPC.context<TrpcContext>().create();

export const protectedProcedure = trpc.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Нужно войти в систему',
    });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Действие доступно только администратору',
    });
  }

  return next();
});
