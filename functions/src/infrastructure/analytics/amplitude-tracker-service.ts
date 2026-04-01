import type { AppConfig } from '../../config/environment';
import { AmplitudeNodeClient } from './amplitude-node-client';
import type {
  AnalyticsTracker,
  StructuredLogger,
  TrackerEventProperties,
  TransferEventName,
} from '../../domain/ports';
import type { AmplitudeNodeClientInterface } from './amplitude-node-client.interface';

export class AmplitudeTrackerService implements AnalyticsTracker {
  private readonly amplitudeClient: AmplitudeNodeClientInterface;
  private readonly analyticsConfig: AppConfig['analytics'];
  private readonly logger: StructuredLogger;

  public constructor(
    analyticsConfig: AppConfig['analytics'],
    logger: StructuredLogger,
    amplitudeClient: AmplitudeNodeClientInterface = new AmplitudeNodeClient(
      analyticsConfig.amplitudeApiKey,
    ),
  ) {
    this.analyticsConfig = analyticsConfig;
    this.logger = logger;
    this.amplitudeClient = amplitudeClient;
  }

  public async flush(): Promise<void> {
    try {
      await this.amplitudeClient.flush().promise;
    } catch (error) {
      this.logger.warn('Amplitude flush failed.', {
        error: this.toErrorMessage(error),
      });
    }
  }

  public async track(
    eventName: TransferEventName,
    properties: TrackerEventProperties,
  ): Promise<void> {
    const eventProperties = this.buildEventProperties(properties);
    const insertId = this.buildInsertId(eventName, eventProperties);

    try {
      await this.amplitudeClient.track({
        event_properties: eventProperties,
        event_type: eventName,
        ...(insertId === undefined
          ? {}
          : {
              insert_id: insertId,
            }),
      }).promise;
    } catch (error) {
      this.logger.warn('Amplitude tracking failed.', {
        error: this.toErrorMessage(error),
        eventName,
        properties: eventProperties,
      });
    }
  }

  private buildEventProperties(
    properties: TrackerEventProperties,
  ): TrackerEventProperties {
    const eventProperties: Record<string, string | number | boolean | null> = {
      environment: this.analyticsConfig.environmentName,
    };

    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined) {
        eventProperties[key] = value;
      }
    }

    return eventProperties;
  }

  private buildInsertId(
    eventName: TransferEventName,
    properties: TrackerEventProperties,
  ): string | undefined {
    const stableIdentifierParts = [
      this.readStringProperty(properties, 'jobId'),
      this.readStringProperty(properties, 'uidl'),
      this.readStringProperty(properties, 'executionTime'),
    ].filter((value): value is string => value !== undefined);

    return stableIdentifierParts.length === 0
      ? undefined
      : [eventName, ...stableIdentifierParts].join(':');
  }

  private readStringProperty(
    properties: TrackerEventProperties,
    key: string,
  ): string | undefined {
    const value = properties[key];

    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
