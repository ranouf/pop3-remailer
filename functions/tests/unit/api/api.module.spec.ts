import { Container } from 'inversify';
import { describe, expect, it } from 'vitest';

import { ApiModule } from '../../../src/api/api.module';
import { OperationsApi } from '../../../src/api/program';
import type { ApplicationConfiguration } from '../../../src/core/configuration/models/application-configuration';
import { CoreModule } from '../../../src/core/core.module';
import { HealthCheckManager } from '../../../src/core/health-check/health-check-manager';
import { PersistedJobRunStatisticsManager } from '../../../src/core/job-run-statistics';
import { FakeAnalyticsTrackerService } from '../../../src/infrastructure/analytics/tests/fake-analytics-tracker-service';
import { InfrastructureModule } from '../../../src/infrastructure/infrastructure.module';
import { FakeStructuredLogger } from '../../../src/infrastructure/logging/tests/fake-structured-logger';
import { FakeClock } from '../../../src/infrastructure/time/tests/fake-clock';
import { SourceProvider } from '../../../src/jobs/email-transfer/models/source-account';

const config: ApplicationConfiguration = {
  analytics: {
    amplitudeApiKey: 'amplitude-api-key',
    environmentName: 'test',
  },
  firebase: {
    projectId: 'pop3-remailer-test',
  },
  gmail: {
    clientId: 'gmail-client-id',
    clientSecret: 'gmail-client-secret',
    maxImportRetries: 1,
    refreshToken: 'gmail-refresh-token',
    timeoutMs: 10000,
    userEmail: 'destination@gmail.com',
  },
  job: {
    maxMessagesPerRun: 50,
    schedule: 'every 5 minutes',
    uidlCleanup: {
      cleanupBatchSize: 250,
      minimumRetainedCount: 100,
      retentionDays: 30,
    },
  },
  pop3: {
    host: 'pop.orange.fr',
    password: 'secret',
    port: 995,
    timeoutMs: 10000,
    tls: true,
    username: 'source@orange.fr',
  },
  runtime: {
    environmentName: 'test',
  },
  sourceAccount: {
    address: 'source@orange.fr',
    id: 'orange:source@orange.fr',
    provider: SourceProvider.Orange,
    username: 'source@orange.fr',
  },
};

describe('unit/api/api.module', () => {
  it('registers the API services in the container', () => {
    const container = new Container();

    CoreModule.register(container, { config });
    InfrastructureModule.register(container);
    ApiModule.register(container);

    container
      .rebind(InfrastructureModule.AnalyticsTrackerService)
      .toConstantValue(new FakeAnalyticsTrackerService());
    container
      .rebind(InfrastructureModule.Clock)
      .toConstantValue(new FakeClock(new Date('2026-04-07T12:00:00.000Z')));
    container
      .rebind(InfrastructureModule.StructuredLogger)
      .toConstantValue(new FakeStructuredLogger());

    expect(
      container.get<PersistedJobRunStatisticsManager>(
        ApiModule.JobRunStatisticsManager,
      ),
    ).toBeInstanceOf(PersistedJobRunStatisticsManager);
    expect(
      container.get<HealthCheckManager>(ApiModule.HealthCheckManager),
    ).toBeInstanceOf(HealthCheckManager);
    expect(
      container.get<OperationsApi>(ApiModule.OperationsApi),
    ).toBeInstanceOf(OperationsApi);
  });
});
