import type { JobRunStatisticsEntity } from '../../../../core/job-run-statistics';
import { RunSummaryDto } from './run-summary.dto';

export class JobRunStatisticsKpisDto {
  public readonly detectedLast24h: number;
  public readonly failedLast24h: number;
  public readonly lastError: RunSummaryDto | null;
  public readonly lastRun: RunSummaryDto | null;
  public readonly lastSuccess: RunSummaryDto | null;
  public readonly transferredLast24h: number;

  public constructor(
    detectedLast24h: number,
    failedLast24h: number,
    lastError: RunSummaryDto | null,
    lastRun: RunSummaryDto | null,
    lastSuccess: RunSummaryDto | null,
    transferredLast24h: number,
  ) {
    this.detectedLast24h = detectedLast24h;
    this.failedLast24h = failedLast24h;
    this.lastError = lastError;
    this.lastRun = lastRun;
    this.lastSuccess = lastSuccess;
    this.transferredLast24h = transferredLast24h;
  }

  public static fromDomain(
    kpis: JobRunStatisticsEntity['kpis'],
  ): JobRunStatisticsKpisDto {
    return new JobRunStatisticsKpisDto(
      kpis.detectedLast24h,
      kpis.failedLast24h,
      kpis.lastError === null ? null : RunSummaryDto.fromDomain(kpis.lastError),
      kpis.lastRun === null ? null : RunSummaryDto.fromDomain(kpis.lastRun),
      kpis.lastSuccess === null
        ? null
        : RunSummaryDto.fromDomain(kpis.lastSuccess),
      kpis.transferredLast24h,
    );
  }
}
