import { createInstance } from '@amplitude/analytics-node';
import type * as AmplitudeCoreTypes from '@amplitude/analytics-core';

import type { AmplitudeNodeClientInterface } from './amplitude-node-client.interface';
import type { AmplitudeNodeTrackEventModel } from './models';

export class AmplitudeNodeClient implements AmplitudeNodeClientInterface {
  private static readonly defaultFlushIntervalMillis = 5000;
  private static readonly defaultInstanceName = 'pop3-remailer';

  private readonly client: AmplitudeCoreTypes.NodeClient;

  public constructor(apiKey: string) {
    const client = createInstance();
    client.init(apiKey, {
      flushIntervalMillis: AmplitudeNodeClient.defaultFlushIntervalMillis,
      instanceName: AmplitudeNodeClient.defaultInstanceName,
    });
    this.client = client;
  }

  public flush(): AmplitudeCoreTypes.AmplitudeReturn<void> {
    return this.client.flush();
  }

  public track(
    event: AmplitudeNodeTrackEventModel,
  ): AmplitudeCoreTypes.AmplitudeReturn<AmplitudeCoreTypes.Result> {
    const eventProperties: Record<
      string,
      string | number | boolean | null | undefined
    > = {
      ...event.event_properties,
    };
    const result = this.client.track(event.event_type, eventProperties, {
      ...(event.insert_id === undefined
        ? {}
        : {
            insert_id: event.insert_id,
          }),
    });

    return result;
  }
}
