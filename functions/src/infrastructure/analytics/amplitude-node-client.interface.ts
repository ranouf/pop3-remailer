import type { AmplitudeReturn, Result } from '@amplitude/analytics-core';

import type { AmplitudeNodeTrackEventModel } from './models';

export interface AmplitudeNodeClientInterface {
  flush(): AmplitudeReturn<void>;
  track(event: AmplitudeNodeTrackEventModel): AmplitudeReturn<Result>;
}
