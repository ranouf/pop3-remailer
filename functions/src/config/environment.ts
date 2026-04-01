import { join } from 'node:path';

import { parse } from 'dotenv';

import { TransferJobError } from '../domain/errors';
import { createSourceAccountId, type SourceProvider } from '../domain/email';
import { existsSync, readFileSync } from 'node:fs';
import {
  firebaseFunctionsRuntime,
  resolveLocalEnvironmentFileName,
  scheduledTransferCron,
  supportedNodeMajorVersion,
} from './runtime';

export interface ConfigEnvironment {
  readonly [key: string]: string | undefined;
}

export interface AppConfig {
  readonly analytics: {
    readonly amplitudeApiKey: string;
    readonly environmentName: string;
  };
  readonly firebase: {
    readonly functionsRuntime: typeof firebaseFunctionsRuntime;
    readonly projectId: string;
  };
  readonly gmail: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly maxImportRetries: number;
    readonly refreshToken: string;
    readonly timeoutMs: number;
    readonly userEmail: string;
  };
  readonly job: {
    readonly maxMessagesPerRun: number;
    readonly schedule: typeof scheduledTransferCron;
    readonly uidlCleanup: {
      readonly cleanupBatchSize: number;
      readonly minimumRetainedCount: number;
      readonly retentionDays: number;
    };
  };
  readonly pop3: {
    readonly host: string;
    readonly password: string;
    readonly port: number;
    readonly timeoutMs: number;
    readonly tls: boolean;
    readonly username: string;
  };
  readonly runtime: {
    readonly environmentName: string;
    readonly loadedEnvironmentFilePath?: string;
    readonly nodeMajorVersion: number;
    readonly nodeVersion: string;
  };
  readonly sourceAccount: {
    readonly address: string;
    readonly id: string;
    readonly provider: SourceProvider;
    readonly username: string;
  };
}

export interface LoadEnvironmentFileOptions {
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
}

export interface ReadAppConfigOptions {
  readonly cwd?: string;
  readonly env?: ConfigEnvironment;
  readonly loadLocalEnvironmentFile?: boolean;
  readonly nodeVersion?: string;
}

const environmentNamePattern = /^[a-z0-9_-]{2,32}$/iu;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const configError = (
  message: string,
  details: Readonly<Record<string, unknown>>,
): TransferJobError =>
  new TransferJobError(message, {
    category: 'functional',
    code: 'INVALID_CONFIGURATION',
    retriable: false,
    details,
  });

const requireNonEmptyString = (env: ConfigEnvironment, key: string): string => {
  const value = env[key]?.trim();

  if (value === undefined || value.length === 0) {
    throw configError(`Missing required environment variable ${key}.`, {
      key,
    });
  }

  return value;
};

const requireEmail = (env: ConfigEnvironment, key: string): string => {
  const value = requireNonEmptyString(env, key);

  if (!emailPattern.test(value)) {
    throw configError(`Invalid email address in ${key}.`, {
      key,
      value,
    });
  }

  return value.toLowerCase();
};

const requireInteger = (
  env: ConfigEnvironment,
  key: string,
  options: {
    readonly max?: number;
    readonly min?: number;
  },
): number => {
  const rawValue = requireNonEmptyString(env, key);
  const value = Number.parseInt(rawValue, 10);

  if (Number.isNaN(value)) {
    throw configError(`Environment variable ${key} must be an integer.`, {
      key,
      value: rawValue,
    });
  }

  if (options.min !== undefined && value < options.min) {
    throw configError(`Environment variable ${key} is below the minimum.`, {
      key,
      min: options.min,
      value,
    });
  }

  if (options.max !== undefined && value > options.max) {
    throw configError(`Environment variable ${key} is above the maximum.`, {
      key,
      max: options.max,
      value,
    });
  }

  return value;
};

const readOptionalInteger = (
  env: ConfigEnvironment,
  key: string,
  fallbackValue: number,
  options: {
    readonly max?: number;
    readonly min?: number;
  },
): number => {
  if (env[key]?.trim() === undefined || env[key]?.trim().length === 0) {
    return fallbackValue;
  }

  return requireInteger(env, key, options);
};

const parseBoolean = (env: ConfigEnvironment, key: string): boolean => {
  const rawValue = requireNonEmptyString(env, key).toLowerCase();

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw configError(`Environment variable ${key} must be true or false.`, {
    key,
    value: rawValue,
  });
};

const requireEnvironmentName = (env: ConfigEnvironment): string => {
  const value = requireNonEmptyString(env, 'ENVIRONMENT_NAME').toLowerCase();

  if (!environmentNamePattern.test(value)) {
    throw configError('ENVIRONMENT_NAME contains unsupported characters.', {
      key: 'ENVIRONMENT_NAME',
      value,
    });
  }

  return value;
};

const requireSourceProvider = (env: ConfigEnvironment): SourceProvider => {
  const value = requireNonEmptyString(env, 'SOURCE_PROVIDER').toLowerCase();

  if (value !== 'orange' && value !== 'wanadoo') {
    throw configError('SOURCE_PROVIDER must be orange or wanadoo.', {
      key: 'SOURCE_PROVIDER',
      value,
    });
  }

  return value;
};

