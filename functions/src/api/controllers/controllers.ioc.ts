import type { IocContainerFactory, ServiceIdentifier } from '@tsoa/runtime';
import type { Request } from 'express';

import { GetHealthChecksController } from './healthchecks/get-health-checks.controller';
import { GetStatisticsController } from './statistics/get-statistics.controller';
import { ApiRuntimeContext } from '../runtime/api-runtime';

export const iocContainer: IocContainerFactory = (request) => ({
  get: <T>(controller: ServiceIdentifier<T>): T => {
    const runtime = ApiRuntimeContext.read(request as Request);

    if (
      typeof controller === 'function' &&
      controller === GetHealthChecksController
    ) {
      return new GetHealthChecksController(runtime.healthCheckManager) as T;
    }

    if (
      typeof controller === 'function' &&
      controller === GetStatisticsController
    ) {
      return new GetStatisticsController(runtime.statisticsManager) as T;
    }

    throw new Error(
      `Unsupported tsoa controller: ${(controller as { name?: string }).name ?? 'unknown'}.`,
    );
  },
});
