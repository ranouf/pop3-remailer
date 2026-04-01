import type { SourceProvider } from './email';
import { TransferJobError } from './errors';

export const jobRunStatuses = [
  'running',
  'completed',
  'completed_with_failures',
  'failed',
] as const;

export type JobRunStatus = (typeof jobRunStatuses)[number];

export interface JobRunCounts {
  readonly detectedCount: number;
  readonly failedCount: number;
  readonly processedCount: number;
  readonly skippedCount: number;
  readonly transferredCount: number;
}

export interface JobRunSummary extends JobRunCounts {
  readonly durationMs?: number;
  readonly finishedAt?: Date;
  readonly jobId: string;
  readonly provider: SourceProvider;
  readonly sourceAccountId: string;
  readonly startedAt: Date;
  readonly status: JobRunStatus;
}

export interface CreateJobRunSummaryParams {
  readonly jobId: string;
  readonly provider: SourceProvider;
  readonly sourceAccountId: string;
  readonly startedAt: Date;
}

export type FinalizeJobRunCounts = JobRunCounts;

const assertNonNegativeInteger = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new TransferJobError(`Invalid ${name}.`, {
      category: 'functional',
      code: 'INVALID_JOB_COUNT',
      retriable: false,
      details: {
        name,
        value,
      },
    });
  }
};

const assertValidCounts = (counts: JobRunCounts): void => {
  assertNonNegativeInteger('detectedCount', counts.detectedCount);
  assertNonNegativeInteger('processedCount', counts.processedCount);
  assertNonNegativeInteger('transferredCount', counts.transferredCount);
  assertNonNegativeInteger('skippedCount', counts.skippedCount);
  assertNonNegativeInteger('failedCount', counts.failedCount);
};

export const determineJobRunStatus = (counts: JobRunCounts): JobRunStatus => {
  assertValidCounts(counts);

  if (counts.failedCount === 0) {
    return 'completed';
  }

  if (counts.transferredCount === 0 && counts.skippedCount === 0) {
    return 'failed';
  }

  return 'completed_with_failures';
};

export const createJobRunSummary = (
  params: CreateJobRunSummaryParams,
): JobRunSummary => ({
  detectedCount: 0,
  failedCount: 0,
  jobId: params.jobId,
  processedCount: 0,
  provider: params.provider,
  skippedCount: 0,
  sourceAccountId: params.sourceAccountId,
  startedAt: params.startedAt,
  status: 'running',
  transferredCount: 0,
});

export const finalizeJobRunSummary = (
  summary: JobRunSummary,
  counts: FinalizeJobRunCounts,
  finishedAt: Date,
): JobRunSummary => ({
  ...summary,
  ...counts,
  durationMs: Math.max(0, finishedAt.getTime() - summary.startedAt.getTime()),
  finishedAt,
  status: determineJobRunStatus(counts),
});
