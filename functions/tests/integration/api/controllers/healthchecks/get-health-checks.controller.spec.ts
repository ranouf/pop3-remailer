import { describe, expect, it } from 'vitest';

import { FakeApiAuthTokenVerifier } from '../../auth/fake-api-auth-token-verifier';
import { ApiHttpHelper } from '../../helpers/api-http.helper';
import { GetHealthChecksControllerTest } from './get-health-checks.controller.test';

describe('integration/api/controllers/healthchecks/get-health-checks.controller', () => {
  it('returns the health checks payload through the API endpoint', async () => {
    const test = new GetHealthChecksControllerTest();

    const response = await ApiHttpHelper.authenticatedGet(
      test.factory.client,
      '/healthcheck',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      checkedAt: '2026-04-07T12:00:00.000Z',
      checks: [
        {
          checkedAt: '2026-04-07T12:00:00.000Z',
          message: 'POP3 connection and authentication succeeded.',
          name: 'pop3',
          status: 'healthy',
        },
        {
          checkedAt: '2026-04-07T12:00:00.000Z',
          message:
            'Gmail OAuth credentials are valid for destination@gmail.com.',
          name: 'gmail',
          status: 'healthy',
        },
        {
          checkedAt: '2026-04-07T12:00:00.000Z',
          message: 'Firestore read/write connectivity succeeded.',
          name: 'firestore',
          status: 'healthy',
        },
        {
          checkedAt: '2026-04-07T12:00:00.000Z',
          message: 'Amplitude accepted the healthcheck event.',
          name: 'amplitude',
          status: 'healthy',
        },
      ],
      overallStatus: 'healthy',
    });
    expect(test.factory.authTokenVerifier).toBeInstanceOf(
      FakeApiAuthTokenVerifier,
    );
    expect(
      (test.factory.authTokenVerifier as FakeApiAuthTokenVerifier).tokens,
    ).toEqual(['integration-token']);
  });

  it('returns unauthorized when the bearer token is missing', async () => {
    const test = new GetHealthChecksControllerTest();

    const response = await test.factory.client.get('/healthcheck');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
    });
  });

  it('returns forbidden when token verification fails', async () => {
    const test = new GetHealthChecksControllerTest({
      authTokenVerifier: new FakeApiAuthTokenVerifier(true),
    });

    const response = await ApiHttpHelper.authenticatedGet(
      test.factory.client,
      '/healthcheck',
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
    });
  });

  it('returns forbidden when the authenticated Firebase email is not authorized', async () => {
    const test = new GetHealthChecksControllerTest({
      authTokenVerifier: new FakeApiAuthTokenVerifier(
        false,
        'cedric@carnould.com',
      ),
    });

    const response = await ApiHttpHelper.authenticatedGet(
      test.factory.client,
      '/healthcheck',
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
    });
  });
});
