import type { AmplitudeReturn, Result } from '@amplitude/analytics-core';

import { AmplitudeTrackerService } from '../../../../src/infrastructure/analytics/amplitude-tracker-service';
import type { AmplitudeNodeClientInterface } from '../../../../src/infrastructure/analytics/amplitude-node-client.interface';
import type { AmplitudeNodeTrackEventModel } from '../../../../src/infrastructure/analytics/models';
import type { StructuredLogger } from '../../../../src/domain/ports';
import { describe, expect, it, vi } from 'vitest';

class FakeAmplitudeNodeClient implements AmplitudeNodeClientInterface {
  public flushError: Error | null = null;
  public readonly flushSpy = vi.fn();
  public trackError: Error | null = null;
  public readonly trackedEvents: AmplitudeNodeTrackEventModel[] = [];

  public flush(): AmplitudeReturn<void> {
    this.flushSpy();

    return {
      promise:
        this.flushError === null
          ? Promise.resolve(undefined)
          : Promise.reject(this.flushError),
    };
  }

  public track(event: AmplitudeNodeTrackEventModel): AmplitudeReturn<Result> {
    this.trackedEvents.push(event);

    return {
      promise:
        this.trackError === null
          ? Promise.resolve({
              code: 200,
              event: {} as Result['event'],
              message: 'ok',
            })
          : Promise.reject(this.trackError),
    };
  }
}

class FakeLogger implements StructuredLogger {
  public readonly debugCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];
  public readonly errorCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];
  public readonly infoCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];
  public readonly warnCalls: Array<
    Readonly<Record<string, unknown>> | undefined
  > = [];

  public debug(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.debugCalls.push(context);
  }

  public error(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.errorCalls.push(context);
  }

  public info(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.infoCalls.push(context);
  }

  public warn(
    _message: string,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.warnCalls.push(context);
  }
}

describe('infrastructure/analytics/amplitude-tracker-service', () => {
  it('tracks an event with the configured environment and a deterministic insert id', async () => {
    const amplitudeClient = new FakeAmplitudeNodeClient();
    const logger = new FakeLogger();
    const service = new AmplitudeTrackerService(
      {
        amplitudeApiKey: 'amplitude-api-key',
        environmentName: 'test',
      },
      logger,
      amplitudeClient,
    );

    await service.track('email_transferred', {
      executionTime: '2026-04-01T00:00:00.000Z',
      jobId: 'job-123',
      processedCount: 1,
      sourceAccountId: 'orange:source@orange.fr',
      uidl: 'uidl-123',
      unused: undefined,
    });

    expect(amplitudeClient.trackedEvents).toEqual([
      {
        device_id: 'pop3-remailer-backend:test',
        event_properties: {
          environment: 'test',
          executionTime: '2026-04-01T00:00:00.000Z',
          jobId: 'job-123',
          processedCount: 1,
          sourceAccountId: 'orange:source@orange.fr',
          uidl: 'uidl-123',
        },
        event_type: 'email_transferred',
        insert_id:
          'email_transferred:job-123:uidl-123:2026-04-01T00:00:00.000Z',
        user_id: 'orange:source@orange.fr',
      },
    ]);
    expect(logger.warnCalls).toHaveLength(0);
  });

  it('omits the insert id when no stable identifier is available', async () => {
    const amplitudeClient = new FakeAmplitudeNodeClient();
    const service = new AmplitudeTrackerService(
      {
        amplitudeApiKey: 'amplitude-api-key',
        environmentName: 'test',
      },
      new FakeLogger(),
      amplitudeClient,
    );

    await service.track('job_finished', {
      processedCount: 4,
    });

    expect(amplitudeClient.trackedEvents).toEqual([
      {
        device_id: 'pop3-remailer-backend:test',
        event_properties: {
          environment: 'test',
          processedCount: 4,
        },
        event_type: 'job_finished',
      },
    ]);
  });

  it('swallows tracking failures and logs a warning', async () => {
    const amplitudeClient = new FakeAmplitudeNodeClient();
    amplitudeClient.trackError = new Error('amplitude unavailable');
    const logger = new FakeLogger();
    const service = new AmplitudeTrackerService(
      {
        amplitudeApiKey: 'amplitude-api-key',
        environmentName: 'test',
      },
      logger,
      amplitudeClient,
    );

    await expect(
      service.track('gmail_import_failed', {
        jobId: 'job-123',
        sourceAccountId: 'orange:source@orange.fr',
        uidl: 'uidl-123',
      }),
    ).resolves.toBeUndefined();

    expect(logger.warnCalls).toEqual([
      {
        error: 'amplitude unavailable',
        eventName: 'gmail_import_failed',
        properties: {
          environment: 'test',
          jobId: 'job-123',
          sourceAccountId: 'orange:source@orange.fr',
          uidl: 'uidl-123',
        },
      },
    ]);
  });

  it('flushes pending events without throwing when Amplitude fails', async () => {
    const amplitudeClient = new FakeAmplitudeNodeClient();
    amplitudeClient.flushError = new Error('flush failed');
    const logger = new FakeLogger();
    const service = new AmplitudeTrackerService(
      {
        amplitudeApiKey: 'amplitude-api-key',
        environmentName: 'test',
      },
      logger,
      amplitudeClient,
    );

    await expect(service.flush()).resolves.toBeUndefined();

    expect(amplitudeClient.flushSpy).toHaveBeenCalledTimes(1);
    expect(logger.warnCalls).toEqual([
      {
        error: 'flush failed',
      },
    ]);
  });
});
