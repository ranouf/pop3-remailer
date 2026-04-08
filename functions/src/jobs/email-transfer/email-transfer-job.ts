import type { ApplicationConfiguration } from '../../core/configuration/models/application-configuration';
import {
  AnalyticsTrackEvent,
  TransferEventName,
  type AnalyticsTrackerService,
  type TrackerEventProperties,
} from '../../core/analytics';
import type { GmailMailService } from '../../core/email/gmail';
import { EmailMessageHelper } from '../../core/email';
import {
  type Pop3MailServiceInterface,
  type Pop3MessageMetadata,
} from '../../core/email/pop3';
import { ProcessedEmailMetadata } from '../../core/email/processed-email';
import type { ProcessedEmailRepository } from '../../core/email/processed-email/processed-email-repository.interface';
import type { SourceAccount } from './models/source-account';
import { Job } from './job';
import { JobRunEntity, type JobRunRepository } from '../../core/job-run';
import type {
  JobRunStatisticsManagerInterface,
  JobRunStatisticsRepositoryInterface,
} from '../../core/job-run-statistics';
import type { StructuredLogger } from '../../core/logging/structured-logger.interface';
import {
  JobErrorCategory,
  OperationErrorHelper,
  TransferJobError,
} from '../../core/operation-error';
import type { Clock } from '../../core/time/clock.interface';
import type { EmailTransferJobResult } from './email-transfer-job-result';
import type { JobContext } from './models/job-context';

export class EmailTransferJob extends Job {
  private static readonly consecutiveKnownImportedMessagesBeforeStop = 10;
  private static readonly incrementalMessageScanLimit = 25;
  private readonly analyticsTracker: AnalyticsTrackerService;
  private readonly config: ApplicationConfiguration;
  private readonly gmailMailService: GmailMailService;
  private readonly jobRunRepository: JobRunRepository;
  private readonly jobRunStatisticsManager: JobRunStatisticsManagerInterface;
  private readonly jobRunStatisticsRepository: JobRunStatisticsRepositoryInterface;
  private readonly logger: StructuredLogger;
  private readonly pop3MailService: Pop3MailServiceInterface;
  private readonly processedEmailRepository: ProcessedEmailRepository;

  public constructor(
    config: ApplicationConfiguration,
    analyticsTracker: AnalyticsTrackerService,
    gmailMailService: GmailMailService,
    jobRunRepository: JobRunRepository,
    jobRunStatisticsManager: JobRunStatisticsManagerInterface,
    jobRunStatisticsRepository: JobRunStatisticsRepositoryInterface,
    logger: StructuredLogger,
    pop3MailService: Pop3MailServiceInterface,
    processedEmailRepository: ProcessedEmailRepository,
    clock?: Clock,
  ) {
    super(clock);
    this.config = config;
    this.analyticsTracker = analyticsTracker;
    this.gmailMailService = gmailMailService;
    this.jobRunRepository = jobRunRepository;
    this.jobRunStatisticsManager = jobRunStatisticsManager;
    this.jobRunStatisticsRepository = jobRunStatisticsRepository;
    this.logger = logger;
    this.pop3MailService = pop3MailService;
    this.processedEmailRepository = processedEmailRepository;
  }

