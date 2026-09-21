import type { JobRunStatisticsEntity } from '../../../../core/job-run-statistics';

export class RunSummaryDto {
  public readonly detectedCount: number;
  public readonly failedCount: number;
  public readonly jobId: string;
  public readonly processedCount: number;
  public readonly provider: string;
  public readonly skippedCount: number;
  public readonly sourceAccountId: string;
  public readonly startedAt: Date;
  public readonly status: string;
  public readonly transferredCount: number;
  public readonly durationMs?: number;
  public readonly finishedAt?: Date;

  public constructor(
    detectedCount: number,
    failedCount: number,
    jobId: string,
    processedCount: number,
    provider: string,
    skippedCount: number,
    sourceAccountId: string,
    startedAt: Date,
    status: string,
    transferredCount: number,
    durationMs?: number,
    finishedAt?: Date,
  ) {
    this.detectedCount = detectedCount;
    this.failedCount = failedCount;
    this.jobId = jobId;
    this.processedCount = processedCount;
    this.provider = provider;
    this.skippedCount = skippedCount;
    this.sourceAccountId = sourceAccountId;
    this.startedAt = startedAt;
    this.status = status;
    this.transferredCount = transferredCount;

    if (durationMs !== undefined) {
      this.durationMs = durationMs;
    }

    if (finishedAt !== undefined) {
      this.finishedAt = finishedAt;
    }
  }

  public static fromDomain(
    summary: JobRunStatisticsEntity['recentRuns'][number],
  ): RunSummaryDto {
    return new RunSummaryDto(
      summary.detectedCount,
      summary.failedCount,
      summary.jobId,
      summary.processedCount,
      summary.provider,
      summary.skippedCount,
      summary.sourceAccountId,
      summary.startedAt,
      summary.status,
      summary.transferredCount,
      summary.durationMs,
      summary.finishedAt,
    );
  }
}
