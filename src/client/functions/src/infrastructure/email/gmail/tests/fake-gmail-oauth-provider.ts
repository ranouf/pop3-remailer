import type { GmailOAuthProviderInterface } from '../oauth/gmail-oauth-provider.interface';
import type { OAuth2ClientLikeInterface } from '../oauth/oauth2-client-like.interface';

export class FakeGmailOAuthProvider implements GmailOAuthProviderInterface {
  public readonly clients: FakeOAuth2ClientLike[] = [];

  public createClient(): OAuth2ClientLikeInterface {
    const client = new FakeOAuth2ClientLike();

    this.clients.push(client);

    return client;
  }
}

class FakeOAuth2ClientLike implements OAuth2ClientLikeInterface {
  public credentials: {
    readonly refresh_token?: string | null;
  } = {};

  public setCredentials(credentials: { readonly refresh_token: string }): void {
    this.credentials = {
      refresh_token: credentials.refresh_token,
    };
  }
}
