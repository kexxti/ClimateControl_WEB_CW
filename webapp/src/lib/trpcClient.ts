import type { TrpcRouter } from '@WEB_CW/backend/src/trpc';
import { createTRPCReact } from '@trpc/react-query';

export const trpc = createTRPCReact<TrpcRouter>();
