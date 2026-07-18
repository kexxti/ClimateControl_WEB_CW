import {
  createRoomInputSchema,
  getRoomInputSchema,
  softDeleteRoomInputSchema,
  updateAlgorithmInputSchema,
  updatePidParamsInputSchema,
  updateSetpointInputSchema,
} from '../contracts/trpc';
import {
  addRoom,
  changeAlgorithm,
  changePidParams,
  changeSetpoint,
  getAllRooms,
  getRoomByIdentifier,
  getRoomData,
  removeRoomSoftly,
} from '../services/roomService';
import { adminProcedure, protectedProcedure, trpc } from '../trpcBase';

const nestedRoomsRouter = trpc.router({
  getAll: protectedProcedure.query(() => {
    return getAllRooms();
  }),
  getById: protectedProcedure.input(getRoomInputSchema).query(({ input }) => {
    return getRoomData(input.roomID, input);
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
  create: adminProcedure.input(createRoomInputSchema).mutation(({ ctx, input }) => {
    return addRoom(input, ctx.user.id);
  }),
  softDelete: adminProcedure.input(softDeleteRoomInputSchema).mutation(({ ctx, input }) => {
    return removeRoomSoftly(input.roomID, ctx.user.id);
  }),
});

export const roomsRouter = {
  rooms: nestedRoomsRouter,
  getRoom: protectedProcedure
    .input(getRoomInputSchema)
    .query(({ input }) => {
      return getRoomData(input.roomID, input);
    }),
  getRooms: protectedProcedure.query(() => {
    return getAllRooms();
  }),
  getRoomById: protectedProcedure.input(getRoomInputSchema).query(({ input }) => {
    return getRoomByIdentifier(input.roomID);
  }),
};
