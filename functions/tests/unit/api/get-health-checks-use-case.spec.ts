import { describe, expect, it } from 'vitest';

import type { AmplitudeHealthChecker } from '../../../src/core/health-check/amplitude-health-checker.interface';
import type { FirestoreHealthChecker } from '../../../src/core/health-check/firestore-health-checker.interface';
import type { GmailHealthChecker } from '../../../src/core/health-check/gmail-health-checker.interface';
import { HealthCheckManager } from '../../../src/core/health-check/health-check-manager';
import {
  HealthCheckName,
  HealthCheckResult,
  HealthCheckStatus,
} from '../../../src/core/health-check/models';
import type { Pop3HealthChecker } from '../../../src/core/health-check/pop3-health-checker.interface';

class FakePop3HealthChecker implements Pop3HealthChecker {
  public check(): Promise<HealthCheckResult> {
    return Promise.resolve(
      new HealthCheckResult({
        checkedAt: new Date('2026-04-07T10:00:00.000Z'),
        message: 'POP3 healthy',
        name: HealthCheckName.Pop3,
        status: HealthCheckStatus.Healthy,
      }),
    );
  }
}

class FakeGmailHealthChecker implements GmailHealthChecker {
  public check(): Promise<HealthCheckResult> {
    return Promise.resolve(
      new HealthCheckResult({
        checkedAt: new Date('2026-04-07T10:00:01.000Z'),
        message: 'Gmail healthy',
        name: HealthCheckName.Gmail,
        status: HealthCheckStatus.Healthy,
      }),
    );
  }
}

class FakeFirestoreHealthChecker implements FirestoreHealthChecker {
  public check(): Promise<HealthCheckResult> {
    return Promise.resolve(
      new HealthCheckResult({
        checkedAt: new Date('2026-04-07T10:00:02.000Z'),
        message: 'Firestore healthy',
        name: HealthCheckName.Firestore,
        status: HealthCheckStatus.Healthy,
      }),
    );
  }
}

class FakeAmplitudeHealthChecker implements AmplitudeHealthChecker {
  public check(): Promise<HealthCheckResult> {
    return Promise.resolve(
      new HealthCheckResult({
        checkedAt: new Date('2026-04-07T10:00:03.000Z'),
        message: 'Amplitude healthy',
        name: HealthCheckName.Amplitude,
        status: HealthCheckStatus.Healthy,
      }),
    );
  }
}

describe('unit/api/get-health-checks-use-case', () => {
  it('builds a health check report from all checkers', async () => {
    const manager = new HealthCheckManager(
      new FakePop3HealthChecker(),
      new FakeGmailHealthChecker(),
      new FakeFirestoreHealthChecker(),
      new FakeAmplitudeHealthChecker(),
      {
        now: () => new Date('2026-04-07T10:05:00.000Z'),
      },
    );

    const report = await manager.execute();

    expect(report.checkedAt).toEqual(new Date('2026-04-07T10:05:00.000Z'));
    expect(report.checks).toHaveLength(4);
    expect(report.checks.map((entry) => entry.name)).toEqual([
      HealthCheckName.Pop3,
      HealthCheckName.Gmail,
      HealthCheckName.Firestore,
      HealthCheckName.Amplitude,
    ]);
  });
});
