import type { AmplitudeReturn, Result } from '@amplitude/analytics-core';

import type { AmplitudeNodeTrackEventModel } from '../models';
import type { AmplitudeNodeClientInterface } from '../client/amplitude-node-client.interface';

export class FakeAmplitudeNodeClient implements AmplitudeNodeClientInterface {
  public readonly trackedEvents: AmplitudeNodeTrackEventModel[] = [];
  public flushCount = 0;

  public constructor(private readonly shouldFail = false) {}

  public flush(): AmplitudeReturn<void> {
    this.flushCount += 1;

    if (this.shouldFail) {
      return {
        promise: Promise.reject(new Error('Amplitude flush failed.')),
      } as AmplitudeReturn<void>;
    }

    return {
      promise: Promise.resolve(),
    } as AmplitudeReturn<void>;
  }

  public track(event: AmplitudeNodeTrackEventModel): AmplitudeReturn<Result> {
    this.trackedEvents.push(event);

    if (this.shouldFail) {
      return {
        promise: Promise.reject(new Error('Amplitude track failed.')),
      } as AmplitudeReturn<Result>;
    }

    return {
      promise: Promise.resolve({
        code: 200,
        event,
        message: 'Event accepted.',
      }),
    } as AmplitudeReturn<Result>;
  }
}
