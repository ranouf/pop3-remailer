import { ConfigurationManager } from '../../../../../src/core/configuration/configuration-manager';

export class ConfigurationManagerHelper {
  public static createValidEnvironment(): Record<string, string> {
    return {
      AMPLITUDE_API_KEY: 'amplitude-key',
      APP_FIREBASE_PROJECT_ID: 'demo-pop3-remailer',
      ENVIRONMENT_NAME: 'local',
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
    };
  }

  public static createManager(
    options: {
      readonly cwd?: string;
      readonly env?: Readonly<Record<string, string | undefined>>;
      readonly loadLocalEnvironmentFile?: boolean;
    } = {},
  ): ConfigurationManager {
    return new ConfigurationManager(undefined, {
      env: options.env ?? this.createValidEnvironment(),
      loadLocalEnvironmentFile: options.loadLocalEnvironmentFile ?? false,
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    });
  }
}
