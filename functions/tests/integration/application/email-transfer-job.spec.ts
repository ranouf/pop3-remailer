import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../../../src/config/environment';
import { EmailTransferJob } from '../../../src/application/email-transfer-job';
import type {
  Pop3MessageMetadata,
  RawEmailMessage,
  SourceAccount,
} from '../../../src/domain/email';
import type { JobRunSummary } from '../../../src/domain/job-run';
import type {
  AnalyticsTracker,
  GmailImportedMessageLookup,
  GmailImportResult,
  GmailMailService,
  JobRunRepository,
  Pop3MailService,
  ProcessedEmailRepository,
  StructuredLogger,
  TrackerEventProperties,
  TransferEventName,
} from '../../../src/domain/ports';
import type {
  ProcessedEmailRecord,
  UidlClaimResult,
} from '../../../src/domain/processed-email';
import { createUidl, type Uidl } from '../../../src/domain/uidl';
import { TransferJobError } from '../../../src/domain/errors';

class FakeAnalyticsTracker implements AnalyticsTracker {
  public readonly events: Array<{
    readonly eventName: TransferEventName;
    readonly properties: TrackerEventProperties;
  }> = [];
  public flushCalls = 0;

  public flush(): Promise<void> {
    this.flushCalls += 1;
    return Promise.resolve();
  }

  public track(
    eventName: TransferEventName,
    properties: TrackerEventProperties,
  ): Promise<void> {
    this.events.push({
      eventName,
      properties,
    });
    return Promise.resolve();
  }
}

class FakeGmailMailService implements GmailMailService {
  public importError: Error | null = null;
  public importResult: GmailImportResult = {
    gmailMessageId: 'gmail-imported-1',
    gmailThreadId: 'thread-1',
  };
  public lookupResult: GmailImportedMessageLookup | null = {
    gmailMessageId: 'gmail-reconciled-1',
  };
  public readonly importedMessages: Array<{
    readonly gmailUserEmail: string;
    readonly message: RawEmailMessage;
  }> = [];

  public findImportedMessageByRfc822MessageId(): Promise<GmailImportedMessageLookup | null> {
    return Promise.resolve(this.lookupResult);
  }

  public importMessage(
    gmailUserEmail: string,
    message: RawEmailMessage,
  ): Promise<GmailImportResult> {
    this.importedMessages.push({
      gmailUserEmail,
      message,
    });

    if (this.importError !== null) {
      return Promise.reject(this.importError);
    }

    return Promise.resolve(this.importResult);
  }
}

class FakeJobRunRepository implements JobRunRepository {
  public readonly finishedSummaries: JobRunSummary[] = [];
  public readonly startedSummaries: JobRunSummary[] = [];

  public saveFinished(summary: JobRunSummary): Promise<void> {
    this.finishedSummaries.push(summary);
    return Promise.resolve();
  }

  public saveStarted(summary: JobRunSummary): Promise<void> {
    this.startedSummaries.push(summary);
    return Promise.resolve();
  }
}

class FakeLogger implements StructuredLogger {
  public readonly debugCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];
  public readonly errorCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];
  public readonly infoCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];
  public readonly warnCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];

  public debug(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.debugCalls.push(context);
  }

  public error(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.errorCalls.push(context);
  }

  public info(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.infoCalls.push(context);
  }

  public warn(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.warnCalls.push(context);
  }
}

class FakePop3MailService implements Pop3MailService {
  public getMessageError: Error | null = null;
  public listMessagesError: Error | null = null;
  public readonly listedMessages: Pop3MessageMetadata[] = [];
  public readonly rawMessages = new Map<number, RawEmailMessage>();

  public getMessage(
    _sourceAccount: SourceAccount,
    messageNumber: number,
  ): Promise<RawEmailMessage> {
    if (this.getMessageError !== null) {
      return Promise.reject(this.getMessageError);
    }

    const rawMessage = this.rawMessages.get(messageNumber);

    if (rawMessage === undefined) {
      throw new Error(`Missing raw message ${messageNumber}`);
    }

    return Promise.resolve(rawMessage);
  }

  public listMessages(): Promise<readonly Pop3MessageMetadata[]> {
    if (this.listMessagesError !== null) {
      return Promise.reject(this.listMessagesError);
    }

    return Promise.resolve(this.listedMessages);
  }
}