const resolveProjectId = (env: ConfigEnvironment): string =>
  env.APP_FIREBASE_PROJECT_ID?.trim() ||
  env.FIREBASE_PROJECT_ID?.trim() ||
  env.GCLOUD_PROJECT?.trim() ||
  env.GOOGLE_CLOUD_PROJECT?.trim() ||
  env.GCP_PROJECT?.trim() ||
  (() => {
    throw configError('Missing Firebase project identifier.', {
      keys: [
        'APP_FIREBASE_PROJECT_ID',
        'FIREBASE_PROJECT_ID',
        'GCLOUD_PROJECT',
        'GOOGLE_CLOUD_PROJECT',
        'GCP_PROJECT',
      ],
    });
  })();

export const loadEnvironmentFile = (
  options: LoadEnvironmentFileOptions,
): string | null => {
  const fileName = resolveLocalEnvironmentFileName(options.env.NODE_ENV);
  const filePath = join(options.cwd, fileName);

  if (!existsSync(filePath)) {
    return null;
  }

  const parsedEnvironment = parse(readFileSync(filePath, 'utf8'));

  for (const [key, value] of Object.entries(parsedEnvironment)) {
    if (options.env[key] === undefined) {
      options.env[key] = value;
    }
  }

  return filePath;
};

export const assertSupportedNodeRuntime = (nodeVersion: string): void => {
  const [majorVersion] = nodeVersion.split('.');
  const parsedMajorVersion = Number.parseInt(majorVersion ?? '', 10);

  if (parsedMajorVersion !== supportedNodeMajorVersion) {
    throw configError('Unsupported Node.js runtime version.', {
      expectedMajor: supportedNodeMajorVersion,
      receivedVersion: nodeVersion,
    });
  }
};

export const readAppConfig = (
  options: ReadAppConfigOptions = {},
): AppConfig => {
  const env = { ...(options.env ?? process.env) };
  const cwd = options.cwd ?? process.cwd();
  const nodeVersion = options.nodeVersion ?? process.versions.node;

  const loadedEnvironmentFilePath =
    options.loadLocalEnvironmentFile === false
      ? null
      : loadEnvironmentFile({
          cwd,
          env,
        });

  assertSupportedNodeRuntime(nodeVersion);

  const environmentName = requireEnvironmentName(env);
  const sourceProvider = requireSourceProvider(env);
  const sourceEmailAddress = requireEmail(env, 'SOURCE_EMAIL_ADDRESS');
  const pop3Username = requireNonEmptyString(env, 'POP3_USERNAME');

  return {
    analytics: {
      amplitudeApiKey: requireNonEmptyString(env, 'AMPLITUDE_API_KEY'),
      environmentName,
    },
    firebase: {
      functionsRuntime: firebaseFunctionsRuntime,
      projectId: resolveProjectId(env),
    },
    gmail: {
      clientId: requireNonEmptyString(env, 'GMAIL_CLIENT_ID'),
      clientSecret: requireNonEmptyString(env, 'GMAIL_CLIENT_SECRET'),
      maxImportRetries: requireInteger(env, 'GMAIL_MAX_IMPORT_RETRIES', {
        min: 0,
        max: 10,
      }),
      refreshToken: requireNonEmptyString(env, 'GMAIL_REFRESH_TOKEN'),
      timeoutMs: requireInteger(env, 'GMAIL_TIMEOUT_MS', {
        min: 1000,
        max: 120000,
      }),
      userEmail: requireEmail(env, 'GMAIL_USER_EMAIL'),
    },
    job: {
      maxMessagesPerRun: requireInteger(env, 'POP3_MAX_MESSAGES_PER_RUN', {
        min: 1,
        max: 500,
      }),
      schedule: scheduledTransferCron,
      uidlCleanup: {
        cleanupBatchSize: readOptionalInteger(
          env,
          'UIDL_CLEANUP_BATCH_SIZE',
          250,
          {
            min: 1,
            max: 1000,
          },
        ),
        minimumRetainedCount: readOptionalInteger(
          env,
          'UIDL_MINIMUM_RETAINED_COUNT',
          100,
          {
            min: 100,
            max: 10000,
          },
        ),
        retentionDays: readOptionalInteger(env, 'UIDL_RETENTION_DAYS', 30, {
          min: 1,
          max: 3650,
        }),
      },
    },
    pop3: {
      host: requireNonEmptyString(env, 'POP3_HOST'),
      password: requireNonEmptyString(env, 'POP3_PASSWORD'),
      port: requireInteger(env, 'POP3_PORT', {
        min: 1,
        max: 65535,
      }),
      timeoutMs: requireInteger(env, 'POP3_TIMEOUT_MS', {
        min: 1000,
        max: 120000,
      }),
      tls: parseBoolean(env, 'POP3_TLS'),
      username: pop3Username,
    },
    runtime: {
      ...(loadedEnvironmentFilePath === null
        ? {}
        : {
            loadedEnvironmentFilePath,
          }),
      environmentName,
      nodeMajorVersion: supportedNodeMajorVersion,
      nodeVersion,
    },
    sourceAccount: {
      address: sourceEmailAddress,
      id: createSourceAccountId(sourceProvider, sourceEmailAddress),
      provider: sourceProvider,
      username: pop3Username,
    },
  };
};
