import { TRPCError } from '@trpc/server';
import { createSessionToken, hashPassword, verifyPassword } from '../lib/auth';
import { prisma } from '../lib/prisma';
import type { TrpcContext } from '../trpcBase';

const mapUser = (user: { id: bigint; login: string; role: 'admin' | 'user'; isActive: boolean }) => ({
  id: Number(user.id),
  login: user.login,
  role: user.role,
  isActive: user.isActive,
});

export const loginUser = async (login: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: {
      login,
    },
  });

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Неверный логин или пароль',
    });
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt: new Date(),
    },
  });

  await prisma.event.create({
    data: {
      userId: user.id,
      type: 'user_login',
      severity: 'info',
      message: `User ${user.login} logged in`,
    },
  });

  return {
    token: createSessionToken({
      userId: user.id.toString(),
      login: user.login,
      role: user.role,
    }),
    user: mapUser(user),
  };
};

export const refreshSession = async (context: TrpcContext) => {
  if (!context.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Нужно войти в систему',
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: context.user.id,
    },
  });

  if (!user || !user.isActive) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Пользователь не найден или отключён',
    });
  }

  return {
    token: createSessionToken({
      userId: user.id.toString(),
      login: user.login,
      role: user.role,
    }),
    user: mapUser(user),
  };
};

export const changePassword = async (context: TrpcContext, input: { currentPassword: string; newPassword: string }) => {
  if (!context.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Нужно войти в систему',
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: context.user.id,
    },
  });

  if (!user || !user.isActive || !verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Текущий пароль указан неверно',
    });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: hashPassword(input.newPassword),
      },
    }),
    prisma.event.create({
      data: {
        userId: user.id,
        type: 'password_changed',
        severity: 'info',
        message: `User ${user.login} changed password`,
      },
    }),
  ]);

  return {
    success: true,
  };
};

export const logoutUser = async (context: TrpcContext) => {
  if (!context.user) {
    return {
      success: true,
    };
  }

  await prisma.event.create({
    data: {
      userId: context.user.id,
      type: 'user_logout',
      severity: 'info',
      message: `User ${context.user.login} logged out`,
    },
  });

  return {
    success: true,
  };
};

export const getCurrentUser = async (context: TrpcContext) => {
  if (!context.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: context.user.id,
    },
  });

  return user && user.isActive ? mapUser(user) : null;
};
