import { describe, expect, it } from 'vitest';

import { TransferJobError } from '../../../../src/core/operation-error';
import { ConfigurationManager } from '../../../../src/core/configuration/configuration-manager';
import { ConfigurationManagerHelper } from './helpers/configuration-manager.helper';

describe('core/configuration/configuration-manager runtime constants', () => {
  it('exposes runtime constants', () => {
    expect(ConfigurationManager.scheduledTransferCron).toBe('every 15 minutes');
  });
});

describe('core/configuration/configuration-manager', () => {
  it('reads a valid application configuration', () => {
    const configuration = ConfigurationManagerHelper.createManager().read();

    expect(configuration).toEqual({
      analytics: {
        amplitudeApiKey: 'amplitude-key',
        environmentName: 'local',
      },
      firebase: {
        projectId: 'demo-pop3-remailer',
      },
      gmail: {
        clientId: 'gmail-client-id',
        clientSecret: 'gmail-client-secret',
        maxImportRetries: 2,
        refreshToken: 'gmail-refresh-token',
        timeoutMs: 15000,
        userEmail: 'destination@gmail.com',
      },
      job: {
        maxMessagesPerRun: 100,
        schedule: 'every 15 minutes',
        uidlCleanup: {
          cleanupBatchSize: 250,
          minimumRetainedCount: 100,
          retentionDays: 30,
        },
      },
      pop3: {
        host: 'pop.orange.fr',
        password: 'secret-password',
        port: 995,
        timeoutMs: 15000,
        tls: true,
        username: 'source@orange.fr',
      },
      runtime: {
        environmentName: 'local',
      },
      sourceAccount: {
        address: 'source@orange.fr',
        id: 'orange:source@orange.fr',
        provider: 'orange',
        username: 'source@orange.fr',
      },
    });
  });

  it('supports Firebase project id fallback variables', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    delete env.APP_FIREBASE_PROJECT_ID;
    env.GCLOUD_PROJECT = 'fallback-project-id';

    const configuration = ConfigurationManagerHelper.createManager({
      env,
    }).read();

    expect(configuration.firebase.projectId).toBe('fallback-project-id');
  });

  it('accepts POP3 TLS set to false', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    env.POP3_TLS = 'false';

    const configuration = ConfigurationManagerHelper.createManager({
      env,
    }).read();

    expect(configuration.pop3.tls).toBe(false);
  });

  it('allows overriding UIDL cleanup settings from the environment', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    env.UIDL_CLEANUP_BATCH_SIZE = '400';
    env.UIDL_MINIMUM_RETAINED_COUNT = '250';
    env.UIDL_RETENTION_DAYS = '45';

    const configuration = ConfigurationManagerHelper.createManager({
      env,
    }).read();

    expect(configuration.job.uidlCleanup).toEqual({
      cleanupBatchSize: 400,
      minimumRetainedCount: 250,
      retentionDays: 45,
    });
  });

  it('throws when a required variable is missing', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    delete env.GMAIL_REFRESH_TOKEN;

    expect(() =>
      ConfigurationManagerHelper.createManager({
        env,
      }).read(),
    ).toThrowError(TransferJobError);
  });

  it('throws when an integer configuration is invalid', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    env.POP3_PORT = 'invalid';

    expect(() =>
      ConfigurationManagerHelper.createManager({
        env,
      }).read(),
    ).toThrowError(TransferJobError);
  });

  it('throws when the POP3 TLS flag is invalid', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    env.POP3_TLS = 'yes';

    expect(() =>
      ConfigurationManagerHelper.createManager({
        env,
      }).read(),
    ).toThrowError(TransferJobError);
  });

  it('throws when an integer configuration is below the minimum', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    env.POP3_TIMEOUT_MS = '999';

    expect(() =>
      ConfigurationManagerHelper.createManager({
        env,
      }).read(),
    ).toThrowError(TransferJobError);
  });

  it('throws when an integer configuration is above the maximum', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    env.GMAIL_MAX_IMPORT_RETRIES = '11';

    expect(() =>
      ConfigurationManagerHelper.createManager({
        env,
      }).read(),
    ).toThrowError(TransferJobError);
  });

  it('throws when an email address is invalid', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    env.GMAIL_USER_EMAIL = 'not-an-email';

    expect(() =>
      ConfigurationManagerHelper.createManager({
        env,
      }).read(),
    ).toThrowError(TransferJobError);
  });

  it('throws when the environment name contains unsupported characters', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    env.ENVIRONMENT_NAME = 'prod env';

    expect(() =>
      ConfigurationManagerHelper.createManager({
        env,
      }).read(),
    ).toThrowError(TransferJobError);
  });

  it('throws when the provider is unsupported', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    env.SOURCE_PROVIDER = 'gmail';

    expect(() =>
      ConfigurationManagerHelper.createManager({
        env,
      }).read(),
    ).toThrowError(TransferJobError);
  });

  it('throws when the Firebase project id cannot be resolved', () => {
    const env = ConfigurationManagerHelper.createValidEnvironment();

    delete env.APP_FIREBASE_PROJECT_ID;

    expect(() =>
      ConfigurationManagerHelper.createManager({
        env,
      }).read(),
    ).toThrowError(TransferJobError);
  });
});
