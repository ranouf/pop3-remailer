import { describe, expect, it } from 'vitest';

import {
  EmailRecordStatus,
  ProcessedEmailCleanupResult,
  ProcessedEmailEntity as ProcessedEmailEntityModel,
  ProcessedEmailMetadata,
  type ProcessedEmailEntity,
  type UidlClaimResult,
  UidlClaimResult as UidlClaimResultModel,
  UidlClaimStatus,
} from '../../../src/core/email/processed-email';
import type { ApplicationConfiguration } from '../../../src/core/configuration/models/application-configuration';
import { EmailTransferJob } from '../../../src/jobs/email-transfer/email-transfer-job';
import {
  type AnalyticsTrackEvent,
  TransferEventName,
  type AnalyticsTrackerService,
} from '../../../src/core/analytics';
import {
  JobRunEntity,
  JobRunStatus,
  type JobRunRepository,
} from '../../../src/core/job-run';
import type {
  JobRunStatisticsEntity,
  JobRunStatisticsManagerInterface,
  JobRunStatisticsRepositoryInterface,
} from '../../../src/core/job-run-statistics';
import {
  GmailImportedMessageLookup as GmailImportedMessageLookupModel,
  GmailImportResult as GmailImportResultModel,
  type GmailImportedMessageLookup,
  type GmailImportResult,
  type GmailMailService,
} from '../../../src/core/email/gmail';
import {
  Pop3MessageMetadata,
  Pop3MessageReference,
  RawEmailMessage,
  type Pop3MailServiceInterface,
} from '../../../src/core/email/pop3';
import type { ProcessedEmailRepository } from '../../../src/core/email/processed-email/processed-email-repository.interface';
import {
  SourceProvider,
  type SourceAccount,
} from '../../../src/jobs/email-transfer/models/source-account';
import {
  JobErrorCategory,
  TransferJobError,
} from '../../../src/core/operation-error';
import { Uidl } from '../../../src/core/email/uidl';
import type { StructuredLogger } from '../../../src/core/logging/structured-logger.interface';

class FakeAnalyticsTracker implements AnalyticsTrackerService {
  public readonly events: AnalyticsTrackEvent[] = [];
  public flushCalls = 0;

  public flush(): Promise<void> {
    this.flushCalls += 1;
    return Promise.resolve();
  }

