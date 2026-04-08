import {
  type HealthCheckResult,
  type HealthCheckName,
  type HealthCheckStatus,
} from '../../../../core/health-check/models';

export class HealthCheckResultDto {
  public readonly checkedAt: Date;
  public readonly message: string;
  public readonly name: HealthCheckName;
  public readonly status: HealthCheckStatus;

  public constructor(
    checkedAt: Date,
    message: string,
    name: HealthCheckName,
    status: HealthCheckStatus,
  ) {
    this.checkedAt = checkedAt;
    this.message = message;
    this.name = name;
    this.status = status;
  }

  public static fromDomain(result: HealthCheckResult): HealthCheckResultDto {
    return new HealthCheckResultDto(
      result.checkedAt,
      result.message,
      result.name,
      result.status,
    );
  }
}
