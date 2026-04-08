import type { JobRunStatisticsEntity } from '../../../../core/job-run-statistics';

export class JobRunStatisticsDailyPointDto {
  public readonly averageDurationMs: number | null;
  public readonly date: Date;
  public readonly detectedCount: number;
  public readonly failedCount: number;
  public readonly runCount: number;
  public readonly transferredCount: number;

  public constructor(
    averageDurationMs: number | null,
    date: Date,
    detectedCount: number,
    failedCount: number,
    runCount: number,
    transferredCount: number,
  ) {
    this.averageDurationMs = averageDurationMs;
    this.date = date;
    this.detectedCount = detectedCount;
    this.failedCount = failedCount;
    this.runCount = runCount;
    this.transferredCount = transferredCount;
  }

  public static fromDomain(
    point: JobRunStatisticsEntity['dailyPoints'][number],
  ): JobRunStatisticsDailyPointDto {
    return new JobRunStatisticsDailyPointDto(
      point.averageDurationMs,
      point.date,
      point.detectedCount,
      point.failedCount,
      point.runCount,
      point.transferredCount,
    );
  }
}
