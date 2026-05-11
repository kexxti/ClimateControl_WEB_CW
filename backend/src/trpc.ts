import { initTRPC } from '@trpc/server';
import _, { random } from 'lodash'
import { z } from 'zod'

const rooms = _.times(10, (i) => ({
  roomID: `${i}`,
  name: `roomName ${i}`,
  temperature: `${random(-5, 30)}`
}))


const data = [
  { id: 'id1', name: 'Temp', description: 'Temperature at the ...' },
  { id: 'id2', name: 'Rooms', description: 'List of rooms ...' },
  { id: 'id3', name: 'Graphs', description: 'Graphs of temperature ...' },
];

const trpc = initTRPC.create();

export const trpcRouter = trpc.router({
  getData: trpc.procedure.query(() => {
    return { data };
  }),
  getRoom: trpc.procedure.input(z.object({
      roomID: z.string()
    })
  ).query(({ input }) => {
    const room = rooms.find((room) => room.roomID === input.roomID)
    return {room : room || null}
  }) 
});

export type TrpcRouter = typeof trpcRouter;
