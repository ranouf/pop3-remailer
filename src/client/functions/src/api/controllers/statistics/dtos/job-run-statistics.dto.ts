import {
  ApiVersionMetadataResolver,
  type ApiVersionMetadata,
} from '../../../configuration/api-version-metadata';
import type { JobRunStatisticsEntity } from '../../../../core/job-run-statistics';
import { JobRunStatisticsDailyPointDto } from './job-run-statistics-daily-point.dto';
import { JobRunStatisticsKpisDto } from './job-run-statistics-kpis.dto';
import { RunSummaryDto } from './run-summary.dto';

export class JobRunStatisticsDto {
  public readonly apiVersion: string;
  public readonly dailyPoints: JobRunStatisticsDailyPointDto[];
  public readonly generatedAt: Date;
  public readonly kpis: JobRunStatisticsKpisDto;
  public readonly recentErrors: RunSummaryDto[];
  public readonly recentRuns: RunSummaryDto[];

  public constructor(
    apiVersion: string,
    dailyPoints: JobRunStatisticsDailyPointDto[],
    generatedAt: Date,
    kpis: JobRunStatisticsKpisDto,
    recentErrors: RunSummaryDto[],
    recentRuns: RunSummaryDto[],
  ) {
    this.apiVersion = apiVersion;
    this.dailyPoints = dailyPoints;
    this.generatedAt = generatedAt;
    this.kpis = kpis;
    this.recentErrors = recentErrors;
    this.recentRuns = recentRuns;
  }

  public static fromDomain(
    statistics: JobRunStatisticsEntity,
    apiVersion: ApiVersionMetadata = ApiVersionMetadataResolver.resolve(),
  ): JobRunStatisticsDto {
    return new JobRunStatisticsDto(
      apiVersion.version,
      statistics.dailyPoints.map((point) =>
        JobRunStatisticsDailyPointDto.fromDomain(point),
      ),
      statistics.generatedAt,
      JobRunStatisticsKpisDto.fromDomain(statistics.kpis),
      statistics.recentErrors.map((summary) =>
        RunSummaryDto.fromDomain(summary),
      ),
      statistics.recentRuns.map((summary) => RunSummaryDto.fromDomain(summary)),
    );
  }
}
