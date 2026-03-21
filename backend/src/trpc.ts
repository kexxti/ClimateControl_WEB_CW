import { initTRPC } from '@trpc/server';

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
});

export type TrpcRouter = typeof trpcRouter;
