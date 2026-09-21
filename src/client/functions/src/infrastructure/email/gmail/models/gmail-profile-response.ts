export interface GmailProfileResponse {
  readonly data: {
    readonly emailAddress?: string | null;
    readonly messagesTotal?: number | null;
    readonly threadsTotal?: number | null;
  };
}
