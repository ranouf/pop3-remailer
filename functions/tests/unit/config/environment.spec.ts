import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { TransferJobError } from '../../../src/domain/errors';
import {
  assertSupportedNodeRuntime,
  loadEnvironmentFile,
  readAppConfig,
} from '../../../src/config/environment';
import { describe, expect, it } from 'vitest';
import {
  firebaseFunctionsRuntime,
  resolveLocalEnvironmentFileName,
  scheduledTransferCron,
  supportedNodeMajorVersion,
} from '../../../src/config/runtime';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';

const createValidEnvironment = (): Record<string, string> => ({
  AMPLITUDE_API_KEY: 'amplitude-key',
  ENVIRONMENT_NAME: 'local',
  FIREBASE_PROJECT_ID: 'demo-pop3-remailer',
  GMAIL_CLIENT_ID: 'gmail-client-id',
  GMAIL_CLIENT_SECRET: 'gmail-client-secret',
  GMAIL_MAX_IMPORT_RETRIES: '2',
  GMAIL_REFRESH_TOKEN: 'gmail-refresh-token',
  GMAIL_TIMEOUT_MS: '15000',
  GMAIL_USER_EMAIL: 'destination@gmail.com',
  POP3_HOST: 'pop.orange.fr',
  POP3_MAX_MESSAGES_PER_RUN: '100',
  POP3_PASSWORD: 'secret-password',
  POP3_PORT: '995',
  POP3_TIMEOUT_MS: '15000',
  POP3_TLS: 'true',
  POP3_USERNAME: 'source@orange.fr',
  SOURCE_EMAIL_ADDRESS: 'source@orange.fr',
  SOURCE_PROVIDER: 'orange',
});

describe('config/runtime', () => {
  it('exposes runtime constants', () => {
    expect(firebaseFunctionsRuntime).toBe('nodejs20');
    expect(supportedNodeMajorVersion).toBe(20);
    expect(scheduledTransferCron).toBe('every 5 minutes');
  });

  it('resolves the expected local environment file names', () => {
    expect(resolveLocalEnvironmentFileName(undefined)).toBe('.env.local');
    expect(resolveLocalEnvironmentFileName('development')).toBe('.env.local');
    expect(resolveLocalEnvironmentFileName('test')).toBe('.env.test.local');
  });
});

