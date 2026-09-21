import type { TrackerEventProperties } from '../../../core/analytics';

export interface AmplitudeNodeTrackEventModel {
  readonly device_id?: string;
  readonly event_properties: TrackerEventProperties;
  readonly event_type: string;
  readonly insert_id?: string;
  readonly user_id?: string;
}
