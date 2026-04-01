import type {
  TrackerEventProperties,
  TransferEventName,
} from '../../../domain/ports';

export interface AmplitudeNodeTrackEventModel {
  readonly device_id?: string;
  readonly event_properties: TrackerEventProperties;
  readonly event_type: TransferEventName;
  readonly insert_id?: string;
  readonly user_id?: string;
}
