import type { SourceProvider } from '../../../jobs/email-transfer/models/source-account';
import { JobErrorCategory, TransferJobError } from '../../operation-error';

export enum JobRunStatus {
  Running = 'running',
  Completed = 'completed',
  CompletedWithFailures = 'completed_with_failures',
  Failed = 'failed',
}

type JobRunCountsLike = Readonly<{
  detectedCount: number;
  failedCount: number;
  processedCount: number;
  skippedCount: number;
  transferredCount: number;
}>;

export class JobRunEntity {
  public readonly detectedCount: number;
  public readonly durationMs?: number;
  public readonly failedCount: number;
  public readonly finishedAt?: Date;
  public readonly jobId: string;
  public readonly processedCount: number;
  public readonly provider: SourceProvider;
  public readonly skippedCount: number;
  public readonly sourceAccountId: string;
  public readonly startedAt: Date;
  public readonly status: JobRunStatus;
  public readonly transferredCount: number;

  public constructor(params: {
    readonly detectedCount: number;
    readonly durationMs?: number;
    readonly failedCount: number;
    readonly finishedAt?: Date;
    readonly jobId: string;
    readonly processedCount: number;
    readonly provider: SourceProvider;
    readonly skippedCount: number;
    readonly sourceAccountId: string;
    readonly startedAt: Date;
    readonly status: JobRunStatus;
    readonly transferredCount: number;
  }) {
    this.detectedCount = params.detectedCount;
    if (params.durationMs !== undefined) {
      this.durationMs = params.durationMs;
    }
    this.failedCount = params.failedCount;
    if (params.finishedAt !== undefined) {
      this.finishedAt = params.finishedAt;
    }
    this.jobId = params.jobId;
    this.processedCount = params.processedCount;
    this.provider = params.provider;
    this.skippedCount = params.skippedCount;
    this.sourceAccountId = params.sourceAccountId;
    this.startedAt = params.startedAt;
    this.status = params.status;
    this.transferredCount = params.transferredCount;
  }

  public static createStarted(params: {
    readonly jobId: string;
    readonly provider: SourceProvider;
    readonly sourceAccountId: string;
    readonly startedAt: Date;
  }): JobRunEntity {
    return new JobRunEntity({
      detectedCount: 0,
      failedCount: 0,
      jobId: params.jobId,
      processedCount: 0,
      provider: params.provider,
      skippedCount: 0,
      sourceAccountId: params.sourceAccountId,
      startedAt: params.startedAt,
      status: JobRunStatus.Running,
      transferredCount: 0,
    });
  }

  public finalize(counts: JobRunCountsLike, finishedAt: Date): JobRunEntity {
    JobRunEntity.assertValidCounts(counts);

    return new JobRunEntity({
      detectedCount: counts.detectedCount,
      durationMs: Math.max(0, finishedAt.getTime() - this.startedAt.getTime()),
      failedCount: counts.failedCount,
      finishedAt,
      jobId: this.jobId,
      processedCount: counts.processedCount,
      provider: this.provider,
      skippedCount: counts.skippedCount,
      sourceAccountId: this.sourceAccountId,
      startedAt: this.startedAt,
      status: JobRunEntity.determineStatus(counts),
      transferredCount: counts.transferredCount,
    });
  }

  public static determineStatus(counts: JobRunCountsLike): JobRunStatus {
    JobRunEntity.assertValidCounts(counts);

    if (counts.failedCount === 0) {
      return JobRunStatus.Completed;
    }

    if (counts.transferredCount === 0 && counts.skippedCount === 0) {
      return JobRunStatus.Failed;
    }

    return JobRunStatus.CompletedWithFailures;
  }

  private static assertValidCounts(counts: JobRunCountsLike): void {
    JobRunEntity.assertNonNegativeInteger(
      'detectedCount',
      counts.detectedCount,
    );
    JobRunEntity.assertNonNegativeInteger(
      'processedCount',
      counts.processedCount,
    );
    JobRunEntity.assertNonNegativeInteger(
      'transferredCount',
      counts.transferredCount,
    );
    JobRunEntity.assertNonNegativeInteger('skippedCount', counts.skippedCount);
    JobRunEntity.assertNonNegativeInteger('failedCount', counts.failedCount);
  }

  private static assertNonNegativeInteger(name: string, value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new TransferJobError(`Invalid ${name}.`, {
        category: JobErrorCategory.Functional,
        code: 'INVALID_JOB_COUNT',
        retriable: false,
        details: {
          name,
          value,
        },
      });
    }
  }
}
