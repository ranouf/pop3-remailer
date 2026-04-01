import { ScheduledEmailTransferJobHelper } from './jobs/email-transfer-scheduled-job.helper';

export const foundationMarker = 'project-foundation';
export { runEmailTransferJobLocally } from './jobs/run-email-transfer-job-local';
export const scheduledEmailTransfer =
  ScheduledEmailTransferJobHelper.createFunction();
