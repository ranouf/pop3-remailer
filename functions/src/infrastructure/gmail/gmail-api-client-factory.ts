import type { OAuth2Client } from 'google-auth-library';
import { google, type gmail_v1 } from 'googleapis';

import type { GmailApiClientFactoryInterface } from './gmail-api-client-factory.interface';
import type { GmailApiClientInterface } from './gmail-api-client.interface';
import type { OAuth2ClientLikeInterface } from './oauth2-client-like.interface';

export class GmailApiClientFactory implements GmailApiClientFactoryInterface {
  public create(auth: OAuth2ClientLikeInterface): GmailApiClientInterface {
    const googleClient = google.gmail({
      auth: auth as unknown as OAuth2Client,
      version: 'v1',
    });

    return {
      users: {
        messages: {
          import: async (request) => {
            const response = await googleClient.users.messages.import({
              internalDateSource: request.requestBody.internalDateSource,
              requestBody: {
                labelIds: [...request.requestBody.labelIds],
                raw: request.requestBody.raw,
              },
              userId: request.userId,
            } satisfies gmail_v1.Params$Resource$Users$Messages$Import);

            return response;
          },
          list: async (request) => {
            const response = await googleClient.users.messages.list({
              maxResults: request.maxResults,
              q: request.q,
              userId: request.userId,
            } satisfies gmail_v1.Params$Resource$Users$Messages$List);

            return response;
          },
        },
      },
    };
  }
}