  public async run(): Promise<EmailTransferJobResult> {
    const context = this.createJobContext();
    const sourceAccount = this.config.sourceAccount;
    let counts = this.createInitialCounts();
    let summary = JobRunEntity.createStarted({
      jobId: context.jobId,
      provider: sourceAccount.provider,
      sourceAccountId: sourceAccount.id,
      startedAt: context.startedAt,
    });

    await this.jobRunRepository.saveStarted(summary);
    await this.trackEvent(TransferEventName.JobStarted, context, {
      provider: sourceAccount.provider,
      sourceAccountId: sourceAccount.id,
    });

    try {
      const messages = await this.listMessages(sourceAccount, context);
      counts = this.withDetectedCount(counts, messages.length);

      for (const message of messages) {
        counts = await this.processMessage(message, context, counts);
      }

      await this.cleanupImportedRecords(context);

      summary = await this.completeJob(summary, context, counts);
      await this.refreshStatisticsProjection(context);

      return {
        summary,
      };
    } catch (error) {
      const transferError = this.toJobError(error, {
        code: 'EMAIL_TRANSFER_JOB_FAILED',
        details: {
          jobId: context.jobId,
          sourceAccountId: sourceAccount.id,
        },
        message: 'The email transfer job failed.',
      });
      summary = await this.completeJob(summary, context, counts);
      await this.refreshStatisticsProjection(context);

      throw new TransferJobError(transferError.message, {
        category:
          summary.failedCount > 0 ||
          summary.transferredCount > 0 ||
          summary.skippedCount > 0
            ? JobErrorCategory.Partial
            : transferError.category,
        code: transferError.code,
        details: {
          ...(transferError.details ?? {}),
          summary,
        },
        retriable: transferError.retriable,
        cause: transferError,
      });
    }
  }

  private async completeJob(
    summary: JobRunEntity,
    context: JobContext,
    counts: EmailTransferJobCounts,
  ): Promise<JobRunEntity> {
    const finishedAt = this.clock.now();
    const finalizedSummary = summary.finalize(counts, finishedAt);

    await this.jobRunRepository.saveFinished(finalizedSummary);
    this.logger.info('Email transfer job finished.', {
      ...this.buildSummaryLogContext(finalizedSummary, context),
    });
    await this.trackEvent(TransferEventName.JobFinished, context, {
      failedCount: finalizedSummary.failedCount,
      processedCount: finalizedSummary.processedCount,
      provider: finalizedSummary.provider,
      skippedCount: finalizedSummary.skippedCount,
      transferredCount: finalizedSummary.transferredCount,
    });
    await this.trackEvent(TransferEventName.JobDurationRecorded, context, {
      durationMs: this.calculateDurationMs(context.startedAt, finishedAt),
      provider: finalizedSummary.provider,
    });
    await this.analyticsTracker.flush();

    return finalizedSummary;
  }

  private async cleanupImportedRecords(context: JobContext): Promise<void> {
    try {
      const cleanupResult =
        await this.processedEmailRepository.cleanupImportedRecords({
          cleanupBatchSize: this.config.job.uidlCleanup.cleanupBatchSize,
          minimumRetainedCount:
            this.config.job.uidlCleanup.minimumRetainedCount,
          now: this.clock.now(),
          retentionDays: this.config.job.uidlCleanup.retentionDays,
          sourceAccountId: this.config.sourceAccount.id,
        });

      this.logger.info('Processed email cleanup completed.', {
        deletedCount: cleanupResult.deletedCount,
        executionTime: context.executionTime,
        jobId: context.jobId,
        retainedCount: cleanupResult.retainedCount,
        sourceAccountId: this.config.sourceAccount.id,
      });
    } catch (error) {
      const cleanupError = this.toJobError(error, {
        code: 'UIDL_CLEANUP_FAILED',
        details: {
          jobId: context.jobId,
          sourceAccountId: this.config.sourceAccount.id,
        },
        message: 'Failed to cleanup imported UIDL records.',
      });

      this.logger.warn('Processed email cleanup failed.', {
        code: cleanupError.code,
        error: cleanupError.message,
        executionTime: context.executionTime,
        jobId: context.jobId,
        sourceAccountId: this.config.sourceAccount.id,
      });
    }
  }

  private async refreshStatisticsProjection(
    context: JobContext,
  ): Promise<void> {
    try {
      const statistics = await this.jobRunStatisticsManager.getStatistics();

      await this.jobRunStatisticsRepository.save(statistics);
    } catch (error) {
      const projectionError = this.toJobError(error, {
        code: 'JOB_RUN_STATISTICS_REFRESH_FAILED',
        details: {
          jobId: context.jobId,
          sourceAccountId: this.config.sourceAccount.id,
        },
        message: 'Failed to refresh job run statistics.',
      });

      this.logger.warn('Job run statistics refresh failed.', {
        code: projectionError.code,
        error: projectionError.message,
        executionTime: context.executionTime,
        jobId: context.jobId,
        sourceAccountId: this.config.sourceAccount.id,
      });
    }
  }