class FakeProcessedEmailRepository implements ProcessedEmailRepository {
  public readonly failedMarks: Array<{
    readonly errorMessage: string;
    readonly jobId: string;
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
  }> = [];
  public readonly importedMarks: Array<{
    readonly gmailMessageId?: string;
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
  }> = [];
  public markImportedError: Error | null = null;
  public markImportedFailureCount = 0;
  public readonly records = new Map<string, ProcessedEmailRecord>();

  public claimForProcessing(params: {
    readonly jobId: string;
    readonly metadata: {
      readonly messageId?: string;
      readonly messageNumber?: number;
      readonly messageSize?: number;
    };
    readonly sourceAccount: SourceAccount;
    readonly uidl: Uidl;
  }): Promise<UidlClaimResult> {
    const key = `${params.sourceAccount.id}:${params.uidl}`;
    const existingRecord = this.records.get(key);

    if (existingRecord?.status === 'imported') {
      return Promise.resolve({
        record: existingRecord,
        status: 'already_imported',
      });
    }

    if (existingRecord?.status === 'processing') {
      return Promise.resolve({
        record: existingRecord,
        status: 'already_processing',
      });
    }

    const now = new Date('2026-04-01T00:00:00.000Z');
    const record: ProcessedEmailRecord = {
      createdAt: existingRecord?.createdAt ?? now,
      metadata: {
        ...(existingRecord?.metadata ?? {}),
        ...params.metadata,
        claimJobId: params.jobId,
      },
      sourceAccountId: params.sourceAccount.id,
      sourceProvider: params.sourceAccount.provider,
      status: 'processing',
      uidl: params.uidl,
      updatedAt: now,
    };

    this.records.set(key, record);

    return Promise.resolve({
      record,
      status: 'claimed',
    });
  }

  public findByUidl(
    sourceAccountId: string,
    uidl: Uidl,
  ): Promise<ProcessedEmailRecord | null> {
    return Promise.resolve(
      this.records.get(`${sourceAccountId}:${uidl}`) ?? null,
    );
  }

  public markFailed(params: {
    readonly errorMessage: string;
    readonly jobId: string;
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
  }): Promise<void> {
    this.failedMarks.push(params);
    const key = `${params.sourceAccountId}:${params.uidl}`;
    const existingRecord = this.records.get(key);

    if (existingRecord !== undefined) {
      this.records.set(key, {
        ...existingRecord,
        lastError: params.errorMessage,
        metadata: {
          ...existingRecord.metadata,
          claimJobId: params.jobId,
        },
        status: 'failed',
        updatedAt: new Date('2026-04-01T00:05:00.000Z'),
      });
    }

    return Promise.resolve();
  }

  public markImported(params: {
    readonly gmailMessageId?: string;
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
  }): Promise<void> {
    this.importedMarks.push(params);

    if (this.markImportedError !== null && this.markImportedFailureCount > 0) {
      this.markImportedFailureCount -= 1;
      return Promise.reject(this.markImportedError);
    }

    const key = `${params.sourceAccountId}:${params.uidl}`;
    const existingRecord = this.records.get(key);

    if (existingRecord !== undefined) {
      this.records.set(key, {
        ...existingRecord,
        importedAt: new Date('2026-04-01T00:04:00.000Z'),
        status: 'imported',
        updatedAt: new Date('2026-04-01T00:04:00.000Z'),
        ...(params.gmailMessageId === undefined
          ? {}
          : {
              gmailMessageId: params.gmailMessageId,
            }),
      });
    }

    return Promise.resolve();
  }
}

const sourceAccount: SourceAccount = {
  address: 'source@orange.fr',
  id: 'orange:source@orange.fr',
  provider: 'orange',
  username: 'source@orange.fr',
};

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
  sourceAccount,
};

const buildClock = () => {
  const dates = [
    new Date('2026-04-01T00:00:00.000Z'),
    new Date('2026-04-01T00:00:05.000Z'),
  ];
  let index = 0;

  return {
    now: () => dates[Math.min(index++, dates.length - 1)] as Date,
  };
};

const buildMetadata = (
  messageNumber: number,
  uidl: string,
): Pop3MessageMetadata => ({
  messageNumber,
  messageSize: 128 + messageNumber,
  uidl: createUidl(uidl),
});

const buildRawMessage = (
  messageNumber: number,
  uidl: string,
  messageId = `<message-${messageNumber}@example.com>`,
): RawEmailMessage => ({
  ...buildMetadata(messageNumber, uidl),
  rawMessage: `From: source@example.com\r\nMessage-ID: ${messageId}\r\n\r\nBody ${messageNumber}`,
});

