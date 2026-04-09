import type { Application, Request } from 'express';

import type { ApplicationConfiguration } from '../../core/configuration/models/application-configuration';
import type { JobRunStatisticsManagerInterface } from '../../core/job-run-statistics';
import type { HealthCheckManagerInterface } from '../../core/health-check/health-check-manager.interface';
import type { StructuredLogger } from '../../core/logging/structured-logger.interface';
import type { AuthTokenVerifierInterface } from '../auth/auth-token-verifier.interface';

export class ApiRuntime {
  public constructor(
    public readonly authTokenVerifier: AuthTokenVerifierInterface,
    public readonly configuration: ApplicationConfiguration,
    public readonly statisticsManager: JobRunStatisticsManagerInterface,
    public readonly healthCheckManager: HealthCheckManagerInterface,
    public readonly logger: StructuredLogger,
  ) {}
}

export class ApiRuntimeContext {
  private static readonly localsKey = 'operationsApiRuntime';

  public static create(
    authTokenVerifier: AuthTokenVerifierInterface,
    configuration: ApplicationConfiguration,
    statisticsManager: JobRunStatisticsManagerInterface,
    healthCheckManager: HealthCheckManagerInterface,
    logger: StructuredLogger,
  ): ApiRuntime {
    return new ApiRuntime(
      authTokenVerifier,
      configuration,
      statisticsManager,
      healthCheckManager,
      logger,
    );
  }

  public static attach(application: Application, runtime: ApiRuntime): void {
    application.locals[ApiRuntimeContext.localsKey] = runtime;
  }

  public static read(request: Request): ApiRuntime {
    const runtime = request.app.locals[ApiRuntimeContext.localsKey] as unknown;

    if (runtime === undefined) {
      throw new Error('Operations API runtime is unavailable.');
    }

    return runtime as ApiRuntime;
  }
}
