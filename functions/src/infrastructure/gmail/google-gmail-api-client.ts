/* eslint-disable sort-imports */
import type { OAuth2Client } from 'google-auth-library';
import { google, type gmail_v1 } from 'googleapis';

import type { GmailApiClient, OAuth2ClientLike } from './gmail-types';

export interface GmailApiClientFactory {
  create(auth: OAuth2ClientLike): GmailApiClient;
}

export class GoogleGmailApiClientFactory implements GmailApiClientFactory {
  public create(auth: OAuth2ClientLike): GmailApiClient {
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
