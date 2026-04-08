import type { ApplicationConfiguration } from '../../core/configuration/models/application-configuration';
import { AmplitudeNodeClient } from './client/amplitude-node-client';
import type {
  AnalyticsTrackEvent,
  AnalyticsTrackerService,
  TrackerEventProperties,
} from '../../core/analytics';
import type { StructuredLogger } from '../../core/logging/structured-logger.interface';
import type { AmplitudeNodeClientInterface } from './client/amplitude-node-client.interface';

export class AmplitudeTrackerService implements AnalyticsTrackerService {
  private static readonly backendDeviceIdPrefix = 'pop3-remailer-backend';

  private readonly amplitudeClient: AmplitudeNodeClientInterface;
  private readonly analyticsConfig: ApplicationConfiguration['analytics'];
  private readonly logger: StructuredLogger;

  public constructor(
    analyticsConfig: ApplicationConfiguration['analytics'],
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

  public async track(event: AnalyticsTrackEvent): Promise<void> {
    const eventProperties = this.buildEventProperties(event.properties);
    const identity = this.buildEventIdentity(eventProperties);
    const insertId = this.buildInsertId(event);

    try {
      await this.amplitudeClient.track({
        device_id: identity.deviceId,
        event_properties: eventProperties,
        event_type: event.eventName,
        ...(insertId === undefined
          ? {}
          : {
              insert_id: insertId,
            }),
        ...(identity.userId === undefined
          ? {}
          : {
              user_id: identity.userId,
            }),
      }).promise;
    } catch (error) {
      this.logger.warn('Amplitude tracking failed.', {
        error: this.toErrorMessage(error),
        eventName: event.eventName,
        properties: eventProperties,
      });
    }
  }

  private buildEventIdentity(properties: TrackerEventProperties): {
    readonly deviceId: string;
    readonly userId?: string;
  } {
    const sourceAccountId = this.readStringProperty(
      properties,
      'sourceAccountId',
    );

    return {
      deviceId: `${AmplitudeTrackerService.backendDeviceIdPrefix}:${this.analyticsConfig.environmentName}`,
      ...(sourceAccountId === undefined
        ? {}
        : {
            userId: sourceAccountId,
          }),
    };
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

  private buildInsertId(event: AnalyticsTrackEvent): string | undefined {
    const stableIdentifierParts = [
      this.readStringProperty(event.properties, 'jobId'),
      this.readStringProperty(event.properties, 'uidl'),
      this.readStringProperty(event.properties, 'executionTime'),
    ].filter((value): value is string => value !== undefined);

    return stableIdentifierParts.length === 0
      ? undefined
      : [event.eventName, ...stableIdentifierParts].join(':');
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
