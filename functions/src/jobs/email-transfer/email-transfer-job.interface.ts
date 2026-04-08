import type { EmailTransferJobResult } from './email-transfer-job-result';

export interface EmailTransferJobInterface {
  run(): Promise<EmailTransferJobResult>;
}
