import type { GmailMessagesResourceInterface } from './gmail-messages-resource.interface';
import type { GmailProfileResponse } from '../models';

export interface GmailUsersResourceInterface {
  getProfile(request: {
    readonly userId: string;
  }): Promise<GmailProfileResponse>;
  readonly messages: GmailMessagesResourceInterface;
}
