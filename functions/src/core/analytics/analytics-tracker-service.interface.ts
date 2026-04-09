import type { AnalyticsTrackEvent } from './models/analytics-track-event';

export interface AnalyticsTrackerService {
  flush(): Promise<void>;
  track(event: AnalyticsTrackEvent): Promise<void>;
}
