import { RawEmailMessage } from '../../../../src/core/email/pop3';
import { TransferJobError } from '../../../../src/core/operation-error';
import { Uidl } from '../../../../src/core/email/uidl';
import type { GmailApiClientFactoryInterface } from '../../../../src/infrastructure/email/gmail/client/gmail-api-client-factory.interface';
import type { GmailApiClientInterface } from '../../../../src/infrastructure/email/gmail/client/gmail-api-client.interface';
import { GoogleGmailMailService } from '../../../../src/infrastructure/email/gmail/gmail-mail-service';
import type { GmailOAuthProviderInterface } from '../../../../src/infrastructure/email/gmail/oauth/gmail-oauth-provider.interface';
import type {
  GmailImportResponse,
  GmailListMessagesResponse,
  GmailProfileResponse,
} from '../../../../src/infrastructure/email/gmail/models';
import type { OAuth2ClientLikeInterface } from '../../../../src/infrastructure/email/gmail/oauth/oauth2-client-like.interface';

class FakeOAuthProvider implements GmailOAuthProviderInterface {
  public readonly client: OAuth2ClientLikeInterface = {
    credentials: {},
    setCredentials(credentials: { readonly refresh_token: string }): void {
      this.credentials = credentials;
    },
  };

  public createClient(): OAuth2ClientLikeInterface {
    return this.client;
  }
}

class FakeGmailApiClient implements GmailApiClientInterface {
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
  public importFailure: Error | null = null;
  public listResponse: GmailListMessagesResponse = {
    data: {
      messages: [{ id: 'gmail-found-id' }],
    },
  };
  public listFailure: Error | null = null;

  public readonly users = {
    getProfile: (): Promise<GmailProfileResponse> =>
      Promise.resolve({
        data: {
          emailAddress: 'destination@gmail.com',
        },
      }),
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

        if (this.importFailure !== null) {
          return Promise.reject(this.importFailure);
        }

        return Promise.resolve(this.importResponse);
      },
      list: (request: {
        readonly maxResults: number;
        readonly q: string;
        readonly userId: string;
      }): Promise<GmailListMessagesResponse> => {
        this.listCalls.push(request);

        if (this.listFailure !== null) {
          return Promise.reject(this.listFailure);
        }

        return Promise.resolve(this.listResponse);
      },
    },
  };
}

class FakeGmailApiClientFactory implements GmailApiClientFactoryInterface {
  public readonly client = new FakeGmailApiClient();

  public create(): GmailApiClientInterface {
    return this.client;
  }
}

const buildRawEmailMessage = (): RawEmailMessage =>
  new RawEmailMessage({
    messageNumber: 7,
    messageSize: 128,
    rawMessage:
      'From: source@example.com\r\nMessage-ID: <abc123@example.com>\r\n\r\nBody',
    uidl: Uidl.create('uidl-gmail-1'),
  });

describe('infrastructure/gmail/gmail-mail-service', () => {
  it('imports a raw message into Gmail and preserves the raw payload', async () => {
    const oauthProvider = new FakeOAuthProvider();
    const apiClientFactory = new FakeGmailApiClientFactory();
    const service = new GoogleGmailMailService(
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

    const result = await service.importMessage(
      'destination@gmail.com',
      buildRawEmailMessage(),
    );

    expect(result).toMatchObject({
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
    const service = new GoogleGmailMailService(
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

    const lookup = await service.findImportedMessageByRfc822MessageId(
      'destination@gmail.com',
      'abc123@example.com',
    );

    expect(lookup).toMatchObject({
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

    const service = new GoogleGmailMailService(
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
      service.findImportedMessageByRfc822MessageId(
        'destination@gmail.com',
        'missing@example.com',
      ),
    ).resolves.toBeNull();
  });

  it('returns only the identifiers that Gmail sends back after an import', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    apiClientFactory.client.importResponse = {
      data: {
        threadId: 'gmail-thread-id',
      },
    };

    const service = new GoogleGmailMailService(
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

    const result = await service.importMessage(
      'destination@gmail.com',
      buildRawEmailMessage(),
    );

    expect(result).toMatchObject({
      gmailThreadId: 'gmail-thread-id',
    });
  });

  it('wraps Gmail import failures into a typed technical error', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    const importFailure = new Error('gmail import failed') as Error & {
      code: number;
      response: {
        data: {
          error: {
            code: number;
            message: string;
            status: string;
          };
        };
        status: number;
        statusText: string;
      };
    };
    importFailure.code = 403;
    importFailure.response = {
      data: {
        error: {
          code: 403,
          message: 'Request had insufficient authentication scopes.',
          status: 'PERMISSION_DENIED',
        },
      },
      status: 403,
      statusText: 'Forbidden',
    };
    apiClientFactory.client.importFailure = importFailure;
    const service = new GoogleGmailMailService(
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

    const error = await service
      .importMessage('destination@gmail.com', buildRawEmailMessage())
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.category).toBe('technical');
    expect(error.code).toBe('GMAIL_IMPORT_FAILED');
    expect(error.details).toMatchObject({
      causeCode: 403,
      causeMessage: 'gmail import failed',
      causeResponseErrorCode: 403,
      causeResponseErrorMessage:
        'Request had insufficient authentication scopes.',
      causeResponseErrorStatus: 'PERMISSION_DENIED',
      causeResponseStatus: 403,
      causeResponseStatusText: 'Forbidden',
      messageId: 'abc123@example.com',
    });
  });

  it('captures non-structured Gmail API responses in the diagnostic details', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    apiClientFactory.client.importFailure = {
      code: 'ERR_BAD_RESPONSE',
      response: {
        data: 'upstream timeout',
        status: 502,
        statusText: 'Bad Gateway',
      },
    } as Error & {
      code: string;
      response: {
        data: string;
        status: number;
        statusText: string;
      };
    };
    const service = new GoogleGmailMailService(
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

    const error = await service
      .importMessage('destination@gmail.com', buildRawEmailMessage())
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.details).toMatchObject({
      causeCode: 'ERR_BAD_RESPONSE',
      causeResponseData: 'upstream timeout',
      causeResponseStatus: 502,
      causeResponseStatusText: 'Bad Gateway',
      messageId: 'abc123@example.com',
    });
  });

  it('wraps Gmail lookup failures into a typed technical error', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    apiClientFactory.client.listFailure = new Error('gmail lookup failed');
    const service = new GoogleGmailMailService(
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

    const error = await service
      .findImportedMessageByRfc822MessageId(
        'destination@gmail.com',
        'abc123@example.com',
      )
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.category).toBe('technical');
    expect(error.code).toBe('GMAIL_LOOKUP_FAILED');
    expect(error.details).toMatchObject({
      causeMessage: 'gmail lookup failed',
      causeName: 'Error',
    });
  });

  it('captures string rejections when Gmail lookup fails before returning an Error object', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    apiClientFactory.client.users.messages.list = (
      request,
    ): Promise<GmailListMessagesResponse> => {
      apiClientFactory.client.listCalls.push(request);
      const nonErrorRejection = 'gmail lookup failed' as unknown as Error;

      return Promise.reject(nonErrorRejection);
    };
    const service = new GoogleGmailMailService(
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

    const error = await service
      .findImportedMessageByRfc822MessageId(
        'destination@gmail.com',
        'abc123@example.com',
      )
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.details).toMatchObject({
      causeMessage: 'gmail lookup failed',
      rfc822MessageId: 'abc123@example.com',
    });
  });
});
