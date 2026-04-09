import type { HealthCheckReport } from '../../../../core/health-check/models';
import { HealthCheckResultDto } from './health-check-result.dto';

export class HealthCheckReportDto {
  public readonly checkedAt: Date;
  public readonly checks: HealthCheckResultDto[];
  public readonly overallStatus: HealthCheckReport['overallStatus'];

  public constructor(
    checkedAt: Date,
    checks: HealthCheckResultDto[],
    overallStatus: HealthCheckReport['overallStatus'],
  ) {
    this.checkedAt = checkedAt;
    this.checks = checks;
    this.overallStatus = overallStatus;
  }

  public static fromDomain(report: HealthCheckReport): HealthCheckReportDto {
    return new HealthCheckReportDto(
      report.checkedAt,
      report.checks.map((check) => HealthCheckResultDto.fromDomain(check)),
      report.overallStatus,
    );
  }
}
