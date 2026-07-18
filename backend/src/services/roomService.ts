import { TRPCError } from '@trpc/server';
import type { Algorithm, HistoryBucket, HistoryPeriod, PidParams } from '../types/climate';
import {
  createRoom,
  getRoomById,
  getRoomDetailsById,
  getRooms,
  softDeleteRoom,
  updateRoomAlgorithm,
  updateRoomPidParams,
  updateRoomSetpoint,
} from '../repositories/roomRepository';

export const getAllRooms = () => {
  return getRooms();
};

export const getRoomData = (
  roomID: string,
  historyOptions?: {
    period?: HistoryPeriod;
    dateFrom?: string;
    dateTo?: string;
    bucket?: HistoryBucket;
  },
) => {
  return getRoomDetailsById(roomID, historyOptions);
};

export const getRoomByIdentifier = (roomID: string) => {
  return getRoomById(roomID);
};

export const changeSetpoint = async (roomID: string, setpointValue: number) => {
  const result = await updateRoomSetpoint(roomID, setpointValue);

  if (!result) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Room, settings, or device was not found',
    });
  }

  return result;
};

export const changeAlgorithm = async (roomID: string, algorithm: Algorithm) => {
  const result = await updateRoomAlgorithm(roomID, algorithm);

  if (!result) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Room, settings, device, or algorithm was not found',
    });
  }

  return result;
};

export const changePidParams = async (roomID: string, pidParams: PidParams) => {
  const result = await updateRoomPidParams(roomID, pidParams);

  if (!result) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Room, settings, or device was not found',
    });
  }

  return result;
};

export const addRoom = async (
  input: {
    name?: string;
    location?: string;
    floor?: number;
    setpoint: number;
    algorithm: Algorithm;
    criticalTemperature?: number;
    deviceUid?: string;
    deviceName?: string;
  },
  userId: bigint,
) => {
  const result = await createRoom(input, userId);

  if (!result) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Regulation algorithm was not found',
    });
  }

  return result;
};

export const removeRoomSoftly = async (roomID: string, userId: bigint) => {
  const result = await softDeleteRoom(roomID, userId);

  if (!result) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Active room was not found',
    });
  }

  return result;
};
