import type { GmailImportResponse, GmailListMessagesResponse } from '../models';

export interface GmailMessagesResourceInterface {
  import(request: {
    readonly requestBody: {
      readonly internalDateSource: 'dateHeader';
      readonly labelIds: readonly string[];
      readonly raw: string;
    };
    readonly userId: string;
  }): Promise<GmailImportResponse>;
  list(request: {
    readonly maxResults: number;
    readonly q: string;
    readonly userId: string;
  }): Promise<GmailListMessagesResponse>;
}
