import {
  getRoomInputSchema,
  updateAlgorithmInputSchema,
  updatePidParamsInputSchema,
  updateSetpointInputSchema,
} from '../contracts/trpc';
import { changeAlgorithm, changePidParams, changeSetpoint, getAllRooms, getRoomByIdentifier, getRoomData } from '../services/roomService';
import { trpc } from '../trpcBase';

const nestedRoomsRouter = trpc.router({
  getAll: trpc.procedure.query(() => {
    return getAllRooms();
  }),
  getById: trpc.procedure.input(getRoomInputSchema).query(({ input }) => {
    return getRoomData(input.roomID);
  }),
  updateSetpoint: trpc.procedure.input(updateSetpointInputSchema).mutation(({ input }) => {
    return changeSetpoint(input.roomID, input.setpointValue);
  }),
  updateAlgorithm: trpc.procedure.input(updateAlgorithmInputSchema).mutation(({ input }) => {
    return changeAlgorithm(input.roomID, input.algorithm);
  }),
  updatePidParams: trpc.procedure.input(updatePidParamsInputSchema).mutation(({ input }) => {
    return changePidParams(input.roomID, input.pidParams);
  }),
});

export const roomsRouter = {
  rooms: nestedRoomsRouter,
  getRoom: trpc.procedure
    .input(getRoomInputSchema)
    .query(({ input }) => {
      return getRoomData(input.roomID);
    }),
  getRooms: trpc.procedure.query(() => {
    return getAllRooms();
  }),
  getRoomById: trpc.procedure.input(getRoomInputSchema).query(({ input }) => {
    return getRoomByIdentifier(input.roomID);
  }),
};
