import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../../../src/config/environment';

const config: AppConfig = {
  analytics: {
    amplitudeApiKey: 'amplitude-api-key',
    environmentName: 'test',
  },
  firebase: {
    functionsRuntime: 'nodejs22',
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
    nodeMajorVersion: 22,
    nodeVersion: '22.0.0',
  },
  sourceAccount: {
    address: 'source@orange.fr',
    id: 'orange:source@orange.fr',
    provider: 'orange',
    username: 'source@orange.fr',
  },
};

describe('jobs/run-email-transfer-job.helper default behavior', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('reads the app config and uses the default dependencies factory when options are omitted', async () => {
    const readAppConfig = vi.fn(() => config);
    const dependencies = {
      dependencies: 'default-factory',
    };
    const create = vi.fn(() => dependencies);
    const run = vi.fn(() =>
      Promise.resolve({
        summary: {
          status: 'completed',
        },
      }),
    );
    const emailTransferJobConstructor = vi.fn();

    vi.doMock('../../../src/config/environment', () => ({
      readAppConfig,
    }));
    vi.doMock(
      '../../../src/jobs/default-run-email-transfer-job-dependencies.factory',
      () => ({
        DefaultRunEmailTransferJobDependenciesFactory: class {
          public create = create;
        },
      }),
    );
    vi.doMock('../../../src/application/email-transfer-job', () => ({
      EmailTransferJob: class {
        public constructor(
          jobConfig: AppConfig,
          jobDependencies: typeof dependencies,
        ) {
          emailTransferJobConstructor(jobConfig, jobDependencies);
        }

        public run = run;
      },
    }));

    const { RunEmailTransferJobHelper } =
      await import('../../../src/jobs/run-email-transfer-job.helper');

    const result = await RunEmailTransferJobHelper.run();

    expect(readAppConfig).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(config);
    expect(emailTransferJobConstructor).toHaveBeenCalledWith(
      config,
      dependencies,
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.summary.status).toBe('completed');
  });
});
