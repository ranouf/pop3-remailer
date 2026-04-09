import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createApplication: vi.fn(() => {
    const app = express();

    app.get('/ping', (_request, response) => {
      response.status(200).json({
        ok: true,
      });
    });

    return app;
  }),
  onRequest: vi.fn(
    (_options, handler: express.RequestHandler): express.RequestHandler =>
      handler,
  ),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onRequest: mocks.onRequest,
}));

import { OperationsApi } from '../../../src/api/program';
import { OperationsApiSettings } from '../../../src/api/settings/operations-api.settings';

describe('unit/api/program.createHandler', () => {
  beforeEach(() => {
    mocks.createApplication.mockClear();
    mocks.onRequest.mockClear();
    vi.restoreAllMocks();
  });

  it('creates a handler from an explicit api instance', async () => {
    const handler = OperationsApi.createHandler({
      api: {
        createApplication: mocks.createApplication,
      } as never,
    });

    const response = await request(handler).get('/ping');

    expect(mocks.createApplication).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
    });
  });

  it('falls back to the default api factory when no option is provided', async () => {
    const createSpy = vi.spyOn(OperationsApi, 'create').mockReturnValue({
      createApplication: mocks.createApplication,
    } as never);

    const handler = OperationsApi.createHandler();
    const response = await request(handler).get('/ping');

    expect(createSpy).toHaveBeenCalledOnce();
    expect(mocks.createApplication).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it('creates a Firebase request function with the configured settings', () => {
    vi.spyOn(OperationsApi, 'create').mockReturnValue({
      createApplication: mocks.createApplication,
    } as never);

    const handler = OperationsApi.createFunction();

    expect(mocks.onRequest).toHaveBeenCalledOnce();
    expect(mocks.onRequest).toHaveBeenCalledWith(
      {
        maxInstances: OperationsApiSettings.maxInstances,
        region: OperationsApiSettings.region,
        timeoutSeconds: OperationsApiSettings.timeoutSeconds,
      },
      expect.any(Function),
    );
    expect(handler).toBeTypeOf('function');
  });
});
