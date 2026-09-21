import type { ApplicationConfiguration } from '../../../../core/configuration/models/application-configuration';
import {
  JobErrorCategory,
  OperationErrorHelper,
} from '../../../../core/operation-error';
import {
  HealthCheckName,
  HealthCheckStatus,
  type HealthCheckResult,
} from '../../../../core/health-check/models';
import type { Pop3HealthChecker } from '../../../../core/health-check/pop3-health-checker.interface';
import type { Clock } from '../../../../core/time/clock.interface';
import { SystemClock } from '../../../time/system-clock';
import type { Pop3CommandFactoryInterface } from '../client/pop3-command-factory.interface';
import { NodePop3CommandFactory } from '../client/node-pop3-command-factory';

export interface Pop3ConnectivityHealthCheckerDependencies {
  readonly clock?: Clock;
  readonly commandFactory?: Pop3CommandFactoryInterface;
}

export class Pop3ConnectivityHealthChecker implements Pop3HealthChecker {
  private readonly clock: Clock;
  private readonly commandFactory: Pop3CommandFactoryInterface;
  private readonly pop3Config: ApplicationConfiguration['pop3'];

  public constructor(
    pop3Config: ApplicationConfiguration['pop3'],
    dependencies: Pop3ConnectivityHealthCheckerDependencies = {},
  ) {
    this.clock = dependencies.clock ?? new SystemClock();
    this.commandFactory =
      dependencies.commandFactory ?? new NodePop3CommandFactory();
    this.pop3Config = pop3Config;
  }

  public async check(): Promise<HealthCheckResult> {
    const checkedAt = this.clock.now();
    const client = this.commandFactory.create(this.pop3Config);
    let connected = false;

    try {
      await client.connect();
      connected = true;

      return {
        checkedAt,
        message: 'POP3 connection and authentication succeeded.',
        name: HealthCheckName.Pop3,
        status: HealthCheckStatus.Healthy,
      };
    } catch (error) {
      throw OperationErrorHelper.create(error, {
        category: JobErrorCategory.Technical,
        code: 'POP3_HEALTHCHECK_FAILED',
        details: {
          host: this.pop3Config.host,
          port: this.pop3Config.port,
          tls: this.pop3Config.tls,
        },
        message: 'Failed to validate POP3 connectivity.',
        retriable: true,
      });
    } finally {
      if (connected) {
        try {
          await client.QUIT();
        } catch {
          // Ignore QUIT failures so a successful connectivity check remains healthy.
        }
      }
    }
  }
}