  private buildEmailProperties(
    context: JobContext,
    message: Pop3MessageMetadata,
  ): TrackerEventProperties {
    return {
      executionTime: context.executionTime,
      jobId: context.jobId,
      messageNumber: message.messageNumber,
      messageSize: message.messageSize,
      provider: this.config.sourceAccount.provider,
      sourceAccountId: this.config.sourceAccount.id,
      uidl: message.uidl.toString(),
    };
  }

  private buildSummaryLogContext(
    summary: JobRunEntity,
    context: JobContext,
  ): Readonly<Record<string, unknown>> {
    return {
      durationMs: summary.durationMs,
      executionTime: context.executionTime,
      failedCount: summary.failedCount,
      jobId: summary.jobId,
      processedCount: summary.processedCount,
      skippedCount: summary.skippedCount,
      sourceAccountId: summary.sourceAccountId,
      status: summary.status,
      transferredCount: summary.transferredCount,
    };
  }

  private buildTransferErrorLogContext(
    transferError: TransferJobError,
  ): Readonly<Record<string, unknown>> {
    const context: Record<string, unknown> = {
      code: transferError.code,
      error: transferError.message,
      errorCategory: transferError.category,
      retriable: transferError.retriable,
    };

    if (transferError.details !== undefined) {
      context.errorDetails = transferError.details;
    }

    if (transferError.cause instanceof Error) {
      context.errorCauseMessage = transferError.cause.message;
      context.errorCauseName = transferError.cause.name;
    }

    return context;
  }

  private createInitialCounts(): EmailTransferJobCounts {
    return {
      detectedCount: 0,
      failedCount: 0,
      processedCount: 0,
      skippedCount: 0,
      transferredCount: 0,
    };
  }

  private async listMessages(
    sourceAccount: SourceAccount,
    context: JobContext,
  ): Promise<readonly Pop3MessageMetadata[]> {
    try {
      const hasPriorRuns =
        (await this.jobRunRepository.listBySourceAccount(sourceAccount.id))
          .length > 0;
      const scanLimit = hasPriorRuns
        ? Math.min(
            this.config.job.maxMessagesPerRun,
            EmailTransferJob.incrementalMessageScanLimit,
          )
        : this.config.job.maxMessagesPerRun;
      const messages = await this.pop3MailService.listMessages(sourceAccount, {
        limit: scanLimit,
      });

      if (!hasPriorRuns) {
        return messages;
      }

      return this.filterIncrementalMessages(messages, context);
    } catch (error) {
      const transferError = this.toJobError(error, {
        code: 'POP3_LIST_FAILED',
        details: {
          jobId: context.jobId,
          sourceAccountId: sourceAccount.id,
        },
        message: 'Failed to list POP3 messages.',
      });

      if (transferError.code === 'POP3_CONNECTION_FAILED') {
        await this.trackEvent(TransferEventName.Pop3ConnectionFailed, context, {
          provider: sourceAccount.provider,
          sourceAccountId: sourceAccount.id,
        });
      }

      throw transferError;
    }
  }

  private async filterIncrementalMessages(
    messages: readonly Pop3MessageMetadata[],
    context: JobContext,
  ): Promise<readonly Pop3MessageMetadata[]> {
    const filteredMessages: Pop3MessageMetadata[] = [];
    let consecutiveKnownImportedMessages = 0;

    for (const message of messages) {
      const processedEmail = await this.processedEmailRepository.findByUidl(
        this.config.sourceAccount.id,
        message.uidl,
      );

      if (processedEmail?.isImported() === true) {
        consecutiveKnownImportedMessages += 1;

        if (
          consecutiveKnownImportedMessages >=
          EmailTransferJob.consecutiveKnownImportedMessagesBeforeStop
        ) {
          this.logger.info(
            'Stopping POP3 incremental scan after known emails.',
            {
              consecutiveKnownImportedMessages,
              executionTime: context.executionTime,
              jobId: context.jobId,
              sourceAccountId: this.config.sourceAccount.id,
              stoppedAtMessageNumber: message.messageNumber,
            },
          );

          break;
        }

        continue;
      }

      consecutiveKnownImportedMessages = 0;
      filteredMessages.push(message);
    }

    return filteredMessages;
  }

