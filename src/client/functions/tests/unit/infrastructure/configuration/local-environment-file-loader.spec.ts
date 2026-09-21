import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LocalEnvironmentFileLoader } from '../../../../src/infrastructure/configuration/local-environment-file-loader';
import { ConfigurationManager } from '../../../../src/core/configuration/configuration-manager';

describe('infrastructure/configuration/local-environment-file-loader', () => {
  it('resolves the expected local environment file names', () => {
    const loader = new LocalEnvironmentFileLoader();

    expect(loader.resolveFileName(undefined)).toBe('.env.local');
    expect(loader.resolveFileName('development')).toBe('.env.local');
    expect(loader.resolveFileName('test')).toBe('.env.test.local');
  });

  it('loads the expected dotenv file into a mutable environment object', () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'pop3-remailer-dotenv-'));

    try {
      const mutableEnvironment: Record<string, string | undefined> = {
        NODE_ENV: 'development',
      };

      writeFileSync(
        join(tempDirectory, '.env.local'),
        'APP_FIREBASE_PROJECT_ID=dotenv-project\n',
      );

      const loadedPath = new LocalEnvironmentFileLoader().execute({
        cwd: tempDirectory,
        env: mutableEnvironment,
      });

      expect(loadedPath).toBe(join(tempDirectory, '.env.local'));
      expect(mutableEnvironment.APP_FIREBASE_PROJECT_ID).toBe('dotenv-project');
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
        new LocalEnvironmentFileLoader().execute({
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

  it('cooperates with the application configuration reader', () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'pop3-remailer-config-'));

    try {
      writeFileSync(
        join(tempDirectory, '.env.test.local'),
        [
          'APP_FIREBASE_PROJECT_ID=loaded-from-file',
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

      const configuration = new ConfigurationManager(
        new LocalEnvironmentFileLoader(),
        {
          cwd: tempDirectory,
          env: {
            NODE_ENV: 'test',
            POP3_PASSWORD: 'env-password',
          },
        },
      ).read();

      expect(configuration.firebase.projectId).toBe('loaded-from-file');
      expect(configuration.pop3.password).toBe('env-password');
      expect(configuration.sourceAccount.provider).toBe('wanadoo');
      expect(configuration.runtime.loadedEnvironmentFilePath).toBe(
        join(tempDirectory, '.env.test.local'),
      );
    } finally {
      rmSync(tempDirectory, {
        force: true,
        recursive: true,
      });
    }
  });
});