  public track(event: AnalyticsTrackEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

class FakeGmailMailService implements GmailMailService {
  public importError: Error | null = null;
  public importResult: GmailImportResult = new GmailImportResultModel({
    gmailMessageId: 'gmail-imported-1',
    gmailThreadId: 'thread-1',
  });
  public lookupResult: GmailImportedMessageLookup | null =
    new GmailImportedMessageLookupModel({
      gmailMessageId: 'gmail-reconciled-1',
    });
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
  public readonly deletedJobIds: string[] = [];
  public readonly finishedSummaries: JobRunEntity[] = [];
  public listBySourceAccountResult: readonly JobRunEntity[] = [];
  public readonly startedSummaries: JobRunEntity[] = [];

  public delete(jobId: string): Promise<void> {
    this.deletedJobIds.push(jobId);
    return Promise.resolve();
  }

  public listBySourceAccount(): Promise<readonly JobRunEntity[]> {
    return Promise.resolve(this.listBySourceAccountResult);
  }

  public saveFinished(summary: JobRunEntity): Promise<void> {
    this.finishedSummaries.push(summary);
    return Promise.resolve();
  }

  public saveStarted(summary: JobRunEntity): Promise<void> {
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

class FakePop3MailService implements Pop3MailServiceInterface {
  public readonly listedMessageReferences: Pop3MessageReference[] = [];
  public getMessageError: Error | null = null;
  public getMessageMetadataError: Error | null = null;
  public listMessagesError: Error | null = null;
  public listMessageReferencesError: Error | null = null;
  public readonly listMessagesCalls: Array<{
    readonly limit?: number;
  }> = [];
  public readonly listMessageReferencesCalls: Array<{
    readonly limit?: number;
  }> = [];
  public readonly listedMessages: Pop3MessageMetadata[] = [];
  public readonly rawMessages = new Map<number, RawEmailMessage>();

  public getMessageMetadata(
    _sourceAccount: SourceAccount,
    messageNumber: number,
  ): Promise<Pop3MessageMetadata> {
    if (this.getMessageMetadataError !== null) {
      return Promise.reject(this.getMessageMetadataError);
    }

    const metadata = this.listedMessages.find(
      (message) => message.messageNumber === messageNumber,
    );

    if (metadata === undefined) {
      throw new Error(`Missing metadata ${messageNumber}`);
    }

    return Promise.resolve(metadata);
  }

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

  public listMessageReferences(
    _sourceAccount: SourceAccount,
    options?: {
      readonly limit?: number;
    },
  ): Promise<readonly Pop3MessageReference[]> {
    this.listMessageReferencesCalls.push(options ?? {});

    if (this.listMessageReferencesError !== null) {
      return Promise.reject(this.listMessageReferencesError);
    }

    return Promise.resolve(this.listedMessageReferences);
  }

  public listMessages(
    _sourceAccount: SourceAccount,
    options?: {
      readonly limit?: number;
    },
  ): Promise<readonly Pop3MessageMetadata[]> {
    this.listMessagesCalls.push(options ?? {});

    if (this.listMessagesError !== null) {
      return Promise.reject(this.listMessagesError);
    }

    return Promise.resolve(this.listedMessages);
  }
}

class FakeJobRunStatisticsManager implements JobRunStatisticsManagerInterface {
  public statistics: JobRunStatisticsEntity | null = null;

  public getStatistics(): Promise<JobRunStatisticsEntity> {
    if (this.statistics === null) {
      throw new Error('Missing statistics entity.');
    }

    return Promise.resolve(this.statistics);
  }
}

class FakeJobRunStatisticsRepository implements JobRunStatisticsRepositoryInterface {
  public readonly savedStatistics: JobRunStatisticsEntity[] = [];
  public saveError: Error | null = null;

  public get(): Promise<JobRunStatisticsEntity | null> {
    return Promise.resolve(this.savedStatistics.at(-1) ?? null);
  }

  public save(statistics: JobRunStatisticsEntity): Promise<void> {
    this.savedStatistics.push(statistics);

    if (this.saveError !== null) {
      return Promise.reject(this.saveError);
    }

    return Promise.resolve();
  }
}

class FakeProcessedEmailRepository implements ProcessedEmailRepository {
  public cleanupError: Error | null = null;
  public cleanupResult: ProcessedEmailCleanupResult =
    new ProcessedEmailCleanupResult({
      deletedCount: 0,
      retainedCount: 0,
    });
  public readonly cleanupRuns: Array<{
    readonly cleanupBatchSize: number;
    readonly minimumRetainedCount: number;
    readonly now: Date;
    readonly retentionDays: number;
    readonly sourceAccountId: string;
  }> = [];
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
  public readonly records = new Map<string, ProcessedEmailEntity>();

  public claimForProcessing(params: {
    readonly jobId: string;
    readonly metadata: ProcessedEmailMetadata;
    readonly sourceAccount: SourceAccount;
    readonly uidl: Uidl;
  }): Promise<UidlClaimResult> {
    const key = `${params.sourceAccount.id}:${params.uidl.toString()}`;
    const existingRecord = this.records.get(key);

    if (existingRecord?.isImported()) {
      return Promise.resolve(
        new UidlClaimResultModel(
          existingRecord,
          UidlClaimStatus.AlreadyImported,
        ),
      );
    }

    if (existingRecord?.isProcessing()) {
      return Promise.resolve(
        new UidlClaimResultModel(
          existingRecord,
          UidlClaimStatus.AlreadyProcessing,
        ),
      );
    }

    const now = new Date('2026-04-01T00:00:00.000Z');
    const entity = new ProcessedEmailEntityModel({
      createdAt: existingRecord?.createdAt ?? now,
      metadata:
        existingRecord === undefined
          ? params.metadata.withClaimJobId(params.jobId)
          : existingRecord.metadata
              .mergeWith(params.metadata)
              .withClaimJobId(params.jobId),
      sourceAccountId: params.sourceAccount.id,
      sourceProvider: params.sourceAccount.provider,
      status: EmailRecordStatus.Processing,
      uidl: params.uidl,
      updatedAt: now,
    });

    this.records.set(key, entity);

    return Promise.resolve(
      new UidlClaimResultModel(entity, UidlClaimStatus.Claimed),
    );
  }

  public cleanupImportedRecords(params: {
    readonly cleanupBatchSize: number;
    readonly minimumRetainedCount: number;
    readonly now: Date;
    readonly retentionDays: number;
    readonly sourceAccountId: string;
  }): Promise<ProcessedEmailCleanupResult> {
    this.cleanupRuns.push(params);

    if (this.cleanupError !== null) {
      return Promise.reject(this.cleanupError);
    }

    return Promise.resolve(this.cleanupResult);
  }

  public findByUidl(
    sourceAccountId: string,
    uidl: Uidl,
  ): Promise<ProcessedEmailEntity | null> {
    return Promise.resolve(
      this.records.get(`${sourceAccountId}:${uidl.toString()}`) ?? null,
    );
  }

  public findByUidls(
    sourceAccountId: string,
    uidls: readonly Uidl[],
  ): Promise<ReadonlyMap<string, ProcessedEmailEntity>> {
    const entities = new Map<string, ProcessedEmailEntity>();

    for (const uidl of uidls) {
      const entity = this.records.get(`${sourceAccountId}:${uidl.toString()}`);

      if (entity !== undefined) {
        entities.set(uidl.toString(), entity);
      }
    }

    return Promise.resolve(entities);
  }

  public markFailed(params: {
    readonly errorMessage: string;
    readonly jobId: string;
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
  }): Promise<void> {
    this.failedMarks.push(params);
    const key = `${params.sourceAccountId}:${params.uidl.toString()}`;
    const existingRecord = this.records.get(key);

    if (existingRecord !== undefined) {
      this.records.set(
        key,
        new ProcessedEmailEntityModel({
          createdAt: existingRecord.createdAt,
          ...(existingRecord.gmailMessageId === undefined
            ? {}
            : {
                gmailMessageId: existingRecord.gmailMessageId,
              }),
          ...(existingRecord.importedAt === undefined
            ? {}
            : {
                importedAt: existingRecord.importedAt,
              }),
          lastError: params.errorMessage,
          metadata: existingRecord.metadata.withClaimJobId(params.jobId),
          sourceAccountId: existingRecord.sourceAccountId,
          sourceProvider: existingRecord.sourceProvider,
          status: EmailRecordStatus.Failed,
          uidl: existingRecord.uidl,
          updatedAt: new Date('2026-04-01T00:05:00.000Z'),
        }),
      );
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

    const key = `${params.sourceAccountId}:${params.uidl.toString()}`;
    const existingRecord = this.records.get(key);

    if (existingRecord !== undefined) {
      this.records.set(
        key,
        new ProcessedEmailEntityModel({
          createdAt: existingRecord.createdAt,
          ...(params.gmailMessageId === undefined
            ? existingRecord.gmailMessageId === undefined
              ? {}
              : {
                  gmailMessageId: existingRecord.gmailMessageId,
                }
            : {
                gmailMessageId: params.gmailMessageId,
              }),
          importedAt: new Date('2026-04-01T00:04:00.000Z'),
          ...(existingRecord.lastError === undefined
            ? {}
            : {
                lastError: existingRecord.lastError,
              }),
          metadata: existingRecord.metadata,
          sourceAccountId: existingRecord.sourceAccountId,
          sourceProvider: existingRecord.sourceProvider,
          status: EmailRecordStatus.Imported,
          uidl: existingRecord.uidl,
          updatedAt: new Date('2026-04-01T00:04:00.000Z'),
        }),
      );
    }

    return Promise.resolve();
  }
}

const sourceAccount: SourceAccount = {
  address: 'source@orange.fr',
  id: 'orange:source@orange.fr',
  provider: SourceProvider.Orange,
  username: 'source@orange.fr',
};

const config: ApplicationConfiguration = {
  analytics: {
    amplitudeApiKey: 'amplitude-api-key',
    environmentName: 'test',
  },
  firebase: {
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
    schedule: 'every 60 minutes',
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

const buildStatisticsEntity = (): JobRunStatisticsEntity => ({
  sourceAccountId: sourceAccount.id,
  dailyPoints: [],
  generatedAt: new Date('2026-04-01T00:00:05.000Z'),
  kpis: {
    detectedLast24h: 0,
    failedLast24h: 0,
    lastError: null,
    lastRun: null,
    lastSuccess: null,
    transferredLast24h: 0,
  },
  recentErrors: [],
  recentRuns: [],
});

const buildMetadata = (
  messageNumber: number,
  uidl: string,
): Pop3MessageMetadata =>
  new Pop3MessageMetadata({
    messageNumber,
    messageSize: 128 + messageNumber,
    uidl: Uidl.create(uidl),
  });

const buildRawMessage = (
  messageNumber: number,
  uidl: string,
  messageId = `<message-${messageNumber}@example.com>`,
): RawEmailMessage =>
  new RawEmailMessage({
    ...(messageId === undefined
      ? {}
      : {
          messageId,
        }),
    messageNumber,
    messageSize: 128 + messageNumber,
    rawMessage: `From: source@example.com\r\nMessage-ID: ${messageId}\r\n\r\nBody ${messageNumber}`,
    uidl: Uidl.create(uidl),
  });

describe('tests/unit/transfer-email/email-transfer-job', () => {
  it('transfers new emails, skips already imported ones, and records the final summary', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const gmailMailService = new FakeGmailMailService();
    const jobRunRepository = new FakeJobRunRepository();
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    const logger = new FakeLogger();
    const pop3MailService = new FakePop3MailService();
    const processedEmailRepository = new FakeProcessedEmailRepository();
    pop3MailService.listedMessages.push(
      buildMetadata(2, 'uidl-2'),
      buildMetadata(1, 'uidl-1'),
    );
    pop3MailService.rawMessages.set(2, buildRawMessage(2, 'uidl-2'));
    processedEmailRepository.records.set(
      `${sourceAccount.id}:${Uidl.create('uidl-1').toString()}`,
      new ProcessedEmailEntityModel({
        createdAt: new Date('2026-03-31T23:55:00.000Z'),
        importedAt: new Date('2026-03-31T23:56:00.000Z'),
        metadata: new ProcessedEmailMetadata({
          claimJobId: 'older-job',
          messageNumber: 1,
        }),
        sourceAccountId: sourceAccount.id,
        sourceProvider: sourceAccount.provider,
        status: EmailRecordStatus.Imported,
        uidl: Uidl.create('uidl-1'),
        updatedAt: new Date('2026-03-31T23:56:00.000Z'),
      }),
    );

    const job = new EmailTransferJob(
      config,
      analyticsTracker,
      gmailMailService,
      jobRunRepository,
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      logger,
      pop3MailService,
      processedEmailRepository,
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary).toMatchObject({
      detectedCount: 2,
      failedCount: 0,
      processedCount: 2,
      skippedCount: 1,
      status: JobRunStatus.Completed,
      transferredCount: 1,
    });
    expect(gmailMailService.importedMessages).toHaveLength(1);
    expect(processedEmailRepository.importedMarks).toHaveLength(1);
    expect(processedEmailRepository.cleanupRuns).toHaveLength(1);
    expect(processedEmailRepository.cleanupRuns[0]).toMatchObject({
      cleanupBatchSize: 250,
      minimumRetainedCount: 100,
      retentionDays: 30,
      sourceAccountId: sourceAccount.id,
    });
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      TransferEventName.JobStarted,
      TransferEventName.EmailDetected,
      TransferEventName.EmailTransferStarted,
      TransferEventName.EmailTransferred,
      TransferEventName.EmailDetected,
      TransferEventName.EmailSkippedAlreadyProcessed,
      TransferEventName.JobFinished,
      TransferEventName.JobDurationRecorded,
    ]);
    expect(analyticsTracker.flushCalls).toBe(1);
    expect(jobRunRepository.startedSummaries).toHaveLength(1);
    expect(jobRunRepository.finishedSummaries).toHaveLength(1);
    expect(jobRunStatisticsRepository.savedStatistics).toHaveLength(1);
    expect(logger.infoCalls).not.toHaveLength(0);
  });

  it('tracks Gmail failures, marks the email as failed, and completes with failures', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const gmailMailService = new FakeGmailMailService();
    gmailMailService.importError = new TransferJobError('gmail import failed', {
      category: JobErrorCategory.Technical,
      cause: new Error('Request had insufficient authentication scopes.'),
      code: 'GMAIL_IMPORT_FAILED',
      details: {
        causeResponseStatus: 403,
        messageId: '<message-3@example.com>',
      },
      retriable: true,
    });
    const jobRunRepository = new FakeJobRunRepository();
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(3, 'uidl-3'));
    pop3MailService.rawMessages.set(3, buildRawMessage(3, 'uidl-3'));
    const processedEmailRepository = new FakeProcessedEmailRepository();
    const logger = new FakeLogger();

    const job = new EmailTransferJob(
      config,
      analyticsTracker,
      gmailMailService,
      jobRunRepository,
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      logger,
      pop3MailService,
      processedEmailRepository,
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary).toMatchObject({
      failedCount: 1,
      processedCount: 1,
      status: JobRunStatus.Failed,
      transferredCount: 0,
    });
    expect(processedEmailRepository.failedMarks).toHaveLength(1);
    expect(jobRunStatisticsRepository.savedStatistics).toHaveLength(1);
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      TransferEventName.JobStarted,
      TransferEventName.EmailDetected,
      TransferEventName.EmailTransferStarted,
      TransferEventName.GmailImportFailed,
      TransferEventName.EmailTransferFailed,
      TransferEventName.EmailProcessingFailed,
      TransferEventName.JobFinished,
      TransferEventName.JobDurationRecorded,
    ]);
    const warnContext = logger.warnCalls.at(-1);

    expect(warnContext).toBeDefined();

    if (warnContext === undefined) {
      return;
    }

    expect(warnContext.code).toBe('GMAIL_IMPORT_FAILED');
    expect(warnContext.error).toBe('gmail import failed');
    expect(warnContext.errorCategory).toBe('technical');
    expect(warnContext.errorCauseMessage).toBe(
      'Request had insufficient authentication scopes.',
    );
    expect(warnContext.errorCauseName).toBe('Error');
    expect(warnContext.retriable).toBe(true);

    const errorDetails = warnContext.errorDetails;

    expect(errorDetails).toMatchObject({
      causeResponseStatus: 403,
      messageId: '<message-3@example.com>',
    });
  });

  it('reconciles Gmail import success when Firestore markImported fails after the import', async () => {
    const gmailMailService = new FakeGmailMailService();
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(4, 'uidl-4'));
    pop3MailService.rawMessages.set(4, buildRawMessage(4, 'uidl-4'));
    const processedEmailRepository = new FakeProcessedEmailRepository();
    processedEmailRepository.markImportedError = new Error(
      'firestore unavailable',
    );
    processedEmailRepository.markImportedFailureCount = 1;

    const job = new EmailTransferJob(
      config,
      new FakeAnalyticsTracker(),
      gmailMailService,
      new FakeJobRunRepository(),
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      new FakeLogger(),
      pop3MailService,
      processedEmailRepository,
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary.status).toBe(JobRunStatus.Completed);
    expect(processedEmailRepository.importedMarks).toHaveLength(2);
    expect(processedEmailRepository.importedMarks[1]).toMatchObject({
      gmailMessageId: 'gmail-reconciled-1',
      uidl: Uidl.create('uidl-4'),
    });
  });

