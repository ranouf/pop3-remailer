/* eslint-disable sort-imports */
import type { AmplitudeReturn, Result } from '@amplitude/analytics-core';

import type { AmplitudeNodeTrackEventModel } from './models/amplitude-node-track-event-model';

export interface AmplitudeNodeClientInterface {
  flush(): AmplitudeReturn<void>;
  track(event: AmplitudeNodeTrackEventModel): AmplitudeReturn<Result>;
}
