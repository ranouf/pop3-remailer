import {
  HealthCheckName,
  HealthCheckStatus,
} from '../../../../src/core/health-check/models';
import { TransferJobError } from '../../../../src/core/operation-error';
import { GmailConnectivityHealthChecker } from '../../../../src/infrastructure/email/gmail/healthchecks/gmail-health-checker';
import type { GmailApiClientFactoryInterface } from '../../../../src/infrastructure/email/gmail/client/gmail-api-client-factory.interface';
import type { GmailApiClientInterface } from '../../../../src/infrastructure/email/gmail/client/gmail-api-client.interface';
import type { GmailOAuthProviderInterface } from '../../../../src/infrastructure/email/gmail/oauth/gmail-oauth-provider.interface';
import type { OAuth2ClientLikeInterface } from '../../../../src/infrastructure/email/gmail/oauth/oauth2-client-like.interface';
import type { GmailProfileResponse } from '../../../../src/infrastructure/email/gmail/models';

class FakeOAuthProvider implements GmailOAuthProviderInterface {
  public createClient(): OAuth2ClientLikeInterface {
    return {
      credentials: {},
      setCredentials(): void {},
    };
  }
}

class FakeGmailApiClient implements GmailApiClientInterface {
  public profileError: Error | null = null;
  public profileResponse: GmailProfileResponse = {
    data: {
      emailAddress: 'cedric@carnould.com',
    },
  };

  public readonly users = {
    getProfile: (): Promise<GmailProfileResponse> => {
      if (this.profileError !== null) {
        return Promise.reject(this.profileError);
      }

      return Promise.resolve(this.profileResponse);
    },
    messages: {
      import: () => Promise.resolve({ data: {} }),
      list: () => Promise.resolve({ data: {} }),
    },
  };
}

class FakeGmailApiClientFactory implements GmailApiClientFactoryInterface {
  public readonly client = new FakeGmailApiClient();

  public create(): GmailApiClientInterface {
    return this.client;
  }
}

describe('infrastructure/gmail/gmail-health-checker', () => {
  it('returns a healthy status when Gmail profile lookup succeeds', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    const checker = new GmailConnectivityHealthChecker(
      {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        maxImportRetries: 1,
        refreshToken: 'refresh-token',
        timeoutMs: 15000,
        userEmail: 'cedric@carnould.com',
      },
      {
        apiClientFactory,
        clock: {
          now: () => new Date('2026-04-02T10:00:00.000Z'),
        },
        oauthProvider: new FakeOAuthProvider(),
      },
    );

    await expect(checker.check()).resolves.toEqual({
      checkedAt: new Date('2026-04-02T10:00:00.000Z'),
      message: 'Gmail OAuth credentials are valid for cedric@carnould.com.',
      name: HealthCheckName.Gmail,
      status: HealthCheckStatus.Healthy,
    });
  });

  it('fails when Gmail authenticates a different mailbox', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    apiClientFactory.client.profileResponse = {
      data: {
        emailAddress: 'other@example.com',
      },
    };
    const checker = new GmailConnectivityHealthChecker(
      {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        maxImportRetries: 1,
        refreshToken: 'refresh-token',
        timeoutMs: 15000,
        userEmail: 'cedric@carnould.com',
      },
      {
        apiClientFactory,
        oauthProvider: new FakeOAuthProvider(),
      },
    );

    const error = await checker
      .check()
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.code).toBe('GMAIL_HEALTHCHECK_FAILED');
    expect(error.details).toMatchObject({
      authenticatedEmail: 'other@example.com',
      configuredEmail: 'cedric@carnould.com',
    });
  });

  it('fails when Gmail returns no email address in the profile response', async () => {
    const apiClientFactory = new FakeGmailApiClientFactory();
    apiClientFactory.client.profileResponse = {
      data: {},
    };
    const checker = new GmailConnectivityHealthChecker(
      {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        maxImportRetries: 1,
        refreshToken: 'refresh-token',
        timeoutMs: 15000,
        userEmail: 'cedric@carnould.com',
      },
      {
        apiClientFactory,
        oauthProvider: new FakeOAuthProvider(),
      },
    );

    const error = await checker
      .check()
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.code).toBe('GMAIL_HEALTHCHECK_FAILED');
    expect(error.details).toMatchObject({
      gmailUserEmail: 'cedric@carnould.com',
      scope: 'https://www.googleapis.com/auth/gmail.insert',
    });
  });
});
