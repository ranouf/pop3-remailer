import { EnvVarError, from } from 'env-var';

import { SourceProvider } from '../../jobs/email-transfer/models/source-account';
import { JobErrorCategory, TransferJobError } from '../operation-error';
import { LocalEnvironmentFileLoader } from '../../infrastructure/configuration/local-environment-file-loader';
import { ApplicationConfiguration } from './models/application-configuration';
import type { ConfigurationManagerInterface } from './configuration-manager.interface';

export class ConfigurationManager implements ConfigurationManagerInterface {
  public static readonly scheduledTransferCron = 'every 60 minutes';

  public constructor(
    private readonly environmentFileLoader: LocalEnvironmentFileLoader = new LocalEnvironmentFileLoader(),
    private readonly options: {
      readonly cwd?: string;
      readonly env?: Readonly<Record<string, string | undefined>>;
      readonly loadLocalEnvironmentFile?: boolean;
    } = {},
  ) {}

  public read(): ApplicationConfiguration {
    const env = this.normalizeEnvironment({
      ...(this.options.env ?? process.env),
    });
    const cwd = this.options.cwd ?? process.cwd();
    const loadedEnvironmentFilePath =
      this.options.loadLocalEnvironmentFile === false
        ? null
        : this.environmentFileLoader.execute({
            cwd,
            env,
          });
    try {
      const envReader = from(env);
      const environmentName = this.readEnvironmentName(env);
      const sourceProvider = envReader
        .get('SOURCE_PROVIDER')
        .required()
        .asEnum([SourceProvider.Orange, SourceProvider.Wanadoo]);
      const sourceEmailAddress = envReader
        .get('SOURCE_EMAIL_ADDRESS')
        .required()
        .asEmailString()
        .toLowerCase();
      const pop3Username = envReader.get('POP3_USERNAME').required().asString();

      return new ApplicationConfiguration(
        {
          amplitudeApiKey: envReader
            .get('AMPLITUDE_API_KEY')
            .required()
            .asString(),
          environmentName,
        },
        {
          projectId: this.readProjectId(env),
        },
        {
          clientId: envReader.get('GMAIL_CLIENT_ID').required().asString(),
          clientSecret: envReader
            .get('GMAIL_CLIENT_SECRET')
            .required()
            .asString(),
          maxImportRetries: this.readIntegerInRange(
            env,
            'GMAIL_MAX_IMPORT_RETRIES',
            0,
            10,
          ),
          refreshToken: envReader
            .get('GMAIL_REFRESH_TOKEN')
            .required()
            .asString(),
          timeoutMs: this.readIntegerInRange(
            env,
            'GMAIL_TIMEOUT_MS',
            1000,
            120000,
          ),
          userEmail: envReader
            .get('GMAIL_USER_EMAIL')
            .required()
            .asEmailString()
            .toLowerCase(),
        },
        {
          maxMessagesPerRun: this.readIntegerInRange(
            env,
            'POP3_MAX_MESSAGES_PER_RUN',
            1,
            500,
          ),
          schedule: ConfigurationManager.scheduledTransferCron,
          uidlCleanup: {
            cleanupBatchSize: this.readOptionalIntegerInRange(
              env,
              'UIDL_CLEANUP_BATCH_SIZE',
              250,
              1,
              1000,
            ),
            minimumRetainedCount: this.readOptionalIntegerInRange(
              env,
              'UIDL_MINIMUM_RETAINED_COUNT',
              100,
              100,
              10000,
            ),
            retentionDays: this.readOptionalIntegerInRange(
              env,
              'UIDL_RETENTION_DAYS',
              30,
              1,
              3650,
            ),
          },
        },
        {
          host: envReader.get('POP3_HOST').required().asString(),
          password: envReader.get('POP3_PASSWORD').required().asString(),
          port: this.readIntegerInRange(env, 'POP3_PORT', 1, 65535),
          timeoutMs: this.readIntegerInRange(
            env,
            'POP3_TIMEOUT_MS',
            1000,
            120000,
          ),
          tls: envReader.get('POP3_TLS').required().asBoolStrict(),
          username: pop3Username,
        },
        {
          ...(loadedEnvironmentFilePath === null
            ? {}
            : {
                loadedEnvironmentFilePath,
              }),
          environmentName,
        },
        {
          address: sourceEmailAddress,
          id: `${sourceProvider}:${sourceEmailAddress}`,
          provider: sourceProvider,
          username: pop3Username,
        },
      );
    } catch (error) {
      if (TransferJobError.isInstance(error)) {
        throw error;
      }

      if (error instanceof EnvVarError) {
        throw this.createConfigurationError('Invalid configuration.', {
          reason: error.message,
        });
      }

      throw error;
    }
  }

