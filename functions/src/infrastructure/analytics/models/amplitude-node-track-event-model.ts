import type {
  TrackerEventProperties,
  TransferEventName,
} from '../../../domain/ports';

export interface AmplitudeNodeTrackEventModel {
  readonly event_properties: TrackerEventProperties;
  readonly event_type: TransferEventName;
  readonly insert_id?: string;
}
