import { describe, expect, it, vi } from 'vitest';

import type { ApplicationConfiguration } from '../../../src/core/configuration/models/application-configuration';
import { ConfigurationManager } from '../../../src/core/configuration/configuration-manager';
import { SourceProvider } from '../../../src/jobs/email-transfer/models/source-account';

const run = vi.fn();
const containerGet = vi.fn();

vi.mock(
  '../../../src/jobs/email-transfer/bootstrap/email-transfer.container',
  () => ({
    createEmailTransferContainer: vi.fn(() => ({
      get: containerGet,
    })),
  }),
);

import { EmailTransferFunction } from '../../../src/jobs/email-transfer/email-transfer.function';
import { EmailTransferModule } from '../../../src/jobs/email-transfer/email-transfer.module';

describe('unit/transfer-email/email-transfer.function default behavior', () => {
  it('reads config and resolves the job through the DI container', async () => {
    const configuration: ApplicationConfiguration = {
      analytics: {
        amplitudeApiKey: 'key',
        environmentName: 'test',
      },
      firebase: {
        projectId: 'demo',
      },
      gmail: {
        clientId: 'id',
        clientSecret: 'secret',
        maxImportRetries: 1,
        refreshToken: 'refresh',
        timeoutMs: 1000,
        userEmail: 'dest@gmail.com',
      },
      job: {
        maxMessagesPerRun: 10,
        schedule: ConfigurationManager.scheduledTransferCron,
        uidlCleanup: {
          cleanupBatchSize: 10,
          minimumRetainedCount: 5,
          retentionDays: 30,
        },
      },
      pop3: {
        host: 'pop.orange.fr',
        password: 'secret',
        port: 995,
        timeoutMs: 1000,
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
    const configurationManager = {
      read: () => configuration,
    } as const;

    containerGet.mockReturnValue({
      run,
    });
    run.mockResolvedValue({
      summary: {},
    });

    const result = await new EmailTransferFunction({
      configurationManager,
    }).run();

    expect(containerGet).toHaveBeenCalledWith(
      EmailTransferModule.EmailTransferJob,
    );
    expect(run).toHaveBeenCalledOnce();
    expect(result).toEqual({
      summary: {},
    });
  });
});
