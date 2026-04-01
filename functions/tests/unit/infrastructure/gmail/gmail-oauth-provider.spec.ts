import {
  GoogleGmailOAuthProvider,
  gmailImportScope,
} from '../../../../src/infrastructure/gmail/gmail-oauth-provider';

describe('infrastructure/gmail/gmail-oauth-provider', () => {
  it('configures an OAuth2 client with the refresh token', () => {
    const provider = new GoogleGmailOAuthProvider();

    const client = provider.createClient({
      clientId: 'gmail-client-id',
      clientSecret: 'gmail-client-secret',
      maxImportRetries: 2,
      refreshToken: 'refresh-token',
      timeoutMs: 15000,
      userEmail: 'destination@gmail.com',
    });

    expect(client.credentials.refresh_token).toBe('refresh-token');
    expect(gmailImportScope).toBe(
      'https://www.googleapis.com/auth/gmail.insert',
    );
  });
});
