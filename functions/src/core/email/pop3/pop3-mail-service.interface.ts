import type { Pop3MessageMetadata, RawEmailMessage } from './models';
import type { SourceAccount } from '../../../jobs/email-transfer/models/source-account';

export interface Pop3MailServiceInterface {
  getMessage(
    sourceAccount: SourceAccount,
    messageNumber: number,
  ): Promise<RawEmailMessage>;
  listMessages(
    sourceAccount: SourceAccount,
    options?: {
      readonly limit?: number;
    },
  ): Promise<readonly Pop3MessageMetadata[]>;
}
