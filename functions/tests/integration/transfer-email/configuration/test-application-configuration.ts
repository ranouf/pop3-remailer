import type { ApplicationConfiguration } from '../../../../src/core/configuration/models/application-configuration';
import { SourceProvider } from '../../../../src/jobs/email-transfer/models/source-account';

export const testApplicationConfiguration: ApplicationConfiguration = {
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
    schedule: 'every 15 minutes',
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
