import {
  JobRunEntity as JobRunEntityModel,
  type JobRunStatus,
  type JobRunEntity,
} from '../../core/job-run';
import {
  JobRunStatisticsEntity as JobRunStatisticsEntityModel,
  type JobRunStatisticsEntity,
} from '../../core/job-run-statistics';
import {
  ProcessedEmailMetadata as ProcessedEmailMetadataModel,
  type ProcessedEmailEntity,
  ProcessedEmailEntity as ProcessedEmailEntityModel,
} from '../../core/email/processed-email';
import type { SourceProvider } from '../../jobs/email-transfer/models/source-account';
import { Uidl } from '../../core/email/uidl';
import type { FirestoreTimestamp } from './models';

export interface StoredProcessedEmailEntity {
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
  readonly status: ProcessedEmailEntity['status'];
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

export interface StoredJobRunStatisticsRecord {
  readonly dailyPoints: readonly {
    readonly averageDurationMs: number | null;
    readonly date: Date | FirestoreTimestamp;
    readonly detectedCount: number;
    readonly failedCount: number;
    readonly runCount: number;
    readonly transferredCount: number;
  }[];
  readonly generatedAt: Date | FirestoreTimestamp;
  readonly kpis: {
    readonly detectedLast24h: number;
    readonly failedLast24h: number;
    readonly lastError: StoredJobRunRecord | null;
    readonly lastRun: StoredJobRunRecord | null;
    readonly lastSuccess: StoredJobRunRecord | null;
    readonly transferredLast24h: number;
  };
  readonly recentErrors: readonly StoredJobRunRecord[];
  readonly recentRuns: readonly StoredJobRunRecord[];
  readonly sourceAccountId: string;
}

const toDate = (value: Date | FirestoreTimestamp): Date =>
  value instanceof Date ? value : value.toDate();

export const toProcessedEmailEntity = (
  storedRecord: StoredProcessedEmailEntity,
): ProcessedEmailEntity =>
  new ProcessedEmailEntityModel({
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
    metadata: new ProcessedEmailMetadataModel({
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
    }),
    sourceAccountId: storedRecord.sourceAccountId,
    sourceProvider: storedRecord.sourceProvider,
    status: storedRecord.status,
    uidl: Uidl.create(storedRecord.uidl),
    updatedAt: toDate(storedRecord.updatedAt),
  });

export const toStoredProcessedEmailEntity = (
  entity: ProcessedEmailEntity,
): StoredProcessedEmailEntity => ({
  createdAt: entity.createdAt,
  ...(entity.gmailMessageId === undefined
    ? {}
    : {
        gmailMessageId: entity.gmailMessageId,
      }),
  ...(entity.importedAt === undefined
    ? {}
    : {
        importedAt: entity.importedAt,
      }),
  ...(entity.lastError === undefined
    ? {}
    : {
        lastError: entity.lastError,
      }),
  metadata: {
    ...(entity.metadata.claimJobId === undefined
      ? {}
      : {
          claimJobId: entity.metadata.claimJobId,
        }),
    ...(entity.metadata.messageId === undefined
      ? {}
      : {
          messageId: entity.metadata.messageId,
        }),
    ...(entity.metadata.messageNumber === undefined
      ? {}
      : {
          messageNumber: entity.metadata.messageNumber,
        }),
    ...(entity.metadata.messageSize === undefined
      ? {}
      : {
          messageSize: entity.metadata.messageSize,
        }),
  },
  sourceAccountId: entity.sourceAccountId,
  sourceProvider: entity.sourceProvider,
  status: entity.status,
  uidl: entity.uidl.toString(),
  updatedAt: entity.updatedAt,
});

export const toStoredJobRunRecord = (
  summary: JobRunEntity,
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

export const toJobRunEntity = (
  storedRecord: StoredJobRunRecord,
): JobRunEntity =>
  new JobRunEntityModel({
    detectedCount: storedRecord.detectedCount,
    ...(storedRecord.durationMs === undefined
      ? {}
      : {
          durationMs: storedRecord.durationMs,
        }),
    failedCount: storedRecord.failedCount,
    ...(storedRecord.finishedAt === undefined
      ? {}
      : {
          finishedAt: toDate(storedRecord.finishedAt),
        }),
    jobId: storedRecord.jobId,
    processedCount: storedRecord.processedCount,
    provider: storedRecord.provider,
    skippedCount: storedRecord.skippedCount,
    sourceAccountId: storedRecord.sourceAccountId,
    startedAt: toDate(storedRecord.startedAt),
    status: storedRecord.status,
    transferredCount: storedRecord.transferredCount,
  });

export const toStoredJobRunStatisticsRecord = (
  statistics: JobRunStatisticsEntity,
): StoredJobRunStatisticsRecord => ({
  dailyPoints: statistics.dailyPoints.map((point) => ({
    averageDurationMs: point.averageDurationMs,
    date: point.date,
    detectedCount: point.detectedCount,
    failedCount: point.failedCount,
    runCount: point.runCount,
    transferredCount: point.transferredCount,
  })),
  generatedAt: statistics.generatedAt,
  kpis: {
    detectedLast24h: statistics.kpis.detectedLast24h,
    failedLast24h: statistics.kpis.failedLast24h,
    lastError:
      statistics.kpis.lastError === null
        ? null
        : toStoredJobRunRecord(
            new JobRunEntityModel({
              ...statistics.kpis.lastError,
            }),
          ),
    lastRun:
      statistics.kpis.lastRun === null
        ? null
        : toStoredJobRunRecord(
            new JobRunEntityModel({
              ...statistics.kpis.lastRun,
            }),
          ),
    lastSuccess:
      statistics.kpis.lastSuccess === null
        ? null
        : toStoredJobRunRecord(
            new JobRunEntityModel({
              ...statistics.kpis.lastSuccess,
            }),
          ),
    transferredLast24h: statistics.kpis.transferredLast24h,
  },
  recentErrors: statistics.recentErrors.map((summary) =>
    toStoredJobRunRecord(
      new JobRunEntityModel({
        ...summary,
      }),
    ),
  ),
  recentRuns: statistics.recentRuns.map((summary) =>
    toStoredJobRunRecord(
      new JobRunEntityModel({
        ...summary,
      }),
    ),
  ),
  sourceAccountId: statistics.sourceAccountId,
});

export const toJobRunStatisticsEntity = (
  storedRecord: StoredJobRunStatisticsRecord,
): JobRunStatisticsEntity =>
  new JobRunStatisticsEntityModel(
    storedRecord.sourceAccountId,
    storedRecord.dailyPoints.map((point) => ({
      averageDurationMs: point.averageDurationMs,
      date: toDate(point.date),
      detectedCount: point.detectedCount,
      failedCount: point.failedCount,
      runCount: point.runCount,
      transferredCount: point.transferredCount,
    })),
    toDate(storedRecord.generatedAt),
    {
      detectedLast24h: storedRecord.kpis.detectedLast24h,
      failedLast24h: storedRecord.kpis.failedLast24h,
      lastError:
        storedRecord.kpis.lastError === null
          ? null
          : JobRunStatisticsEntityModel.createRunSummary(
              toJobRunEntity(storedRecord.kpis.lastError),
            ),
      lastRun:
        storedRecord.kpis.lastRun === null
          ? null
          : JobRunStatisticsEntityModel.createRunSummary(
              toJobRunEntity(storedRecord.kpis.lastRun),
            ),
      lastSuccess:
        storedRecord.kpis.lastSuccess === null
          ? null
          : JobRunStatisticsEntityModel.createRunSummary(
              toJobRunEntity(storedRecord.kpis.lastSuccess),
            ),
      transferredLast24h: storedRecord.kpis.transferredLast24h,
    },
    storedRecord.recentErrors.map((summary) =>
      JobRunStatisticsEntityModel.createRunSummary(toJobRunEntity(summary)),
    ),
    storedRecord.recentRuns.map((summary) =>
      JobRunStatisticsEntityModel.createRunSummary(toJobRunEntity(summary)),
    ),
  );
