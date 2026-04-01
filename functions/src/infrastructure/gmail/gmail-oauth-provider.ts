import { google } from 'googleapis';

import type { AppConfig } from '../../config/environment';
import type { GmailOAuthProviderInterface } from './gmail-oauth-provider.interface';
import type { OAuth2ClientLikeInterface } from './oauth2-client-like.interface';

export class GoogleGmailOAuthProvider implements GmailOAuthProviderInterface {
  public createClient(config: AppConfig['gmail']): OAuth2ClientLikeInterface {
    const client = new google.auth.OAuth2(config.clientId, config.clientSecret);

    client.setCredentials({
      refresh_token: config.refreshToken,
    });

    return client;
  }
}
