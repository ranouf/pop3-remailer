import type { ApplicationConfiguration } from '../../../core/configuration/models/application-configuration';
import {
  JobErrorCategory,
  OperationErrorHelper,
} from '../../../core/operation-error';
import {
  HealthCheckName,
  HealthCheckStatus,
  type HealthCheckResult,
} from '../../../core/health-check/models';
import type { AmplitudeHealthChecker } from '../../../core/health-check/amplitude-health-checker.interface';
import type { Clock } from '../../../core/time/clock.interface';
import { SystemClock } from '../../time/system-clock';
import { AmplitudeNodeClient } from '../client/amplitude-node-client';
import type { AmplitudeNodeClientInterface } from '../client/amplitude-node-client.interface';

export interface AmplitudeConnectivityHealthCheckerDependencies {
  readonly amplitudeClient?: AmplitudeNodeClientInterface;
  readonly clock?: Clock;
}

export class AmplitudeConnectivityHealthChecker implements AmplitudeHealthChecker {
  private static readonly eventType = 'operations_api_healthcheck';

  private readonly amplitudeClient: AmplitudeNodeClientInterface;
  private readonly analyticsConfig: ApplicationConfiguration['analytics'];
  private readonly clock: Clock;

  public constructor(
    analyticsConfig: ApplicationConfiguration['analytics'],
    dependencies: AmplitudeConnectivityHealthCheckerDependencies = {},
  ) {
    this.amplitudeClient =
      dependencies.amplitudeClient ??
      new AmplitudeNodeClient(analyticsConfig.amplitudeApiKey);
    this.analyticsConfig = analyticsConfig;
    this.clock = dependencies.clock ?? new SystemClock();
  }

  public async check(): Promise<HealthCheckResult> {
    const checkedAt = this.clock.now();

    try {
      await this.amplitudeClient.track({
        device_id: `operations-api-healthcheck:${this.analyticsConfig.environmentName}`,
        event_properties: {
          environment: this.analyticsConfig.environmentName,
          healthcheck: true,
          source: 'operations-api',
        },
        event_type: AmplitudeConnectivityHealthChecker.eventType,
        insert_id: `operations-api-healthcheck:${checkedAt.toISOString()}`,
      }).promise;
      await this.amplitudeClient.flush().promise;

      return {
        checkedAt,
        message: 'Amplitude accepted the healthcheck event.',
        name: HealthCheckName.Amplitude,
        status: HealthCheckStatus.Healthy,
      };
    } catch (error) {
      throw OperationErrorHelper.create(error, {
        category: JobErrorCategory.Technical,
        code: 'AMPLITUDE_HEALTHCHECK_FAILED',
        details: {
          environmentName: this.analyticsConfig.environmentName,
        },
        message: 'Failed to validate Amplitude connectivity.',
        retriable: true,
      });
    }
  }
}
