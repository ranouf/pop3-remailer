import { describe, expect, it, vi } from 'vitest';

import type { UidlClaimResult } from '../../../src/domain/processed-email';
import type { AppConfig } from '../../../src/config/environment';
import type { EmailTransferJobDependencies } from '../../../src/application/email-transfer-job-dependencies.interface';
import { RunEmailTransferJobHelper } from '../../../src/jobs/run-email-transfer-job.helper';

const config: AppConfig = {
  analytics: {
    amplitudeApiKey: 'amplitude-api-key',
    environmentName: 'test',
  },
  firebase: {
    functionsRuntime: 'nodejs20',
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
    nodeMajorVersion: 20,
    nodeVersion: '20.19.1',
  },
  sourceAccount: {
    address: 'source@orange.fr',
    id: 'orange:source@orange.fr',
    provider: 'orange',
    username: 'source@orange.fr',
  },
};

describe('jobs/run-email-transfer-job.helper', () => {
  it('runs the email transfer job with injected dependencies', async () => {
    const claimResult: UidlClaimResult = {
      record: {
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        metadata: {
          claimJobId: 'job-1',
        },
        sourceAccountId: config.sourceAccount.id,
        sourceProvider: config.sourceAccount.provider,
        status: 'processing',
        uidl: 'uidl-job-1' as never,
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      status: 'claimed',
    };
    const analyticsTracker = {
      flush: vi.fn(() => Promise.resolve()),
      track: vi.fn(() => Promise.resolve()),
    };
    const dependencies: EmailTransferJobDependencies = {
      analyticsTracker,
      gmailMailService: {
        findImportedMessageByRfc822MessageId: vi.fn(() =>
          Promise.resolve(null),
        ),
        importMessage: vi.fn(() =>
          Promise.resolve({
            gmailMessageId: 'gmail-message-id',
          }),
        ),
      },
      jobRunRepository: {
        saveFinished: vi.fn(() => Promise.resolve()),
        saveStarted: vi.fn(() => Promise.resolve()),
      },
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      pop3MailService: {
        getMessage: vi.fn(() =>
          Promise.resolve({
            messageNumber: 1,
            messageSize: 128,
            rawMessage:
              'From: source@example.com\r\nMessage-ID: <job@example.com>\r\n\r\nBody',
            uidl: 'uidl-job-1' as never,
          }),
        ),
        listMessages: vi.fn(() =>
          Promise.resolve([
            {
              messageNumber: 1,
              messageSize: 128,
              uidl: 'uidl-job-1' as never,
            },
          ]),
        ),
      },
      processedEmailRepository: {
        claimForProcessing: vi.fn(() => Promise.resolve(claimResult)),
        findByUidl: vi.fn(() => Promise.resolve(null)),
        markFailed: vi.fn(() => Promise.resolve()),
        markImported: vi.fn(() => Promise.resolve()),
      },
    };
    const dependenciesFactory = {
      create: vi.fn(() => dependencies),
    };

    const result = await RunEmailTransferJobHelper.run({
      config,
      dependenciesFactory,
    });

    expect(dependenciesFactory.create).toHaveBeenCalledWith(config);
    expect(result.summary.status).toBe('completed');
  });
});
