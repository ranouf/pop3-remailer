import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';

import type { ApplicationConfiguration } from '../../../src/core/configuration/models/application-configuration';
import { ConfigurationManager } from '../../../src/core/configuration/configuration-manager';
import { CoreModule } from '../../../src/core/core.module';
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
    schedule: 'every 60 minutes',
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

describe('core/core.module', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers the provided app config as a constant value', () => {
    const container = new Container();

    CoreModule.register(container, { config });

    expect(
      container.get<ApplicationConfiguration>(
        CoreModule.ApplicationConfiguration,
      ),
    ).toBe(config);
    expect(
      container.get<ConfigurationManager>(CoreModule.ConfigurationManager),
    ).toBeInstanceOf(ConfigurationManager);
  });

  it('reads the app config through ConfigurationManager when no override is provided', () => {
    const container = new Container();

    vi.stubEnv('AMPLITUDE_API_KEY', 'amplitude-api-key');
    vi.stubEnv('ENVIRONMENT_NAME', 'test');
    vi.stubEnv('APP_FIREBASE_PROJECT_ID', 'pop3-remailer-test');
    vi.stubEnv('GMAIL_CLIENT_ID', 'gmail-client-id');
    vi.stubEnv('GMAIL_CLIENT_SECRET', 'gmail-client-secret');
    vi.stubEnv('GMAIL_MAX_IMPORT_RETRIES', '1');
    vi.stubEnv('GMAIL_REFRESH_TOKEN', 'gmail-refresh-token');
    vi.stubEnv('GMAIL_TIMEOUT_MS', '10000');
    vi.stubEnv('GMAIL_USER_EMAIL', 'destination@gmail.com');
    vi.stubEnv('POP3_HOST', 'pop.orange.fr');
    vi.stubEnv('POP3_MAX_MESSAGES_PER_RUN', '50');
    vi.stubEnv('POP3_PASSWORD', 'secret');
    vi.stubEnv('POP3_PORT', '995');
    vi.stubEnv('POP3_TIMEOUT_MS', '10000');
    vi.stubEnv('POP3_TLS', 'true');
    vi.stubEnv('POP3_USERNAME', 'source@orange.fr');
    vi.stubEnv('SOURCE_EMAIL_ADDRESS', 'source@orange.fr');
    vi.stubEnv('SOURCE_PROVIDER', 'orange');

    CoreModule.register(container);

    expect(
      container.get<ApplicationConfiguration>(
        CoreModule.ApplicationConfiguration,
      ).sourceAccount.id,
    ).toBe('orange:source@orange.fr');
  });
});