  private createConfigurationError(
    message: string,
    details: Readonly<Record<string, unknown>>,
  ): TransferJobError {
    return new TransferJobError(message, {
      category: JobErrorCategory.Functional,
      code: 'INVALID_CONFIGURATION',
      retriable: false,
      details,
    });
  }

  private ensureInRange(
    key: string,
    value: number,
    minimumValue: number,
    maximumValue: number,
  ): number {
    if (value < minimumValue || value > maximumValue) {
      throw this.createConfigurationError(
        `Environment variable ${key} must be between ${minimumValue} and ${maximumValue}.`,
        {
          key,
          maximumValue,
          minimumValue,
          value,
        },
      );
    }

    return value;
  }

  private normalizeEnvironment(
    env: Readonly<Record<string, string | undefined>>,
  ): Record<string, string | undefined> {
    return Object.fromEntries(
      Object.entries(env).map(([key, value]) => [
        key,
        typeof value === 'string'
          ? value.trim() === ''
            ? undefined
            : value.trim()
          : value,
      ]),
    );
  }

  private readEnvironmentName(
    env: Readonly<Record<string, string | undefined>>,
  ): string {
    const envReader = from(env);
    const environmentName = envReader
      .get('ENVIRONMENT_NAME')
      .required()
      .asString()
      .toLowerCase();

    if (!/^[a-z0-9_-]{2,32}$/iu.test(environmentName)) {
      throw this.createConfigurationError(
        'ENVIRONMENT_NAME contains unsupported characters.',
        {
          key: 'ENVIRONMENT_NAME',
          value: environmentName,
        },
      );
    }

    return environmentName;
  }

  private readIntegerInRange(
    env: Readonly<Record<string, string | undefined>>,
    key: string,
    minimumValue: number,
    maximumValue: number,
  ): number {
    const envReader = from(env);

    return this.ensureInRange(
      key,
      envReader.get(key).required().asInt(),
      minimumValue,
      maximumValue,
    );
  }

  private readOptionalIntegerInRange(
    env: Readonly<Record<string, string | undefined>>,
    key: string,
    fallbackValue: number,
    minimumValue: number,
    maximumValue: number,
  ): number {
    const envReader = from(env);

    return this.ensureInRange(
      key,
      envReader.get(key).default(String(fallbackValue)).asInt(),
      minimumValue,
      maximumValue,
    );
  }

  private readProjectId(
    env: Readonly<Record<string, string | undefined>>,
  ): string {
    const projectId =
      env.APP_FIREBASE_PROJECT_ID ??
      env.FIREBASE_PROJECT_ID ??
      env.GCLOUD_PROJECT ??
      env.GOOGLE_CLOUD_PROJECT ??
      env.GCP_PROJECT;

    if (projectId !== undefined) {
      return projectId;
    }

    throw this.createConfigurationError(
      'Missing Firebase project identifier.',
      {
        keys: [
          'APP_FIREBASE_PROJECT_ID',
          'FIREBASE_PROJECT_ID',
          'GCLOUD_PROJECT',
          'GOOGLE_CLOUD_PROJECT',
          'GCP_PROJECT',
        ],
      },
    );
  }
}
