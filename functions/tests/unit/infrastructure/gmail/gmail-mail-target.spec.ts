/* eslint-disable sort-imports */
import type { GmailApiClientFactory } from '../../../../src/infrastructure/gmail/google-gmail-api-client';
import { GoogleGmailMailTarget } from '../../../../src/infrastructure/gmail/gmail-mail-target';
import type { GmailOAuthProvider } from '../../../../src/infrastructure/gmail/gmail-oauth-provider';
import type { RawEmailMessage } from '../../../../src/domain/email';
import { createUidl } from '../../../../src/domain/uidl';
import type {
  GmailApiClient,
  GmailImportResponse,
  GmailListMessagesResponse,
  OAuth2ClientLike,
} from '../../../../src/infrastructure/gmail/gmail-types';

class FakeOAuthProvider implements GmailOAuthProvider {
  public readonly client: OAuth2ClientLike = {
    credentials: {},
    setCredentials(credentials: { readonly refresh_token: string }): void {
      this.credentials = credentials;
    },
  };

  public createClient(): OAuth2ClientLike {
    return this.client;
  }
}

class FakeGmailApiClient implements GmailApiClient {
  public readonly importCalls: Array<{
    readonly requestBody: {
      readonly internalDateSource: 'dateHeader';
      readonly labelIds: readonly string[];
      readonly raw: string;
    };
    readonly userId: string;
  }> = [];
  public readonly listCalls: Array<{
    readonly maxResults: number;
    readonly q: string;
    readonly userId: string;
  }> = [];
  public importResponse: GmailImportResponse = {
    data: {
      id: 'gmail-message-id',
      threadId: 'gmail-thread-id',
    },
  };
  public importShouldFail = false;
  public listResponse: GmailListMessagesResponse = {
    data: {
      messages: [{ id: 'gmail-found-id' }],
    },
  };
  public listShouldFail = false;

  public readonly users = {
    messages: {
      import: (request: {
        readonly requestBody: {
          readonly internalDateSource: 'dateHeader';
          readonly labelIds: readonly string[];
          readonly raw: string;
        };
        readonly userId: string;
      }): Promise<GmailImportResponse> => {
        this.importCalls.push(request);

        if (this.importShouldFail) {
          return Promise.reject(new Error('gmail import failed'));
        }

        return Promise.resolve(this.importResponse);
      },
      list: (request: {
        readonly maxResults: number;
        readonly q: string;
        readonly userId: string;
      }): Promise<GmailListMessagesResponse> => {
        this.listCalls.push(request);

        if (this.listShouldFail) {
          return Promise.reject(new Error('gmail lookup failed'));
        }

        return Promise.resolve(this.listResponse);
      },
    },
  };
}

class FakeGmailApiClientFactory implements GmailApiClientFactory {
  public readonly client = new FakeGmailApiClient();

  public create(): GmailApiClient {
    return this.client;
  }
}

const buildRawEmailMessage = (): RawEmailMessage => ({
  messageNumber: 7,
  messageSize: 128,
  rawMessage:
    'From: source@example.com\r\nMessage-ID: <abc123@example.com>\r\n\r\nBody',
  uidl: createUidl('uidl-gmail-1'),
});

describe('infrastructure/gmail/gmail-mail-target', () => {
  it('imports a raw message into Gmail and preserves the raw payload', async () => {
    const oauthProvider = new FakeOAuthProvider();
    const apiClientFactory = new FakeGmailApiClientFactory();
    const target = new GoogleGmailMailTarget(
      {
        clientId: 'gmail-client-id',
        clientSecret: 'gmail-client-secret',
        maxImportRetries: 2,
        refreshToken: 'refresh-token',
        timeoutMs: 15000,
        userEmail: 'destination@gmail.com',
      },
      oauthProvider,
      apiClientFactory,
    );

    const result = await target.importMessage(
      'destination@gmail.com',
      buildRawEmailMessage(),
    );

    expect(result).toEqual({
      gmailMessageId: 'gmail-message-id',
      gmailThreadId: 'gmail-thread-id',
    });
    expect(apiClientFactory.client.importCalls).toHaveLength(1);
    expect(apiClientFactory.client.importCalls[0]).toMatchObject({
      requestBody: {
        internalDateSource: 'dateHeader',
        labelIds: ['INBOX', 'UNREAD'],
      },
      userId: 'destination@gmail.com',
    });
    expect(apiClientFactory.client.importCalls[0]?.requestBody.raw).toBe(
      'RnJvbTogc291cmNlQGV4YW1wbGUuY29tDQpNZXNzYWdlLUlEOiA8YWJjMTIzQGV4YW1wbGUuY29tPg0KDQpCb2R5',
    );
  });

  it('looks up an imported Gmail message by RFC822 message id', async () => {
    const target = new GoogleGmailMailTarget(
      {
        clientId: 'gmail-client-id',
        clientSecret: 'gmail-client-secret',
        maxImportRetries: 1,
        refreshToken: 'refresh-token',
        timeoutMs: 15000,
        userEmail: 'destination@gmail.com',
      },
      new FakeOAuthProvider(),
      new FakeGmailApiClientFactory(),
    );

    const lookup = await target.findImportedMessageByRfc822MessageId(
      'destination@gmail.com',
      'abc123@example.com',
    );

    expect(lookup).toEqual({
      gmailMessageId: 'gmail-found-id',
    });
  });

  it('returns null when Gmail lookup finds no imported message', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    apiClientFactory.client.listResponse = {
      data: {
        messages: [],
      },
    };

    const target = new GoogleGmailMailTarget(
      {
        clientId: 'gmail-client-id',
        clientSecret: 'gmail-client-secret',
        maxImportRetries: 1,
        refreshToken: 'refresh-token',
        timeoutMs: 15000,
        userEmail: 'destination@gmail.com',
      },
      new FakeOAuthProvider(),
      apiClientFactory,
    );

    await expect(
      target.findImportedMessageByRfc822MessageId(
        'destination@gmail.com',
        'missing@example.com',
      ),
    ).resolves.toBeNull();
  });

  it('wraps Gmail import failures into a typed technical error', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    apiClientFactory.client.importShouldFail = true;
    const target = new GoogleGmailMailTarget(
      {
        clientId: 'gmail-client-id',
        clientSecret: 'gmail-client-secret',
        maxImportRetries: 1,
        refreshToken: 'refresh-token',
        timeoutMs: 0,
        userEmail: 'destination@gmail.com',
      },
      new FakeOAuthProvider(),
      apiClientFactory,
    );

    await expect(
      target.importMessage('destination@gmail.com', buildRawEmailMessage()),
    ).rejects.toMatchObject({
      category: 'technical',
      code: 'GMAIL_IMPORT_FAILED',
    });
  });

  it('wraps Gmail lookup failures into a typed technical error', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    apiClientFactory.client.listShouldFail = true;
    const target = new GoogleGmailMailTarget(
      {
        clientId: 'gmail-client-id',
        clientSecret: 'gmail-client-secret',
        maxImportRetries: 1,
        refreshToken: 'refresh-token',
        timeoutMs: 0,
        userEmail: 'destination@gmail.com',
      },
      new FakeOAuthProvider(),
      apiClientFactory,
    );

    await expect(
      target.findImportedMessageByRfc822MessageId(
        'destination@gmail.com',
        'abc123@example.com',
      ),
    ).rejects.toMatchObject({
      category: 'technical',
      code: 'GMAIL_LOOKUP_FAILED',
    });
  });
});
