import type { GmailMessagesResourceInterface } from './gmail-messages-resource.interface';

export interface GmailUsersResourceInterface {
  readonly messages: GmailMessagesResourceInterface;
}
