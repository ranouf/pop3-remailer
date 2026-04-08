import type { Container } from 'inversify';

import type { ApplicationConfiguration } from '../core/configuration/models/application-configuration';
import type { HealthCheckManagerInterface } from '../core/health-check/health-check-manager.interface';
import { HealthCheckManager as DefaultHealthCheckManager } from '../core/health-check/health-check-manager';
import {
  JobRunStatisticsManager as DefaultJobRunStatisticsManager,
  type JobRunStatisticsManagerInterface,
  PersistedJobRunStatisticsManager,
} from '../core/job-run-statistics';
import type { StructuredLogger } from '../core/logging/structured-logger.interface';
import type { Clock } from '../core/time/clock.interface';
import { CoreModule } from '../core/core.module';
import type { AuthTokenVerifierInterface } from './auth/auth-token-verifier.interface';
import { OperationsApi } from './program';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';

export class ApiModule {
  public static readonly HealthCheckManager = Symbol.for(
    'Api.HealthCheckManager',
  );
  public static readonly JobRunStatisticsManager = Symbol.for(
    'Api.JobRunStatisticsManager',
  );
  public static readonly OperationsApi = Symbol.for('Api.OperationsApi');

  public static register(container: Container): void {
    container
      .bind<JobRunStatisticsManagerInterface>(ApiModule.JobRunStatisticsManager)
      .toDynamicValue(() => {
        const sourceAccountId = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        ).sourceAccount.id;
        const fallbackManager = new DefaultJobRunStatisticsManager(
          container.get(InfrastructureModule.JobRunRepository),
          sourceAccountId,
          container.get<Clock>(InfrastructureModule.Clock),
        );

        return new PersistedJobRunStatisticsManager(
          sourceAccountId,
          container.get(InfrastructureModule.JobRunStatisticsRepository),
          fallbackManager,
        );
      })
      .inSingletonScope();

    container
      .bind<HealthCheckManagerInterface>(ApiModule.HealthCheckManager)
      .toDynamicValue(
        () =>
          new DefaultHealthCheckManager(
            container.get(InfrastructureModule.Pop3HealthChecker),
            container.get(InfrastructureModule.GmailHealthChecker),
            container.get(InfrastructureModule.FirestoreHealthChecker),
            container.get(InfrastructureModule.AmplitudeHealthChecker),
            container.get<Clock>(InfrastructureModule.Clock),
          ),
      )
      .inSingletonScope();

    container
      .bind<OperationsApi>(ApiModule.OperationsApi)
      .toDynamicValue(
        () =>
          new OperationsApi(
            container.get<AuthTokenVerifierInterface>(
              InfrastructureModule.AuthTokenVerifier,
            ),
            container.get<JobRunStatisticsManagerInterface>(
              ApiModule.JobRunStatisticsManager,
            ),
            container.get<HealthCheckManagerInterface>(
              ApiModule.HealthCheckManager,
            ),
            container.get<StructuredLogger>(
              InfrastructureModule.StructuredLogger,
            ),
          ),
      )
      .inSingletonScope();
  }
}
