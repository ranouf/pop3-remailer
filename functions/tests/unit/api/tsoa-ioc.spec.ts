import express from 'express';
import { describe, expect, it } from 'vitest';

import { GetHealthChecksController } from '../../../src/api/controllers/healthchecks/get-health-checks.controller';
import { GetStatisticsController } from '../../../src/api/controllers/statistics/get-statistics.controller';
import { iocContainer } from '../../../src/api/bootstrap/tsoa-ioc';
import { ApiRuntimeContext } from '../../../src/api/runtime/api-runtime';

const createRequest = () => {
  const application = express();
  const runtime = ApiRuntimeContext.create(
    {
      verifyIdToken: () =>
        Promise.resolve({
          uid: 'user-1',
        }),
    },
    {
      getStatistics: () => Promise.reject(new Error('not used')),
    },
    {
      execute: () => Promise.reject(new Error('not used')),
    },
    {
      debug(): void {},
      error(): void {},
      info(): void {},
      warn(): void {},
    },
  );

  ApiRuntimeContext.attach(application, runtime);

  return {
    app: application,
  };
};

describe('unit/api/tsoa-ioc', () => {
  it('resolves supported controllers from the request runtime', () => {
    const requestObject = createRequest() as never;
    const container = iocContainer(requestObject);

    expect(container.get(GetStatisticsController)).toBeInstanceOf(
      GetStatisticsController,
    );
    expect(container.get(GetHealthChecksController)).toBeInstanceOf(
      GetHealthChecksController,
    );
  });

  it('throws for unsupported controllers', () => {
    const requestObject = createRequest() as never;
    const container = iocContainer(requestObject);

    class UnsupportedController {}

    expect(() => container.get(UnsupportedController)).toThrow(
      'Unsupported tsoa controller: UnsupportedController.',
    );
  });
});
