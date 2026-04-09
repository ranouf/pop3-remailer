import type { GmailImportedMessageLookup, GmailImportResult } from './models';
import type { RawEmailMessage } from '../pop3';

export { GmailImportedMessageLookup, GmailImportResult } from './models';

export interface GmailMailService {
  findImportedMessageByRfc822MessageId(
    gmailUserEmail: string,
    rfc822MessageId: string,
  ): Promise<GmailImportedMessageLookup | null>;
  importMessage(
    gmailUserEmail: string,
    message: RawEmailMessage,
  ): Promise<GmailImportResult>;
}
