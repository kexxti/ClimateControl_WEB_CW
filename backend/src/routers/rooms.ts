import {
  getRoomInputSchema,
  updateAlgorithmInputSchema,
  updatePidParamsInputSchema,
  updateSetpointInputSchema,
} from '../contracts/trpc';
import { changeAlgorithm, changePidParams, changeSetpoint, getAllRooms, getRoomByIdentifier, getRoomData } from '../services/roomService';
import { protectedProcedure, trpc } from '../trpcBase';

const nestedRoomsRouter = trpc.router({
  getAll: protectedProcedure.query(() => {
    return getAllRooms();
  }),
  getById: protectedProcedure.input(getRoomInputSchema).query(({ input }) => {
    return getRoomData(input.roomID);
  }),
  updateSetpoint: protectedProcedure.input(updateSetpointInputSchema).mutation(({ input }) => {
    return changeSetpoint(input.roomID, input.setpointValue);
  }),
  updateAlgorithm: protectedProcedure.input(updateAlgorithmInputSchema).mutation(({ input }) => {
    return changeAlgorithm(input.roomID, input.algorithm);
  }),
  updatePidParams: protectedProcedure.input(updatePidParamsInputSchema).mutation(({ input }) => {
    return changePidParams(input.roomID, input.pidParams);
  }),
});

export const roomsRouter = {
  rooms: nestedRoomsRouter,
  getRoom: protectedProcedure
    .input(getRoomInputSchema)
    .query(({ input }) => {
      return getRoomData(input.roomID);
    }),
  getRooms: protectedProcedure.query(() => {
    return getAllRooms();
  }),
  getRoomById: protectedProcedure.input(getRoomInputSchema).query(({ input }) => {
    return getRoomByIdentifier(input.roomID);
  }),
};
