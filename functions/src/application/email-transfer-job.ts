import type { EmailTransferJobDependencies } from './email-transfer-job-dependencies.interface';
import type { EmailTransferJobResult } from './models/email-transfer-job-result';
import type { AppConfig } from '../config/environment';
import type { Pop3MessageMetadata, SourceAccount } from '../domain/email';
import {
  isTransferJobError,
  toTransferJobError,
  TransferJobError,
} from '../domain/errors';
import {
  createJobRunSummary,
  finalizeJobRunSummary,
  type JobRunCounts,
  type JobRunSummary,
} from '../domain/job-run';
import type {
  AnalyticsTracker,
  GmailMailService,
  JobRunRepository,
  Pop3MailService,
  ProcessedEmailRepository,
  StructuredLogger,
  TrackerEventProperties,
} from '../domain/ports';
import { canTransferClaimedEmail } from '../domain/processed-email';
import { extractRfc822MessageId } from '../shared/email-message';
import {
  type Clock,
  type OperationContext,
  calculateDurationMs,
  createOperationContext,
  systemClock,
} from '../shared/operation-context';

export class EmailTransferJob {
  private readonly analyticsTracker: AnalyticsTracker;
  private readonly clock: Clock;
  private readonly config: AppConfig;
  private readonly gmailMailService: GmailMailService;
  private readonly jobRunRepository: JobRunRepository;
  private readonly logger: StructuredLogger;
  private readonly pop3MailService: Pop3MailService;
  private readonly processedEmailRepository: ProcessedEmailRepository;

  public constructor(
    config: AppConfig,
    dependencies: EmailTransferJobDependencies,
  ) {
    this.config = config;
    this.analyticsTracker = dependencies.analyticsTracker;
    this.clock = dependencies.clock ?? systemClock;
    this.gmailMailService = dependencies.gmailMailService;
    this.jobRunRepository = dependencies.jobRunRepository;
    this.logger = dependencies.logger;
    this.pop3MailService = dependencies.pop3MailService;
    this.processedEmailRepository = dependencies.processedEmailRepository;
  }