  private async processMessage(
    message: Pop3MessageMetadata,
    context: JobContext,
    counts: EmailTransferJobCounts,
  ): Promise<EmailTransferJobCounts> {
    await this.trackEvent(
      TransferEventName.EmailDetected,
      context,
      this.buildEmailProperties(context, message),
    );

    const claimResult = await this.processedEmailRepository.claimForProcessing({
      jobId: context.jobId,
      metadata: new ProcessedEmailMetadata({
        ...(message.messageId === undefined
          ? {}
          : {
              messageId: message.messageId,
            }),
        messageNumber: message.messageNumber,
        messageSize: message.messageSize,
      }),
      sourceAccount: this.config.sourceAccount,
      uidl: message.uidl,
    });

    if (!claimResult.canTransfer()) {
      this.logger.info('Skipping already processed email.', {
        ...this.buildEmailProperties(context, message),
        claimStatus: claimResult.status,
      });
      await this.trackEvent(
        TransferEventName.EmailSkippedAlreadyProcessed,
        context,
        this.buildEmailProperties(context, message),
      );

      return this.markSkipped(counts);
    }

    await this.trackEvent(
      TransferEventName.EmailTransferStarted,
      context,
      this.buildEmailProperties(context, message),
    );

    try {
      const rawMessage = await this.pop3MailService.getMessage(
        this.config.sourceAccount,
        message.messageNumber,
      );
      const importResult = await this.gmailMailService.importMessage(
        this.config.gmail.userEmail,
        rawMessage,
      );

      try {
        await this.processedEmailRepository.markImported({
          ...(importResult.gmailMessageId === undefined
            ? {}
            : {
                gmailMessageId: importResult.gmailMessageId,
              }),
          sourceAccountId: this.config.sourceAccount.id,
          uidl: message.uidl,
        });
      } catch {
        await this.reconcileImportedMessage(
          rawMessage.rawMessage,
          message.uidl,
        );
      }

      this.logger.info('Email transferred to Gmail.', {
        ...this.buildEmailProperties(context, message),
        gmailMessageId: importResult.gmailMessageId,
      });
      await this.trackEvent(TransferEventName.EmailTransferred, context, {
        ...this.buildEmailProperties(context, message),
        gmailMessageId: importResult.gmailMessageId,
      });

      return this.markTransferred(counts);
    } catch (error) {
      const transferError = this.toJobError(error, {
        code: 'EMAIL_PROCESSING_FAILED',
        details: {
          jobId: context.jobId,
          messageNumber: message.messageNumber,
          sourceAccountId: this.config.sourceAccount.id,
          uidl: message.uidl.toString(),
        },
        message: 'Failed to process an email.',
      });

      await this.processedEmailRepository.markFailed({
        errorMessage: transferError.message,
        jobId: context.jobId,
        sourceAccountId: this.config.sourceAccount.id,
        uidl: message.uidl,
      });

      this.logger.warn('Email processing failed.', {
        ...this.buildEmailProperties(context, message),
        ...this.buildTransferErrorLogContext(transferError),
      });

      if (transferError.code === 'GMAIL_IMPORT_FAILED') {
        await this.trackEvent(TransferEventName.GmailImportFailed, context, {
          ...this.buildEmailProperties(context, message),
          errorCode: transferError.code,
        });
      }

      await this.trackEvent(TransferEventName.EmailTransferFailed, context, {
        ...this.buildEmailProperties(context, message),
        errorCode: transferError.code,
      });
      await this.trackEvent(TransferEventName.EmailProcessingFailed, context, {
        ...this.buildEmailProperties(context, message),
        errorCode: transferError.code,
      });

      return this.markFailed(counts);
    }
  }

