import type {
  Pop3MessageMetadata,
  Pop3MessageReference,
  RawEmailMessage,
} from './models';
import type { SourceAccount } from '../../../jobs/email-transfer/models/source-account';

export interface Pop3MailServiceInterface {
  getMessageMetadata(
    sourceAccount: SourceAccount,
    messageNumber: number,
  ): Promise<Pop3MessageMetadata>;
  getMessage(
    sourceAccount: SourceAccount,
    messageNumber: number,
  ): Promise<RawEmailMessage>;
  listMessageReferences(
    sourceAccount: SourceAccount,
    options?: {
      readonly limit?: number;
    },
  ): Promise<readonly Pop3MessageReference[]>;
  listMessages(
    sourceAccount: SourceAccount,
    options?: {
      readonly limit?: number;
    },
  ): Promise<readonly Pop3MessageMetadata[]>;
}
