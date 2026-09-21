export enum HealthCheckName {
  Pop3 = 'pop3',
  Gmail = 'gmail',
  Firestore = 'firestore',
  Amplitude = 'amplitude',
}

export enum HealthCheckStatus {
  Healthy = 'healthy',
  Warning = 'warning',
  Error = 'error',
}

export class HealthCheckResult {
  public readonly checkedAt: Date;
  public readonly message: string;
  public readonly name: HealthCheckName;
  public readonly status: HealthCheckStatus;

  public constructor(params: {
    readonly checkedAt: Date;
    readonly message: string;
    readonly name: HealthCheckName;
    readonly status: HealthCheckStatus;
  }) {
    this.checkedAt = params.checkedAt;
    this.message = params.message;
    this.name = params.name;
    this.status = params.status;
  }
}
