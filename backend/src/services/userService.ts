import { TRPCError } from '@trpc/server';
import type { UserRole } from '@prisma/client';
import { hashPassword } from '../lib/auth';
import { prisma } from '../lib/prisma';

const mapUser = (user: {
  id: bigint;
  login: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}) => ({
  id: Number(user.id),
  login: user.login,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt.toISOString(),
  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
});

export const getUsers = async () => {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: 'asc',
    },
  });

  return users.map(mapUser);
};

export const createUser = async (input: { login: string; password: string; role: UserRole }, actorUserId?: bigint) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      login: input.login,
    },
  });

  if (existingUser) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Пользователь с таким логином уже существует',
    });
  }

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        login: input.login,
        passwordHash: hashPassword(input.password),
        role: input.role,
      },
    });

    await tx.event.create({
      data: {
        userId: actorUserId,
        type: 'user_created',
        severity: 'info',
        message: `User ${createdUser.login} created`,
        payload: {
          createdUserId: Number(createdUser.id),
          role: createdUser.role,
        },
      },
    });

    return createdUser;
  });

  return mapUser(user);
};

export const updateUserRole = async (input: { userId: number; role: UserRole }, actorUserId?: bigint) => {
  const user = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: {
        id: BigInt(input.userId),
      },
      data: {
        role: input.role,
      },
    });

    await tx.event.create({
      data: {
        userId: actorUserId,
        type: 'user_role_changed',
        severity: 'info',
        message: `User ${updatedUser.login} role changed to ${updatedUser.role}`,
        payload: {
          targetUserId: Number(updatedUser.id),
          role: updatedUser.role,
        },
      },
    });

    return updatedUser;
  });

  return mapUser(user);
};

export const deactivateUser = async (userId: number, actorUserId?: bigint) => {
  const user = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: {
        id: BigInt(userId),
      },
      data: {
        isActive: false,
      },
    });

    await tx.event.create({
      data: {
        userId: actorUserId,
        type: 'user_deactivated',
        severity: 'warning',
        message: `User ${updatedUser.login} deactivated`,
        payload: {
          targetUserId: Number(updatedUser.id),
        },
      },
    });

    return updatedUser;
  });

  return mapUser(user);
};
