/* eslint-disable sort-imports */
import type { JobRunStatus, JobRunSummary } from '../../domain/job-run';
import type { ProcessedEmailRecord } from '../../domain/processed-email';
import type { SourceProvider } from '../../domain/email';
import { createUidl } from '../../domain/uidl';
import type { FirestoreTimestamp } from './firestore-types';

export interface StoredProcessedEmailRecord {
  readonly createdAt: Date | FirestoreTimestamp;
  readonly gmailMessageId?: string;
  readonly importedAt?: Date | FirestoreTimestamp;
  readonly lastError?: string | null;
  readonly metadata?: {
    readonly claimJobId?: string;
    readonly messageId?: string;
    readonly messageNumber?: number;
    readonly messageSize?: number;
  };
  readonly sourceAccountId: string;
  readonly sourceProvider: SourceProvider;
  readonly status: ProcessedEmailRecord['status'];
  readonly uidl: string;
  readonly updatedAt: Date | FirestoreTimestamp;
}

export interface StoredJobRunRecord {
  readonly detectedCount: number;
  readonly durationMs?: number;
  readonly failedCount: number;
  readonly finishedAt?: Date | FirestoreTimestamp;
  readonly jobId: string;
  readonly processedCount: number;
  readonly provider: SourceProvider;
  readonly skippedCount: number;
  readonly sourceAccountId: string;
  readonly startedAt: Date | FirestoreTimestamp;
  readonly status: JobRunStatus;
  readonly transferredCount: number;
}

const toDate = (value: Date | FirestoreTimestamp): Date =>
  value instanceof Date ? value : value.toDate();

export const toProcessedEmailRecord = (
  storedRecord: StoredProcessedEmailRecord,
): ProcessedEmailRecord => ({
  createdAt: toDate(storedRecord.createdAt),
  ...(storedRecord.gmailMessageId === undefined
    ? {}
    : {
        gmailMessageId: storedRecord.gmailMessageId,
      }),
  ...(storedRecord.importedAt === undefined
    ? {}
    : {
        importedAt: toDate(storedRecord.importedAt),
      }),
  ...(storedRecord.lastError === undefined || storedRecord.lastError === null
    ? {}
    : {
        lastError: storedRecord.lastError,
      }),
  metadata: {
    ...(storedRecord.metadata?.claimJobId === undefined
      ? {}
      : {
          claimJobId: storedRecord.metadata.claimJobId,
        }),
    ...(storedRecord.metadata?.messageId === undefined
      ? {}
      : {
          messageId: storedRecord.metadata.messageId,
        }),
    ...(storedRecord.metadata?.messageNumber === undefined
      ? {}
      : {
          messageNumber: storedRecord.metadata.messageNumber,
        }),
    ...(storedRecord.metadata?.messageSize === undefined
      ? {}
      : {
          messageSize: storedRecord.metadata.messageSize,
        }),
  },
  sourceAccountId: storedRecord.sourceAccountId,
  sourceProvider: storedRecord.sourceProvider,
  status: storedRecord.status,
  uidl: createUidl(storedRecord.uidl),
  updatedAt: toDate(storedRecord.updatedAt),
});

export const toStoredProcessedEmailRecord = (
  record: ProcessedEmailRecord,
): StoredProcessedEmailRecord => ({
  createdAt: record.createdAt,
  ...(record.gmailMessageId === undefined
    ? {}
    : {
        gmailMessageId: record.gmailMessageId,
      }),
  ...(record.importedAt === undefined
    ? {}
    : {
        importedAt: record.importedAt,
      }),
  ...(record.lastError === undefined
    ? {}
    : {
        lastError: record.lastError,
      }),
  metadata: {
    ...(record.metadata.claimJobId === undefined
      ? {}
      : {
          claimJobId: record.metadata.claimJobId,
        }),
    ...(record.metadata.messageId === undefined
      ? {}
      : {
          messageId: record.metadata.messageId,
        }),
    ...(record.metadata.messageNumber === undefined
      ? {}
      : {
          messageNumber: record.metadata.messageNumber,
        }),
    ...(record.metadata.messageSize === undefined
      ? {}
      : {
          messageSize: record.metadata.messageSize,
        }),
  },
  sourceAccountId: record.sourceAccountId,
  sourceProvider: record.sourceProvider,
  status: record.status,
  uidl: record.uidl,
  updatedAt: record.updatedAt,
});

export const toStoredJobRunRecord = (
  summary: JobRunSummary,
): StoredJobRunRecord => ({
  detectedCount: summary.detectedCount,
  ...(summary.durationMs === undefined
    ? {}
    : {
        durationMs: summary.durationMs,
      }),
  failedCount: summary.failedCount,
  ...(summary.finishedAt === undefined
    ? {}
    : {
        finishedAt: summary.finishedAt,
      }),
  jobId: summary.jobId,
  processedCount: summary.processedCount,
  provider: summary.provider,
  skippedCount: summary.skippedCount,
  sourceAccountId: summary.sourceAccountId,
  startedAt: summary.startedAt,
  status: summary.status,
  transferredCount: summary.transferredCount,
});
