import { google } from 'googleapis';

import type { ApplicationConfiguration } from '../../../../core/configuration/models/application-configuration';
import type { GmailOAuthProviderInterface } from './gmail-oauth-provider.interface';
import type { OAuth2ClientLikeInterface } from './oauth2-client-like.interface';

export class GoogleGmailOAuthProvider implements GmailOAuthProviderInterface {
  public createClient(
    config: ApplicationConfiguration['gmail'],
  ): OAuth2ClientLikeInterface {
    const client = new google.auth.OAuth2(config.clientId, config.clientSecret);

    client.setCredentials({
      refresh_token: config.refreshToken,
    });

    return client;
  }
}
