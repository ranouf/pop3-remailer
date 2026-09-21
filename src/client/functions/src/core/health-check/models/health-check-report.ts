import {
  type HealthCheckResult,
  HealthCheckStatus,
} from './health-check-result';

enum HealthCheckStatusPriority {
  Healthy = 0,
  Warning = 1,
  Error = 2,
}

export class HealthCheckReport {
  public readonly checkedAt: Date;
  public readonly checks: readonly HealthCheckResult[];
  public readonly overallStatus: HealthCheckStatus;

  public constructor(checkedAt: Date, checks: readonly HealthCheckResult[]) {
    this.checkedAt = checkedAt;
    this.checks = checks;
    this.overallStatus = HealthCheckReport.determineOverallStatus(checks);
  }

  private static determineOverallStatus(
    checks: readonly HealthCheckResult[],
  ): HealthCheckStatus {
    return checks.reduce<HealthCheckStatus>(
      (currentStatus, check) =>
        HealthCheckReport.toPriority(check.status) >
        HealthCheckReport.toPriority(currentStatus)
          ? check.status
          : currentStatus,
      HealthCheckStatus.Healthy,
    );
  }

  private static toPriority(status: HealthCheckStatus): number {
    switch (status) {
      case HealthCheckStatus.Error:
        return HealthCheckStatusPriority.Error;
      case HealthCheckStatus.Warning:
        return HealthCheckStatusPriority.Warning;
      case HealthCheckStatus.Healthy:
        return HealthCheckStatusPriority.Healthy;
    }
  }
}
