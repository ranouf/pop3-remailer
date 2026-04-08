import type { GmailUsersResourceInterface } from './gmail-users-resource.interface';

export interface GmailApiClientInterface {
  readonly users: GmailUsersResourceInterface;
}
