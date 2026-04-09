import { OperationsApi } from './api/program';
import { createEmailTransferContainer } from './jobs/email-transfer/bootstrap/email-transfer.container';
import { EmailTransferModule } from './jobs/email-transfer/email-transfer.module';
import type { EmailTransferFunction } from './jobs/email-transfer/email-transfer.function';

export const api = OperationsApi.createFunction();
export const scheduledEmailTransfer = createEmailTransferContainer()
  .get<EmailTransferFunction>(EmailTransferModule.EmailTransferFunction)
  .createFunction();
