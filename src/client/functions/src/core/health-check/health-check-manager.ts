import {
  HealthCheckReport,
  HealthCheckName,
  HealthCheckResult,
  HealthCheckStatus,
} from './models';
import type { AmplitudeHealthChecker } from './amplitude-health-checker.interface';
import type { FirestoreHealthChecker } from './firestore-health-checker.interface';
import type { GmailHealthChecker } from './gmail-health-checker.interface';
import type { Pop3HealthChecker } from './pop3-health-checker.interface';
import type { Clock } from '../time/clock.interface';
import { SystemClock } from '../../infrastructure/time/system-clock';
import type { HealthCheckManagerInterface } from './health-check-manager.interface';

export class HealthCheckManager implements HealthCheckManagerInterface {
  private readonly amplitudeHealthChecker: AmplitudeHealthChecker;
  private readonly clock: Clock;
  private readonly firestoreHealthChecker: FirestoreHealthChecker;
  private readonly gmailHealthChecker: GmailHealthChecker;
  private readonly pop3HealthChecker: Pop3HealthChecker;

  public constructor(
    pop3HealthChecker: Pop3HealthChecker,
    gmailHealthChecker: GmailHealthChecker,
    firestoreHealthChecker: FirestoreHealthChecker,
    amplitudeHealthChecker: AmplitudeHealthChecker,
    clock: Clock = new SystemClock(),
  ) {
    this.amplitudeHealthChecker = amplitudeHealthChecker;
    this.clock = clock;
    this.firestoreHealthChecker = firestoreHealthChecker;
    this.gmailHealthChecker = gmailHealthChecker;
    this.pop3HealthChecker = pop3HealthChecker;
  }

  public async execute(): Promise<HealthCheckReport> {
    const [pop3Result, gmailResult, firestoreResult, amplitudeResult] =
      await Promise.all([
        this.runHealthCheck(HealthCheckName.Pop3, () =>
          this.pop3HealthChecker.check(),
        ),
        this.runHealthCheck(HealthCheckName.Gmail, () =>
          this.gmailHealthChecker.check(),
        ),
        this.runHealthCheck(HealthCheckName.Firestore, () =>
          this.firestoreHealthChecker.check(),
        ),
        this.runHealthCheck(HealthCheckName.Amplitude, () =>
          this.amplitudeHealthChecker.check(),
        ),
      ]);
    const checkedAt = this.clock.now();
    const checks = [
      pop3Result,
      gmailResult,
      firestoreResult,
      amplitudeResult,
    ] as const;

    return new HealthCheckReport(checkedAt, checks);
  }

  private async runHealthCheck(
    name: HealthCheckName,
    operation: () => Promise<HealthCheckResult>,
  ): Promise<HealthCheckResult> {
    try {
      return await operation();
    } catch (error) {
      return new HealthCheckResult({
        checkedAt: this.clock.now(),
        message:
          error instanceof Error
            ? error.message
            : `Unexpected ${name} healthcheck failure.`,
        name,
        status:
          name === HealthCheckName.Amplitude
            ? HealthCheckStatus.Warning
            : HealthCheckStatus.Error,
      });
    }
  }
}
