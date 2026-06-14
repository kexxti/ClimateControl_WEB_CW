import express from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { trpcRouter } from './trpc';
import cors from 'cors';
import { deviceRestRouter } from './routers/deviceRest';
import { startOfflineDetection } from './services/offlineService';
import { createTrpcContext } from './trpcBase';

const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json({ limit: '1mb' }));
expressApp.get('/ping', (req, res) => {
  res.send('pong');
});

expressApp.use('/api', deviceRestRouter);

expressApp.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: trpcRouter,
    createContext: createTrpcContext,
  }),
);

expressApp.listen(3000, () => {
  console.info('Listening at http://localhost:3000');
});

startOfflineDetection();
