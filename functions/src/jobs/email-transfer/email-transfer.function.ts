import { onSchedule } from 'firebase-functions/v2/scheduler';

import { ConfigurationManager } from '../../core/configuration/configuration-manager';
import type { ConfigurationManagerInterface } from '../../core/configuration/configuration-manager.interface';
import type { ApplicationConfiguration } from '../../core/configuration/models/application-configuration';
import { createEmailTransferContainer } from './bootstrap/email-transfer.container';
import type { EmailTransferJobResult } from './email-transfer-job-result';
import type { EmailTransferJobInterface } from './email-transfer-job.interface';
import { EmailTransferModule } from './email-transfer.module';

export class EmailTransferFunction {
  public static readonly maxInstances = 1;
  public static readonly region = 'europe-west1';
  public static readonly timeoutSeconds = 60;

  public constructor(
    private readonly options: {
      readonly config?: ApplicationConfiguration;
      readonly configurationManager?: ConfigurationManagerInterface;
      readonly job?: EmailTransferJobInterface;
    } = {},
  ) {}

  // Runs the email transfer job once, resolving the job through DI unless a test double is provided.
  public run(): Promise<EmailTransferJobResult> {
    if (this.options.job !== undefined) {
      return this.options.job.run();
    }

    const config =
      this.options.config ??
      (this.options.configurationManager ?? new ConfigurationManager()).read();
    const job = createEmailTransferContainer({
      config,
    }).get<EmailTransferJobInterface>(EmailTransferModule.EmailTransferJob);

    return job.run();
  }

  // Creates the async handler used by Firebase Scheduler to trigger a single run.
  public createHandler(): () => Promise<void> {
    return async (): Promise<void> => {
      await this.run();
    };
  }

  // Builds the Firebase Scheduler configuration for the recurring email transfer job.
  public createScheduleOptions(): {
    readonly maxInstances: number;
    readonly region: string;
    readonly schedule: string;
    readonly timeoutSeconds: number;
  } {
    return {
      maxInstances: EmailTransferFunction.maxInstances,
      region: EmailTransferFunction.region,
      schedule: ConfigurationManager.scheduledTransferCron,
      timeoutSeconds: EmailTransferFunction.timeoutSeconds,
    };
  }

  // Exposes the Firebase scheduled function entrypoint for deployment and emulators.
  public createFunction() {
    return onSchedule(this.createScheduleOptions(), this.createHandler());
  }
}
