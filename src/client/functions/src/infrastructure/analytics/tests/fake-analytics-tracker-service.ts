import type { AnalyticsTrackEvent } from '../../../core/analytics/models/analytics-track-event';
import type { AnalyticsTrackerService } from '../../../core/analytics';

export class FakeAnalyticsTrackerService implements AnalyticsTrackerService {
  public readonly events: AnalyticsTrackEvent[] = [];
  public flushCalls = 0;

  public flush(): Promise<void> {
    this.flushCalls += 1;
    return Promise.resolve();
  }

  public track(event: AnalyticsTrackEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}
