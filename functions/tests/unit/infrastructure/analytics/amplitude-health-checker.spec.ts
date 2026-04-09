import {
  HealthCheckName,
  HealthCheckStatus,
} from '../../../../src/core/health-check/models';
import { TransferJobError } from '../../../../src/core/operation-error';
import { AmplitudeConnectivityHealthChecker } from '../../../../src/infrastructure/analytics/healthchecks/amplitude-health-checker';
import type { AmplitudeNodeClientInterface } from '../../../../src/infrastructure/analytics/client/amplitude-node-client.interface';

class FakeAmplitudeClient implements AmplitudeNodeClientInterface {
  public flushError: Error | null = null;
  public trackError: Error | null = null;

  public flush() {
    return {
      promise:
        this.flushError === null
          ? Promise.resolve()
          : Promise.reject(this.flushError),
    };
  }

  public track(event: { readonly event_type: string }) {
    return {
      promise:
        this.trackError === null
          ? Promise.resolve({
              code: 200,
              event,
              message: 'OK',
            })
          : Promise.reject(this.trackError),
    };
  }
}

describe('infrastructure/analytics/amplitude-health-checker', () => {
  it('returns a healthy status when amplitude accepts the event', async () => {
    const checker = new AmplitudeConnectivityHealthChecker(
      {
        amplitudeApiKey: 'amplitude-key',
        environmentName: 'production',
      },
      {
        amplitudeClient: new FakeAmplitudeClient(),
        clock: {
          now: () => new Date('2026-04-02T10:00:00.000Z'),
        },
      },
    );

    await expect(checker.check()).resolves.toEqual({
      checkedAt: new Date('2026-04-02T10:00:00.000Z'),
      message: 'Amplitude accepted the healthcheck event.',
      name: HealthCheckName.Amplitude,
      status: HealthCheckStatus.Healthy,
    });
  });

  it('wraps amplitude failures into a typed technical error', async () => {
    const client = new FakeAmplitudeClient();
    client.trackError = new Error('Invalid API key.');
    const checker = new AmplitudeConnectivityHealthChecker(
      {
        amplitudeApiKey: 'amplitude-key',
        environmentName: 'production',
      },
      {
        amplitudeClient: client,
      },
    );

    const error = await checker
      .check()
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.code).toBe('AMPLITUDE_HEALTHCHECK_FAILED');
    expect(error.message).toBe('Failed to validate Amplitude connectivity.');
  });

  it('fails when the flush step rejects after the event is accepted', async () => {
    const client = new FakeAmplitudeClient();
    client.flushError = new Error('Flush timeout.');
    const checker = new AmplitudeConnectivityHealthChecker(
      {
        amplitudeApiKey: 'amplitude-key',
        environmentName: 'production',
      },
      {
        amplitudeClient: client,
      },
    );

    const error = await checker
      .check()
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.code).toBe('AMPLITUDE_HEALTHCHECK_FAILED');
  });
});
