import { onSchedule } from 'firebase-functions/v2/scheduler';

import { scheduledTransferCron } from '../config/runtime';
import type { ScheduledEmailTransferJobOptionsInterface } from './scheduled-email-transfer-job-options.interface';
import { RunEmailTransferJobHelper } from './run-email-transfer-job.helper';
import { ScheduledEmailTransferJobSettings } from './settings/scheduled-email-transfer-job.settings';

export class ScheduledEmailTransferJobHelper {
  public static createHandler(
    options: ScheduledEmailTransferJobOptionsInterface = {},
  ): () => Promise<void> {
    const runJob = options.runJob ?? RunEmailTransferJobHelper.run;

    return async (): Promise<void> => {
      await runJob();
    };
  }

  public static createScheduleOptions(): {
    readonly region: string;
    readonly schedule: string;
    readonly timeoutSeconds: number;
  } {
    return {
      region: ScheduledEmailTransferJobSettings.region,
      schedule: scheduledTransferCron,
      timeoutSeconds: ScheduledEmailTransferJobSettings.timeoutSeconds,
    };
  }

  public static createFunction(
    options: ScheduledEmailTransferJobOptionsInterface = {},
  ) {
    return onSchedule(
      ScheduledEmailTransferJobHelper.createScheduleOptions(),
      ScheduledEmailTransferJobHelper.createHandler(options),
    );
  }
}
