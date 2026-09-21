import {
  ApiVersionMetadataResolver,
  type ApiVersionMetadata,
} from '../../../configuration/api-version-metadata';
import type { HealthCheckReport } from '../../../../core/health-check/models';
import { HealthCheckResultDto } from './health-check-result.dto';

export class HealthCheckReportDto {
  public readonly apiVersion: string;
  public readonly checkedAt: Date;
  public readonly checks: HealthCheckResultDto[];
  public readonly overallStatus: HealthCheckReport['overallStatus'];

  public constructor(
    apiVersion: string,
    checkedAt: Date,
    checks: HealthCheckResultDto[],
    overallStatus: HealthCheckReport['overallStatus'],
  ) {
    this.apiVersion = apiVersion;
    this.checkedAt = checkedAt;
    this.checks = checks;
    this.overallStatus = overallStatus;
  }

  public static fromDomain(
    report: HealthCheckReport,
    apiVersion: ApiVersionMetadata = ApiVersionMetadataResolver.resolve(),
  ): HealthCheckReportDto {
    return new HealthCheckReportDto(
      apiVersion.version,
      report.checkedAt,
      report.checks.map((check) => HealthCheckResultDto.fromDomain(check)),
      report.overallStatus,
    );
  }
}
