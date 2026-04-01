import { AmplitudeNodeClient } from '../../../../src/infrastructure/analytics/amplitude-node-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createInstanceMock, flushMock, initMock, trackMock } = vi.hoisted(
  () => {
    const hoistedFlushMock = vi.fn(() => ({
      promise: Promise.resolve(undefined),
    }));
    const hoistedInitMock = vi.fn();
    const hoistedTrackMock = vi.fn(() => ({
      promise: Promise.resolve(undefined),
    }));
    const hoistedCreateInstanceMock = vi.fn(() => ({
      flush: hoistedFlushMock,
      init: hoistedInitMock,
      track: hoistedTrackMock,
    }));

    return {
      createInstanceMock: hoistedCreateInstanceMock,
      flushMock: hoistedFlushMock,
      initMock: hoistedInitMock,
      trackMock: hoistedTrackMock,
    };
  },
);

vi.mock('@amplitude/analytics-node', () => ({
  createInstance: createInstanceMock,
}));

describe('infrastructure/analytics/amplitude-node-client', () => {
  beforeEach(() => {
    createInstanceMock.mockClear();
    flushMock.mockClear();
    initMock.mockClear();
    trackMock.mockClear();
  });

  it('initializes the official Amplitude SDK client with the project defaults', () => {
    new AmplitudeNodeClient('amplitude-api-key');

    expect(createInstanceMock).toHaveBeenCalledTimes(1);
    expect(initMock).toHaveBeenCalledWith('amplitude-api-key', {
      flushIntervalMillis: 5000,
      instanceName: 'pop3-remailer',
    });
  });

  it('forwards track calls to the Amplitude SDK client', async () => {
    const client = new AmplitudeNodeClient('amplitude-api-key');

    await client.track({
      device_id: 'pop3-remailer-backend:test',
      event_properties: {
        environment: 'test',
        jobId: 'job-123',
      },
      event_type: 'job_started',
      insert_id: 'job_started:job-123',
      user_id: 'orange:source@orange.fr',
    }).promise;

    expect(trackMock).toHaveBeenCalledWith(
      'job_started',
      {
        environment: 'test',
        jobId: 'job-123',
      },
      {
        device_id: 'pop3-remailer-backend:test',
        insert_id: 'job_started:job-123',
        user_id: 'orange:source@orange.fr',
      },
    );
  });

  it('forwards flush calls to the Amplitude SDK client', async () => {
    const client = new AmplitudeNodeClient('amplitude-api-key');

    await client.flush().promise;

    expect(flushMock).toHaveBeenCalledTimes(1);
  });
});