  it('skips emails that are already being processed by another execution', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(5, 'uidl-5'));
    const processedEmailRepository = new FakeProcessedEmailRepository();
    processedEmailRepository.records.set(
      `${sourceAccount.id}:${Uidl.create('uidl-5').toString()}`,
      new ProcessedEmailEntityModel({
        createdAt: new Date('2026-03-31T23:55:00.000Z'),
        metadata: new ProcessedEmailMetadata({
          claimJobId: 'other-job',
          messageNumber: 5,
        }),
        sourceAccountId: sourceAccount.id,
        sourceProvider: sourceAccount.provider,
        status: EmailRecordStatus.Processing,
        uidl: Uidl.create('uidl-5'),
        updatedAt: new Date('2026-03-31T23:56:00.000Z'),
      }),
    );

    const job = new EmailTransferJob(
      config,
      analyticsTracker,
      new FakeGmailMailService(),
      new FakeJobRunRepository(),
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      new FakeLogger(),
      pop3MailService,
      processedEmailRepository,
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary).toMatchObject({
      detectedCount: 1,
      failedCount: 0,
      processedCount: 1,
      skippedCount: 1,
      status: JobRunStatus.Completed,
      transferredCount: 0,
    });
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      TransferEventName.JobStarted,
      TransferEventName.EmailDetected,
      TransferEventName.EmailSkippedAlreadyProcessed,
      TransferEventName.JobFinished,
      TransferEventName.JobDurationRecorded,
    ]);
  });

  it('fails the email when reconciliation is impossible because the raw message has no RFC822 message id', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const gmailMailService = new FakeGmailMailService();
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(6, 'uidl-6'));
    pop3MailService.rawMessages.set(
      6,
      new RawEmailMessage({
        messageNumber: 6,
        messageSize: 134,
        rawMessage: 'From: source@example.com\r\n\r\nBody without message id',
        uidl: Uidl.create('uidl-6'),
      }),
    );
    const processedEmailRepository = new FakeProcessedEmailRepository();
    processedEmailRepository.markImportedError = new Error(
      'firestore unavailable',
    );
    processedEmailRepository.markImportedFailureCount = 1;

    const job = new EmailTransferJob(
      config,
      analyticsTracker,
      gmailMailService,
      new FakeJobRunRepository(),
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      new FakeLogger(),
      pop3MailService,
      processedEmailRepository,
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary).toMatchObject({
      failedCount: 1,
      status: JobRunStatus.Failed,
    });
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      TransferEventName.JobStarted,
      TransferEventName.EmailDetected,
      TransferEventName.EmailTransferStarted,
      TransferEventName.EmailTransferFailed,
      TransferEventName.EmailProcessingFailed,
      TransferEventName.JobFinished,
      TransferEventName.JobDurationRecorded,
    ]);
  });

  it('wraps unexpected POP3 retrieval errors into a processing failure', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(7, 'uidl-7'));
    pop3MailService.getMessageError = new Error('socket closed unexpectedly');

    const job = new EmailTransferJob(
      config,
      analyticsTracker,
      new FakeGmailMailService(),
      new FakeJobRunRepository(),
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      new FakeLogger(),
      pop3MailService,
      new FakeProcessedEmailRepository(),
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary).toMatchObject({
      failedCount: 1,
      processedCount: 1,
      status: JobRunStatus.Failed,
    });
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      TransferEventName.JobStarted,
      TransferEventName.EmailDetected,
      TransferEventName.EmailTransferStarted,
      TransferEventName.EmailTransferFailed,
      TransferEventName.EmailProcessingFailed,
      TransferEventName.JobFinished,
      TransferEventName.JobDurationRecorded,
    ]);
  });

  it('fails the whole job when listing messages fails', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listMessagesError = new TransferJobError(
      'pop3 connection failed',
      {
        category: JobErrorCategory.Technical,
        code: 'POP3_CONNECTION_FAILED',
        retriable: true,
      },
    );

    const job = new EmailTransferJob(
      config,
      analyticsTracker,
      new FakeGmailMailService(),
      new FakeJobRunRepository(),
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      new FakeLogger(),
      pop3MailService,
      new FakeProcessedEmailRepository(),
      buildClock(),
    );

    await expect(job.run()).rejects.toBeInstanceOf(TransferJobError);
    expect(analyticsTracker.events.map((event) => event.eventName)).toEqual([
      TransferEventName.JobStarted,
      TransferEventName.JobFinished,
      TransferEventName.JobDurationRecorded,
    ]);
  });

  it('does not fail the job when imported UIDL cleanup fails', async () => {
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    const logger = new FakeLogger();
    const pop3MailService = new FakePop3MailService();
    const processedEmailRepository = new FakeProcessedEmailRepository();
    processedEmailRepository.cleanupError = new Error('cleanup unavailable');
    pop3MailService.listedMessages.push(buildMetadata(1, 'uidl-1'));
    pop3MailService.rawMessages.set(1, buildRawMessage(1, 'uidl-1'));

    const job = new EmailTransferJob(
      config,
      new FakeAnalyticsTracker(),
      new FakeGmailMailService(),
      new FakeJobRunRepository(),
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      logger,
      pop3MailService,
      processedEmailRepository,
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary.status).toBe(JobRunStatus.Completed);
    expect(logger.warnCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UIDL_CLEANUP_FAILED',
          error: 'Failed to cleanup imported UIDL records.',
        }),
      ]),
    );
  });

  it('does not fail the job when job run statistics persistence fails', async () => {
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    jobRunStatisticsRepository.saveError = new Error('statistics unavailable');
    const logger = new FakeLogger();
    const pop3MailService = new FakePop3MailService();
    pop3MailService.listedMessages.push(buildMetadata(1, 'uidl-1'));
    pop3MailService.rawMessages.set(1, buildRawMessage(1, 'uidl-1'));
    const processedEmailRepository = new FakeProcessedEmailRepository();

    const job = new EmailTransferJob(
      config,
      new FakeAnalyticsTracker(),
      new FakeGmailMailService(),
      new FakeJobRunRepository(),
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      logger,
      pop3MailService,
      processedEmailRepository,
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary.status).toBe(JobRunStatus.Completed);
    expect(jobRunStatisticsRepository.savedStatistics).toHaveLength(1);
    expect(logger.warnCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'JOB_RUN_STATISTICS_REFRESH_FAILED',
          error: 'Failed to refresh job run statistics.',
        }),
      ]),
    );
  });

  it('uses maxMessagesPerRun as the actual POP3 scan limit on the first run', async () => {
    const jobRunRepository = new FakeJobRunRepository();
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const pop3MailService = new FakePop3MailService();

    const job = new EmailTransferJob(
      config,
      new FakeAnalyticsTracker(),
      new FakeGmailMailService(),
      jobRunRepository,
      jobRunStatisticsManager,
      new FakeJobRunStatisticsRepository(),
      new FakeLogger(),
      pop3MailService,
      new FakeProcessedEmailRepository(),
      buildClock(),
    );

    await job.run();

    expect(pop3MailService.listMessagesCalls).toEqual([
      {
        limit: config.job.maxMessagesPerRun,
      },
    ]);
  });

  it('stops the incremental scan after enough consecutively imported emails', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const jobRunRepository = new FakeJobRunRepository();
    jobRunRepository.listBySourceAccountResult = [
      JobRunEntity.createStarted({
        jobId: 'older-job',
        provider: sourceAccount.provider,
        sourceAccountId: sourceAccount.id,
        startedAt: new Date('2026-03-31T23:00:00.000Z'),
      }),
    ];
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const pop3MailService = new FakePop3MailService();
    const processedEmailRepository = new FakeProcessedEmailRepository();

    for (let messageNumber = 25; messageNumber >= 1; messageNumber -= 1) {
      const uidl = `uidl-${messageNumber}`;

      pop3MailService.listedMessages.push(buildMetadata(messageNumber, uidl));
      pop3MailService.listedMessageReferences.push(
        new Pop3MessageReference({
          messageNumber,
          uidl: Uidl.create(uidl),
        }),
      );
      processedEmailRepository.records.set(
        `${sourceAccount.id}:${Uidl.create(uidl).toString()}`,
        new ProcessedEmailEntityModel({
          createdAt: new Date('2026-03-31T23:55:00.000Z'),
          importedAt: new Date('2026-03-31T23:56:00.000Z'),
          metadata: new ProcessedEmailMetadata({
            claimJobId: 'older-job',
            messageNumber,
          }),
          sourceAccountId: sourceAccount.id,
          sourceProvider: sourceAccount.provider,
          status: EmailRecordStatus.Imported,
          uidl: Uidl.create(uidl),
          updatedAt: new Date('2026-03-31T23:56:00.000Z'),
        }),
      );
    }

    const job = new EmailTransferJob(
      config,
      analyticsTracker,
      new FakeGmailMailService(),
      jobRunRepository,
      jobRunStatisticsManager,
      new FakeJobRunStatisticsRepository(),
      new FakeLogger(),
      pop3MailService,
      processedEmailRepository,
      buildClock(),
    );

    const result = await job.run();

    expect(pop3MailService.listMessageReferencesCalls).toEqual([
      {
        limit: 25,
      },
    ]);
    expect(result.summary.detectedCount).toBe(0);
    expect(result.summary.skippedCount).toBe(0);
    expect(
      analyticsTracker.events.some(
        (event) =>
          event.eventName === TransferEventName.EmailSkippedAlreadyProcessed,
      ),
    ).toBe(false);
  });

  it('deletes stale running job runs before starting a new execution', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const jobRunRepository = new FakeJobRunRepository();
    jobRunRepository.listBySourceAccountResult = [
      JobRunEntity.createStarted({
        jobId: 'stale-job',
        provider: sourceAccount.provider,
        sourceAccountId: sourceAccount.id,
        startedAt: new Date('2026-03-31T23:30:00.000Z'),
      }),
    ];
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();
    const logger = new FakeLogger();
    const pop3MailService = new FakePop3MailService();

    const job = new EmailTransferJob(
      config,
      analyticsTracker,
      new FakeGmailMailService(),
      jobRunRepository,
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      logger,
      pop3MailService,
      new FakeProcessedEmailRepository(),
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary.status).toBe(JobRunStatus.Completed);
    expect(jobRunRepository.deletedJobIds).toEqual(['stale-job']);
    expect(jobRunRepository.finishedSummaries).toHaveLength(1);
    expect(jobRunStatisticsRepository.savedStatistics).toHaveLength(1);
    expect(logger.warnCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jobId: 'stale-job',
          status: JobRunStatus.Running,
        }),
      ]),
    );
  });

  it('does not refresh the statistics projection after a no-op run with no stale executions to reconcile', async () => {
    const analyticsTracker = new FakeAnalyticsTracker();
    const jobRunRepository = new FakeJobRunRepository();
    const jobRunStatisticsManager = new FakeJobRunStatisticsManager();
    jobRunStatisticsManager.statistics = buildStatisticsEntity();
    const jobRunStatisticsRepository = new FakeJobRunStatisticsRepository();

    const job = new EmailTransferJob(
      config,
      analyticsTracker,
      new FakeGmailMailService(),
      jobRunRepository,
      jobRunStatisticsManager,
      jobRunStatisticsRepository,
      new FakeLogger(),
      new FakePop3MailService(),
      new FakeProcessedEmailRepository(),
      buildClock(),
    );

    const result = await job.run();

    expect(result.summary.status).toBe(JobRunStatus.Completed);
    expect(jobRunStatisticsRepository.savedStatistics).toHaveLength(0);
  });
});