describe('integration/application/email-transfer-job', () => {
  it('transfers new emails, skips already imported ones, and records the final summary', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const gmailMailService = new FakeGmailMailService();
    const jobRunRepository = new FakeJobRunRepository();
    const logger = new FakeLogger();
    const pop3MailService = new FakePop3MailService();
    const processedEmailRepository = new FakeProcessedEmailRepository();
    pop3MailService.listedMessages.push(
      buildMetadata(2, 'uidl-2'),
      buildMetadata(1, 'uidl-1'),
    );
    pop3MailService.rawMessages.set(2, buildRawMessage(2, 'uidl-2'));
    processedEmailRepository.records.set(
      `${sourceAccount.id}:${createUidl('uidl-1')}`,
      {
        createdAt: new Date('2026-03-31T23:55:00.000Z'),
        importedAt: new Date('2026-03-31T23:56:00.000Z'),
        metadata: {
          claimJobId: 'older-job',
          messageNumber: 1,
        },
        sourceAccountId: sourceAccount.id,
        sourceProvider: sourceAccount.provider,
        status: 'imported',
        uidl: createUidl('uidl-1'),
        updatedAt: new Date('2026-03-31T23:56:00.000Z'),
      },
    );

    const job = new EmailTransferJob(config, {
      analyticsTracker,
      clock: buildClock(),
      gmailMailService,
      jobRunRepository,
      logger,
      pop3MailService,
      processedEmailRepository,
    });

    const result = await job.run();

    expect(result.summary).toMatchObject({
      detectedCount: 2,
      failedCount: 0,
      processedCount: 2,
      skippedCount: 1,
      status: 'completed',
      transferredCount: 1,
    });
    expect(gmailMailService.importedMessages).toHaveLength(1);
    expect(processedEmailRepository.importedMarks).toHaveLength(1);
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      'job_started',
      'email_detected',
      'email_transfer_started',
      'email_transferred',
      'email_detected',
      'email_skipped_already_processed',
      'job_finished',
      'job_duration_recorded',
    ]);
    expect(analyticsTracker.flushCalls).toBe(1);
    expect(jobRunRepository.startedSummaries).toHaveLength(1);
    expect(jobRunRepository.finishedSummaries).toHaveLength(1);
    expect(logger.infoCalls).not.toHaveLength(0);
  });

  it('tracks Gmail failures, marks the email as failed, and completes with failures', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const gmailMailService = new FakeGmailMailService();
    gmailMailService.importError = new TransferJobError('gmail import failed', {
      category: 'technical',
      code: 'GMAIL_IMPORT_FAILED',
      retriable: true,
    });
    const jobRunRepository = new FakeJobRunRepository();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(3, 'uidl-3'));
    pop3MailService.rawMessages.set(3, buildRawMessage(3, 'uidl-3'));
    const processedEmailRepository = new FakeProcessedEmailRepository();

    const job = new EmailTransferJob(config, {
      analyticsTracker,
      clock: buildClock(),
      gmailMailService,
      jobRunRepository,
      logger: new FakeLogger(),
      pop3MailService,
      processedEmailRepository,
    });

    const result = await job.run();

    expect(result.summary).toMatchObject({
      failedCount: 1,
      processedCount: 1,
      status: 'failed',
      transferredCount: 0,
    });
    expect(processedEmailRepository.failedMarks).toHaveLength(1);
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      'job_started',
      'email_detected',
      'email_transfer_started',
      'gmail_import_failed',
      'email_transfer_failed',
      'email_processing_failed',
      'job_finished',
      'job_duration_recorded',
    ]);
  });

  it('reconciles Gmail import success when Firestore markImported fails after the import', async () => {
    const gmailMailService = new FakeGmailMailService();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(4, 'uidl-4'));
    pop3MailService.rawMessages.set(4, buildRawMessage(4, 'uidl-4'));
    const processedEmailRepository = new FakeProcessedEmailRepository();
    processedEmailRepository.markImportedError = new Error(
      'firestore unavailable',
    );
    processedEmailRepository.markImportedFailureCount = 1;

    const job = new EmailTransferJob(config, {
      analyticsTracker: new FakeAnalyticsTracker(),
      clock: buildClock(),
      gmailMailService,
      jobRunRepository: new FakeJobRunRepository(),
      logger: new FakeLogger(),
      pop3MailService,
      processedEmailRepository,
    });

    const result = await job.run();

    expect(result.summary.status).toBe('completed');
    expect(processedEmailRepository.importedMarks).toHaveLength(2);
    expect(processedEmailRepository.importedMarks[1]).toMatchObject({
      gmailMessageId: 'gmail-reconciled-1',
      uidl: createUidl('uidl-4'),
    });
  });

  it('skips emails that are already being processed by another execution', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(5, 'uidl-5'));
    const processedEmailRepository = new FakeProcessedEmailRepository();
    processedEmailRepository.records.set(
      `${sourceAccount.id}:${createUidl('uidl-5')}`,
      {
        createdAt: new Date('2026-03-31T23:55:00.000Z'),
        metadata: {
          claimJobId: 'other-job',
          messageNumber: 5,
        },
        sourceAccountId: sourceAccount.id,
        sourceProvider: sourceAccount.provider,
        status: 'processing',
        uidl: createUidl('uidl-5'),
        updatedAt: new Date('2026-03-31T23:56:00.000Z'),
      },
    );

    const job = new EmailTransferJob(config, {
      analyticsTracker,
      clock: buildClock(),
      gmailMailService: new FakeGmailMailService(),
      jobRunRepository: new FakeJobRunRepository(),
      logger: new FakeLogger(),
      pop3MailService,
      processedEmailRepository,
    });

    const result = await job.run();

    expect(result.summary).toMatchObject({
      detectedCount: 1,
      failedCount: 0,
      processedCount: 1,
      skippedCount: 1,
      status: 'completed',
      transferredCount: 0,
    });
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      'job_started',
      'email_detected',
      'email_skipped_already_processed',
      'job_finished',
      'job_duration_recorded',
    ]);
  });

  it('fails the email when reconciliation is impossible because the raw message has no RFC822 message id', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const gmailMailService = new FakeGmailMailService();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(6, 'uidl-6'));
    pop3MailService.rawMessages.set(6, {
      ...buildMetadata(6, 'uidl-6'),
      rawMessage: 'From: source@example.com\r\n\r\nBody without message id',
    });
    const processedEmailRepository = new FakeProcessedEmailRepository();
    processedEmailRepository.markImportedError = new Error(
      'firestore unavailable',
    );
    processedEmailRepository.markImportedFailureCount = 1;

    const job = new EmailTransferJob(config, {
      analyticsTracker,
      clock: buildClock(),
      gmailMailService,
      jobRunRepository: new FakeJobRunRepository(),
      logger: new FakeLogger(),
      pop3MailService,
      processedEmailRepository,
    });

    const result = await job.run();

    expect(result.summary).toMatchObject({
      failedCount: 1,
      status: 'failed',
    });
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      'job_started',
      'email_detected',
      'email_transfer_started',
      'email_transfer_failed',
      'email_processing_failed',
      'job_finished',
      'job_duration_recorded',
    ]);
  });

  it('wraps unexpected POP3 retrieval errors into a processing failure', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(7, 'uidl-7'));
    pop3MailService.getMessageError = new Error('socket closed unexpectedly');

    const job = new EmailTransferJob(config, {
      analyticsTracker,
      clock: buildClock(),
      gmailMailService: new FakeGmailMailService(),
      jobRunRepository: new FakeJobRunRepository(),
      logger: new FakeLogger(),
      pop3MailService,
      processedEmailRepository: new FakeProcessedEmailRepository(),
    });

    const result = await job.run();

    expect(result.summary).toMatchObject({
      failedCount: 1,
      processedCount: 1,
      status: 'failed',
    });
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      'job_started',
      'email_detected',
      'email_transfer_started',
      'email_transfer_failed',
      'email_processing_failed',
      'job_finished',
      'job_duration_recorded',
    ]);
  });

  it('fails the whole job and tracks POP3 connection issues when listing messages fails', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listMessagesError = new TransferJobError(
      'pop3 connection failed',
      {
        category: 'technical',
        code: 'POP3_CONNECTION_FAILED',
        retriable: true,
      },
    );

    const job = new EmailTransferJob(config, {
      analyticsTracker,
      clock: buildClock(),
      gmailMailService: new FakeGmailMailService(),
      jobRunRepository: new FakeJobRunRepository(),
      logger: new FakeLogger(),
      pop3MailService,
      processedEmailRepository: new FakeProcessedEmailRepository(),
    });

    await expect(job.run()).rejects.toBeInstanceOf(TransferJobError);
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      'job_started',
      'pop3_connection_failed',
      'job_finished',
      'job_duration_recorded',
    ]);
  });
});
