import { RunEmailTransferJobHelper } from './run-email-transfer-job.helper';

export interface ScheduledEmailTransferJobOptionsInterface {
  readonly runJob?: typeof RunEmailTransferJobHelper.run;
}
