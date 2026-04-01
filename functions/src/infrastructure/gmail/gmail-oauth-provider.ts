/* eslint-disable sort-imports */
import { google } from 'googleapis';

import type { AppConfig } from '../../config/environment';
import type { OAuth2ClientLike } from './gmail-types';

export const gmailImportScope = 'https://www.googleapis.com/auth/gmail.insert';

export interface GmailOAuthProvider {
  createClient(config: AppConfig['gmail']): OAuth2ClientLike;
}

export class GoogleGmailOAuthProvider implements GmailOAuthProvider {
  public createClient(config: AppConfig['gmail']): OAuth2ClientLike {
    const client = new google.auth.OAuth2(config.clientId, config.clientSecret);

    client.setCredentials({
      refresh_token: config.refreshToken,
    });

    return client;
  }
}
