import { TRPCError } from '@trpc/server';
import type { Algorithm, PidParams } from '../types/climate';
import {
  getRoomById,
  getRoomDetailsById,
  getRooms,
  updateRoomAlgorithm,
  updateRoomPidParams,
  updateRoomSetpoint,
} from '../repositories/roomRepository';

export const getAllRooms = () => {
  return getRooms();
};

export const getRoomData = (roomID: string) => {
  return getRoomDetailsById(roomID);
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