  private markFailed(counts: EmailTransferJobCounts): EmailTransferJobCounts {
    return {
      detectedCount: counts.detectedCount,
      failedCount: counts.failedCount + 1,
      processedCount: counts.processedCount + 1,
      skippedCount: counts.skippedCount,
      transferredCount: counts.transferredCount,
    };
  }

  private markSkipped(counts: EmailTransferJobCounts): EmailTransferJobCounts {
    return {
      detectedCount: counts.detectedCount,
      failedCount: counts.failedCount,
      processedCount: counts.processedCount + 1,
      skippedCount: counts.skippedCount + 1,
      transferredCount: counts.transferredCount,
    };
  }

  private markTransferred(
    counts: EmailTransferJobCounts,
  ): EmailTransferJobCounts {
    return {
      detectedCount: counts.detectedCount,
      failedCount: counts.failedCount,
      processedCount: counts.processedCount + 1,
      skippedCount: counts.skippedCount,
      transferredCount: counts.transferredCount + 1,
    };
  }

  private withDetectedCount(
    counts: EmailTransferJobCounts,
    detectedCount: number,
  ): EmailTransferJobCounts {
    return {
      detectedCount,
      failedCount: counts.failedCount,
      processedCount: counts.processedCount,
      skippedCount: counts.skippedCount,
      transferredCount: counts.transferredCount,
    };
  }

  private async reconcileImportedMessage(
    rawMessage: string,
    uidl: Pop3MessageMetadata['uidl'],
  ): Promise<void> {
    const messageId = EmailMessageHelper.extractRfc822MessageId(rawMessage);

    if (messageId === null) {
      throw new TransferJobError(
        'Gmail import succeeded but Firestore update failed and no RFC822 message id was available for reconciliation.',
        {
          category: JobErrorCategory.Partial,
          code: 'POST_IMPORT_RECONCILIATION_FAILED',
          details: {
            sourceAccountId: this.config.sourceAccount.id,
            uidl: uidl.toString(),
          },
          retriable: true,
        },
      );
    }

    const importedMessage =
      await this.gmailMailService.findImportedMessageByRfc822MessageId(
        this.config.gmail.userEmail,
        messageId,
      );

    if (importedMessage === null) {
      throw new TransferJobError(
        'Gmail import succeeded but Firestore update failed and the imported Gmail message could not be reconciled.',
        {
          category: JobErrorCategory.Partial,
          code: 'POST_IMPORT_RECONCILIATION_FAILED',
          details: {
            messageId,
            sourceAccountId: this.config.sourceAccount.id,
            uidl: uidl.toString(),
          },
          retriable: true,
        },
      );
    }

    await this.processedEmailRepository.markImported({
      gmailMessageId: importedMessage.gmailMessageId,
      sourceAccountId: this.config.sourceAccount.id,
      uidl,
    });
  }

  private async trackEvent(
    eventName: TransferEventName,
    context: JobContext,
    properties: TrackerEventProperties,
  ): Promise<void> {
    await this.analyticsTracker.track(
      new AnalyticsTrackEvent(eventName, {
        executionTime: context.executionTime,
        jobId: context.jobId,
        ...properties,
      }),
    );
  }

  private toJobError(
    error: unknown,
    fallback: {
      readonly code: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly message: string;
    },
  ): TransferJobError {
    if (TransferJobError.isInstance(error)) {
      return error;
    }

    return OperationErrorHelper.create(error, {
      category: JobErrorCategory.Technical,
      code: fallback.code,
      details: fallback.details,
      message: fallback.message,
      retriable: true,
    });
  }
}

type EmailTransferJobCounts = Readonly<{
  detectedCount: number;
  failedCount: number;
  processedCount: number;
  skippedCount: number;
  transferredCount: number;
}>;
