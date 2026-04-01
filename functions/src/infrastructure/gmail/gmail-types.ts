export interface GmailListMessage {
  readonly id?: string | null;
}

export interface GmailListMessagesResponse {
  readonly data: {
    readonly messages?: readonly GmailListMessage[] | null;
  };
}

export interface GmailImportResponse {
  readonly data: {
    readonly id?: string | null;
    readonly threadId?: string | null;
  };
}

export interface GmailMessagesResource {
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

export interface GmailUsersResource {
  readonly messages: GmailMessagesResource;
}

export interface GmailApiClient {
  readonly users: GmailUsersResource;
}

export interface OAuth2ClientLike {
  credentials: {
    readonly refresh_token?: string | null;
  };
  setCredentials(credentials: { readonly refresh_token: string }): void;
}
