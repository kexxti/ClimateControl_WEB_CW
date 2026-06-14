import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import {
  commandAckBodySchema,
  deviceBootstrapBodySchema,
  deviceCommandParamsSchema,
  deviceLogsBatchBodySchema,
  deviceUidParamsSchema,
  getCommandsQuerySchema,
  heartbeatBodySchema,
  stateReportBodySchema,
  telemetryBatchBodySchema,
  telemetrySingleBodySchema,
} from '../contracts/deviceRest';
import {
  acknowledgeDeviceCommand,
  bootstrapDevice,
  DeviceRestError,
  getDeviceCommands,
  heartbeatDevice,
  saveDeviceLogs,
  saveStateReport,
  saveTelemetryBatch,
} from '../services/deviceRestService';

export const deviceRestRouter = Router();

const getDeviceKey = (request: Request) => {
  const value = request.header('X-Device-Key');
  return value || undefined;
};

const sendRestError = (response: Response, error: unknown) => {
  if (error instanceof DeviceRestError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Invalid request payload',
        details: z.treeifyError(error),
      },
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: {},
    },
  });
};

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, _next: NextFunction) => {
    handler(request, response).catch((error) => sendRestError(response, error));
  };

deviceRestRouter.post(
  '/devices/:deviceUid/bootstrap',
  asyncRoute(async (request, response) => {
    const params = deviceUidParamsSchema.parse(request.params);
    const body = deviceBootstrapBodySchema.parse(request.body);
    const result = await bootstrapDevice(params.deviceUid, getDeviceKey(request), body, request.ip);
    response.json(result);
  }),
);

deviceRestRouter.post(
  '/devices/:deviceUid/heartbeat',
  asyncRoute(async (request, response) => {
    const params = deviceUidParamsSchema.parse(request.params);
    const body = heartbeatBodySchema.parse(request.body);
    const result = await heartbeatDevice(params.deviceUid, getDeviceKey(request), body);
    response.json(result);
  }),
);

deviceRestRouter.post(
  '/devices/:deviceUid/telemetry',
  asyncRoute(async (request, response) => {
    const params = deviceUidParamsSchema.parse(request.params);
    const body = telemetrySingleBodySchema.parse(request.body);
    const result = await saveTelemetryBatch(params.deviceUid, getDeviceKey(request), {
      ...body,
      readings: [body.reading],
    });
    response.json(result);
  }),
);

deviceRestRouter.post(
  '/devices/:deviceUid/telemetry/batch',
  asyncRoute(async (request, response) => {
    const params = deviceUidParamsSchema.parse(request.params);
    const body = telemetryBatchBodySchema.parse(request.body);
    const result = await saveTelemetryBatch(params.deviceUid, getDeviceKey(request), body);
    response.json(result);
  }),
);

deviceRestRouter.post(
  '/devices/:deviceUid/state',
  asyncRoute(async (request, response) => {
    const params = deviceUidParamsSchema.parse(request.params);
    const body = stateReportBodySchema.parse(request.body);
    const result = await saveStateReport(params.deviceUid, getDeviceKey(request), body);
    response.json(result);
  }),
);

deviceRestRouter.post(
  '/devices/:deviceUid/logs/batch',
  asyncRoute(async (request, response) => {
    const params = deviceUidParamsSchema.parse(request.params);
    const body = deviceLogsBatchBodySchema.parse(request.body);
    const result = await saveDeviceLogs(params.deviceUid, getDeviceKey(request), body);
    response.json(result);
  }),
);

deviceRestRouter.get(
  '/devices/:deviceUid/commands',
  asyncRoute(async (request, response) => {
    const params = deviceUidParamsSchema.parse(request.params);
    const query = getCommandsQuerySchema.parse(request.query);
    const result = await getDeviceCommands(params.deviceUid, getDeviceKey(request), query.limit);
    response.json(result);
  }),
);

deviceRestRouter.post(
  '/devices/:deviceUid/commands/:commandId/ack',
  asyncRoute(async (request, response) => {
    const params = deviceCommandParamsSchema.parse(request.params);
    const body = commandAckBodySchema.parse(request.body);
    const result = await acknowledgeDeviceCommand(params.deviceUid, getDeviceKey(request), params.commandId, body);
    response.json(result);
  }),
);
