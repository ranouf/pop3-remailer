import type {
  GmailImportResponse,
  GmailListMessagesResponse,
  GmailProfileResponse,
} from '../models';
import type { GmailApiClientInterface } from '../client/gmail-api-client.interface';
import type { GmailApiClientFactoryInterface } from '../client/gmail-api-client-factory.interface';

export class FakeGmailApiClientFactory implements GmailApiClientFactoryInterface {
  public readonly clients: FakeGmailApiClient[] = [];

  public constructor(
    private readonly profileEmailAddress = 'destination@gmail.com',
  ) {}

  public create(): GmailApiClientInterface {
    const client = new FakeGmailApiClient(this.profileEmailAddress);

    this.clients.push(client);

    return client;
  }
}

class FakeGmailApiClient implements GmailApiClientInterface {
  public readonly importedMessages: Array<{
    readonly raw?: string;
    readonly userId?: string;
  }> = [];
  public readonly messageQueries: Array<{
    readonly q?: string;
    readonly userId?: string;
  }> = [];
  public readonly users = {
    getProfile: (): Promise<GmailProfileResponse> =>
      Promise.resolve({
        data: {
          emailAddress: this.profileEmailAddress,
        },
      }),
    messages: {
      import: (params?: {
        readonly requestBody?: {
          readonly raw?: string;
        };
        readonly userId?: string;
      }): Promise<GmailImportResponse> => {
        this.importedMessages.push({
          ...(params?.requestBody?.raw === undefined
            ? {}
            : {
                raw: params.requestBody.raw,
              }),
          ...(params?.userId === undefined
            ? {}
            : {
                userId: params.userId,
              }),
        });

        return Promise.resolve({
          data: {
            id: 'fake-gmail-message-id',
            threadId: 'fake-gmail-thread-id',
          },
        });
      },
      list: (params?: {
        readonly q?: string;
        readonly userId?: string;
      }): Promise<GmailListMessagesResponse> => {
        this.messageQueries.push({
          ...(params?.q === undefined
            ? {}
            : {
                q: params.q,
              }),
          ...(params?.userId === undefined
            ? {}
            : {
                userId: params.userId,
              }),
        });

        return Promise.resolve({
          data: {
            messages: [],
          },
        });
      },
    },
  };

  public constructor(private readonly profileEmailAddress: string) {}
}