describe('config/environment', () => {
  it('reads a valid application configuration', () => {
    const config = readAppConfig({
      env: createValidEnvironment(),
      loadLocalEnvironmentFile: false,
      nodeVersion: '20.19.1',
    });

    expect(config).toEqual({
      analytics: {
        amplitudeApiKey: 'amplitude-key',
        environmentName: 'local',
      },
      firebase: {
        functionsRuntime: 'nodejs20',
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
        schedule: 'every 5 minutes',
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
        nodeMajorVersion: 20,
        nodeVersion: '20.19.1',
      },
      sourceAccount: {
        address: 'source@orange.fr',
        id: 'orange:source@orange.fr',
        provider: 'orange',
        username: 'source@orange.fr',
      },
    });
  });

  it('loads missing variables from a local environment file', () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'pop3-remailer-config-'));

    try {
      writeFileSync(
        join(tempDirectory, '.env.test.local'),
        [
          'FIREBASE_PROJECT_ID=loaded-from-file',
          'ENVIRONMENT_NAME=test',
          'SOURCE_PROVIDER=wanadoo',
          'SOURCE_EMAIL_ADDRESS=source@wanadoo.fr',
          'POP3_HOST=pop.wanadoo.fr',
          'POP3_PORT=995',
          'POP3_USERNAME=source@wanadoo.fr',
          'POP3_PASSWORD=file-password',
          'POP3_TLS=true',
          'POP3_TIMEOUT_MS=20000',
          'POP3_MAX_MESSAGES_PER_RUN=25',
          'GMAIL_CLIENT_ID=file-client-id',
          'GMAIL_CLIENT_SECRET=file-client-secret',
          'GMAIL_REFRESH_TOKEN=file-refresh-token',
          'GMAIL_USER_EMAIL=destination@gmail.com',
          'GMAIL_TIMEOUT_MS=15000',
          'GMAIL_MAX_IMPORT_RETRIES=3',
          'AMPLITUDE_API_KEY=file-amplitude-key',
        ].join('\n'),
      );

      const config = readAppConfig({
        cwd: tempDirectory,
        env: {
          NODE_ENV: 'test',
          POP3_PASSWORD: 'env-password',
        },
        nodeVersion: '20.19.1',
      });

      expect(config.firebase.projectId).toBe('loaded-from-file');
      expect(config.pop3.password).toBe('env-password');
      expect(config.sourceAccount.provider).toBe('wanadoo');
      expect(config.runtime.loadedEnvironmentFilePath).toBe(
        join(tempDirectory, '.env.test.local'),
      );
    } finally {
      rmSync(tempDirectory, {
        force: true,
        recursive: true,
      });
    }
  });

  it('supports Firebase project id fallback variables', () => {
    const env = createValidEnvironment();

    delete env.FIREBASE_PROJECT_ID;
    env.GCLOUD_PROJECT = 'fallback-project-id';

    const config = readAppConfig({
      env,
      loadLocalEnvironmentFile: false,
      nodeVersion: '20.19.1',
    });

    expect(config.firebase.projectId).toBe('fallback-project-id');
  });

  it('accepts POP3 TLS set to false', () => {
    const env = createValidEnvironment();

    env.POP3_TLS = 'false';

    const config = readAppConfig({
      env,
      loadLocalEnvironmentFile: false,
      nodeVersion: '20.19.1',
    });

    expect(config.pop3.tls).toBe(false);
  });

  it('allows overriding UIDL cleanup settings from the environment', () => {
    const env = createValidEnvironment();

    env.UIDL_CLEANUP_BATCH_SIZE = '400';
    env.UIDL_MINIMUM_RETAINED_COUNT = '250';
    env.UIDL_RETENTION_DAYS = '45';

    const config = readAppConfig({
      env,
      loadLocalEnvironmentFile: false,
      nodeVersion: '20.19.1',
    });

    expect(config.job.uidlCleanup).toEqual({
      cleanupBatchSize: 400,
      minimumRetainedCount: 250,
      retentionDays: 45,
    });
  });

  it('throws when a required variable is missing', () => {
    const env = createValidEnvironment();

    delete env.GMAIL_REFRESH_TOKEN;

    expect(() =>
      readAppConfig({
        env,
        loadLocalEnvironmentFile: false,
        nodeVersion: '20.19.1',
      }),
    ).toThrowError(TransferJobError);
  });

  it('throws when an integer configuration is invalid', () => {
    const env = createValidEnvironment();

    env.POP3_PORT = 'invalid';

    expect(() =>
      readAppConfig({
        env,
        loadLocalEnvironmentFile: false,
        nodeVersion: '20.19.1',
      }),
    ).toThrowError(TransferJobError);
  });

  it('throws when the POP3 TLS flag is invalid', () => {
    const env = createValidEnvironment();

    env.POP3_TLS = 'yes';

    expect(() =>
      readAppConfig({
        env,
        loadLocalEnvironmentFile: false,
        nodeVersion: '20.19.1',
      }),
    ).toThrowError(TransferJobError);
  });

  it('throws when an integer configuration is below the minimum', () => {
    const env = createValidEnvironment();

    env.POP3_TIMEOUT_MS = '999';

    expect(() =>
      readAppConfig({
        env,
        loadLocalEnvironmentFile: false,
        nodeVersion: '20.19.1',
      }),
    ).toThrowError(TransferJobError);
  });

  it('throws when an integer configuration is above the maximum', () => {
    const env = createValidEnvironment();

    env.GMAIL_MAX_IMPORT_RETRIES = '11';

    expect(() =>
      readAppConfig({
        env,
        loadLocalEnvironmentFile: false,
        nodeVersion: '20.19.1',
      }),
    ).toThrowError(TransferJobError);
  });

  it('throws when an email address is invalid', () => {
    const env = createValidEnvironment();

    env.GMAIL_USER_EMAIL = 'not-an-email';

    expect(() =>
      readAppConfig({
        env,
        loadLocalEnvironmentFile: false,
        nodeVersion: '20.19.1',
      }),
    ).toThrowError(TransferJobError);
  });

  it('throws when the environment name contains unsupported characters', () => {
    const env = createValidEnvironment();

    env.ENVIRONMENT_NAME = 'prod env';

    expect(() =>
      readAppConfig({
        env,
        loadLocalEnvironmentFile: false,
        nodeVersion: '20.19.1',
      }),
    ).toThrowError(TransferJobError);
  });

  it('throws when the provider is unsupported', () => {
    const env = createValidEnvironment();

    env.SOURCE_PROVIDER = 'gmail';

    expect(() =>
      readAppConfig({
        env,
        loadLocalEnvironmentFile: false,
        nodeVersion: '20.19.1',
      }),
    ).toThrowError(TransferJobError);
  });

  it('throws when the Firebase project id cannot be resolved', () => {
    const env = createValidEnvironment();

    delete env.FIREBASE_PROJECT_ID;

    expect(() =>
      readAppConfig({
        env,
        loadLocalEnvironmentFile: false,
        nodeVersion: '20.19.1',
      }),
    ).toThrowError(TransferJobError);
  });

  it('throws when the node runtime is not supported', () => {
    expect(() => assertSupportedNodeRuntime('24.2.0')).toThrowError(
      TransferJobError,
    );
  });

  it('accepts the supported Node.js runtime version', () => {
    expect(() => assertSupportedNodeRuntime('20.12.2')).not.toThrow();
  });

  it('loads the expected dotenv file into a mutable environment object', () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'pop3-remailer-dotenv-'));

    try {
      const mutableEnvironment: Record<string, string | undefined> = {
        NODE_ENV: 'development',
      };

      writeFileSync(
        join(tempDirectory, '.env.local'),
        'FIREBASE_PROJECT_ID=dotenv-project\n',
      );

      const loadedPath = loadEnvironmentFile({
        cwd: tempDirectory,
        env: mutableEnvironment,
      });

      expect(loadedPath).toBe(join(tempDirectory, '.env.local'));
      expect(mutableEnvironment.FIREBASE_PROJECT_ID).toBe('dotenv-project');
    } finally {
      rmSync(tempDirectory, {
        force: true,
        recursive: true,
      });
    }
  });

  it('returns null when no local environment file exists', () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'pop3-remailer-empty-'));

    try {
      expect(
        loadEnvironmentFile({
          cwd: tempDirectory,
          env: {
            NODE_ENV: 'development',
          },
        }),
      ).toBeNull();
    } finally {
      rmSync(tempDirectory, {
        force: true,
        recursive: true,
      });
    }
  });
});