  public async run(): Promise<EmailTransferJobResult> {
    const context = createOperationContext(this.clock);
    const sourceAccount = this.config.sourceAccount;
    let counts = this.createInitialCounts();
    let summary = createJobRunSummary({
      jobId: context.jobId,
      provider: sourceAccount.provider,
      sourceAccountId: sourceAccount.id,
      startedAt: context.startedAt,
    });

    await this.jobRunRepository.saveStarted(summary);
    await this.trackEvent('job_started', context, {
      provider: sourceAccount.provider,
      sourceAccountId: sourceAccount.id,
    });

    try {
      const messages = await this.listMessages(sourceAccount, context);
      counts = {
        ...counts,
        detectedCount: messages.length,
      };

      for (const message of messages) {
        counts = await this.processMessage(message, context, counts);
      }

      summary = await this.completeJob(summary, context, counts);

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

      throw new TransferJobError(transferError.message, {
        category:
          summary.failedCount > 0 ||
          summary.transferredCount > 0 ||
          summary.skippedCount > 0
            ? 'partial'
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
    summary: JobRunSummary,
    context: OperationContext,
    counts: JobRunCounts,
  ): Promise<JobRunSummary> {
    const finishedAt = this.clock.now();
    const finalizedSummary = finalizeJobRunSummary(summary, counts, finishedAt);

    await this.jobRunRepository.saveFinished(finalizedSummary);
    this.logger.info('Email transfer job finished.', {
      ...this.buildSummaryLogContext(finalizedSummary, context),
    });
    await this.trackEvent('job_finished', context, {
      failedCount: finalizedSummary.failedCount,
      processedCount: finalizedSummary.processedCount,
      provider: finalizedSummary.provider,
      skippedCount: finalizedSummary.skippedCount,
      transferredCount: finalizedSummary.transferredCount,
    });
    await this.trackEvent('job_duration_recorded', context, {
      durationMs: calculateDurationMs(context.startedAt, finishedAt),
      provider: finalizedSummary.provider,
    });
    await this.analyticsTracker.flush();

    return finalizedSummary;
  }

  private buildEmailProperties(
    context: OperationContext,
    message: Pop3MessageMetadata,
  ): TrackerEventProperties {
    return {
      executionTime: context.executionTime,
      jobId: context.jobId,
      messageNumber: message.messageNumber,
      messageSize: message.messageSize,
      provider: this.config.sourceAccount.provider,
      sourceAccountId: this.config.sourceAccount.id,
      uidl: message.uidl,
    };
  }

  private buildSummaryLogContext(
    summary: JobRunSummary,
    context: OperationContext,
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

  private createInitialCounts(): JobRunCounts {
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
    context: OperationContext,
  ): Promise<readonly Pop3MessageMetadata[]> {
    try {
      return await this.pop3MailService.listMessages(sourceAccount);
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
        await this.trackEvent('pop3_connection_failed', context, {
          provider: sourceAccount.provider,
          sourceAccountId: sourceAccount.id,
        });
      }

      throw transferError;
    }
  }

  private async processMessage(
    message: Pop3MessageMetadata,
    context: OperationContext,
    counts: JobRunCounts,
  ): Promise<JobRunCounts> {
    await this.trackEvent(
      'email_detected',
      context,
      this.buildEmailProperties(context, message),
    );

    const claimResult = await this.processedEmailRepository.claimForProcessing({
      jobId: context.jobId,
      metadata: {
        ...(message.messageId === undefined
          ? {}
          : {
              messageId: message.messageId,
            }),
        messageNumber: message.messageNumber,
        messageSize: message.messageSize,
      },
      sourceAccount: this.config.sourceAccount,
      uidl: message.uidl,
    });

    if (!canTransferClaimedEmail(claimResult)) {
      this.logger.info('Skipping already processed email.', {
        ...this.buildEmailProperties(context, message),
        claimStatus: claimResult.status,
      });
      await this.trackEvent(
        'email_skipped_already_processed',
        context,
        this.buildEmailProperties(context, message),
      );

      return {
        ...counts,
        processedCount: counts.processedCount + 1,
        skippedCount: counts.skippedCount + 1,
      };
    }

    await this.trackEvent(
      'email_transfer_started',
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
      await this.trackEvent('email_transferred', context, {
        ...this.buildEmailProperties(context, message),
        gmailMessageId: importResult.gmailMessageId,
      });

      return {
        ...counts,
        processedCount: counts.processedCount + 1,
        transferredCount: counts.transferredCount + 1,
      };
    } catch (error) {
      const transferError = this.toJobError(error, {
        code: 'EMAIL_PROCESSING_FAILED',
        details: {
          jobId: context.jobId,
          messageNumber: message.messageNumber,
          sourceAccountId: this.config.sourceAccount.id,
          uidl: message.uidl,
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
        code: transferError.code,
        error: transferError.message,
      });

      if (transferError.code === 'GMAIL_IMPORT_FAILED') {
        await this.trackEvent('gmail_import_failed', context, {
          ...this.buildEmailProperties(context, message),
          errorCode: transferError.code,
        });
      }

      await this.trackEvent('email_transfer_failed', context, {
        ...this.buildEmailProperties(context, message),
        errorCode: transferError.code,
      });
      await this.trackEvent('email_processing_failed', context, {
        ...this.buildEmailProperties(context, message),
        errorCode: transferError.code,
      });

      return {
        ...counts,
        failedCount: counts.failedCount + 1,
        processedCount: counts.processedCount + 1,
      };
    }
  }

  private async reconcileImportedMessage(
    rawMessage: string,
    uidl: Pop3MessageMetadata['uidl'],
  ): Promise<void> {
    const messageId = extractRfc822MessageId(rawMessage);

    if (messageId === null) {
      throw new TransferJobError(
        'Gmail import succeeded but Firestore update failed and no RFC822 message id was available for reconciliation.',
        {
          category: 'partial',
          code: 'POST_IMPORT_RECONCILIATION_FAILED',
          details: {
            sourceAccountId: this.config.sourceAccount.id,
            uidl,
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
          category: 'partial',
          code: 'POST_IMPORT_RECONCILIATION_FAILED',
          details: {
            messageId,
            sourceAccountId: this.config.sourceAccount.id,
            uidl,
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
    eventName: Parameters<AnalyticsTracker['track']>[0],
    context: OperationContext,
    properties: TrackerEventProperties,
  ): Promise<void> {
    await this.analyticsTracker.track(eventName, {
      executionTime: context.executionTime,
      jobId: context.jobId,
      ...properties,
    });
  }

  private toJobError(
    error: unknown,
    fallback: {
      readonly code: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly message: string;
    },
  ): TransferJobError {
    if (isTransferJobError(error)) {
      return error;
    }

    return toTransferJobError(error, {
      category: 'technical',
      code: fallback.code,
      details: fallback.details,
      message: fallback.message,
      retriable: true,
    });
  }
}
