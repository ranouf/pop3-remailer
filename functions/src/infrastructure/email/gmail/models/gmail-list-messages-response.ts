import type { GmailListMessage } from './gmail-list-message';

export interface GmailListMessagesResponse {
  readonly data: {
    readonly messages?: readonly GmailListMessage[] | null;
  };
}
