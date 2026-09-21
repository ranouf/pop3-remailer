import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthTokenVerifierInterface } from '../../../../src/api/auth/auth-token-verifier.interface';
import { ApiModule } from '../../../../src/api/api.module';
import type { JobRunStatisticsDto } from '../../../../src/api/controllers/statistics/dtos/job-run-statistics.dto';
import { type OperationsApi } from '../../../../src/api/program';
import { FakeAmplitudeNodeClient } from '../../../../src/infrastructure/analytics/tests/fake-amplitude-node-client';
import { FakeGmailApiClientFactory } from '../../../../src/infrastructure/email/gmail/tests/fake-gmail-api-client-factory';
import { FakeGmailOAuthProvider } from '../../../../src/infrastructure/email/gmail/tests/fake-gmail-oauth-provider';
import { FakePop3CommandFactory } from '../../../../src/infrastructure/email/node-pop3/tests/fake-pop3-command-factory';
import { InMemoryFirestoreDatabase } from '../../../../src/infrastructure/firestore/tests/in-memory-firestore-database';
import { FakeStructuredLogger } from '../../../../src/infrastructure/logging/tests/fake-structured-logger';
import { FakeClock } from '../../../../src/infrastructure/time/tests/fake-clock';
import { ApiTestModule } from './api-test.module';
import { testApplicationConfiguration } from '../configuration/test-application-configuration';

class FakeAuthTokenVerifier implements AuthTokenVerifierInterface {
  public verifyIdToken(): Promise<{
    readonly email: string;
    readonly uid: string;
  }> {
    return Promise.resolve({
      email: 'destination@gmail.com',
      uid: 'user-1',
    });
  }
}

describe('tests/api/bootstrap/api-test.module', () => {
  it('resolves OperationsApi with overridden services', async () => {
    const container = ApiTestModule.createContainer({
      amplitudeNodeClient: new FakeAmplitudeNodeClient(),
      authTokenVerifier: new FakeAuthTokenVerifier(),
      clock: new FakeClock(new Date('2026-04-07T12:00:00.000Z')),
      config: testApplicationConfiguration,
      firestoreDatabase: new InMemoryFirestoreDatabase(),
      gmailApiClientFactory: new FakeGmailApiClientFactory(),
      gmailOAuthProvider: new FakeGmailOAuthProvider(),
      pop3CommandFactory: new FakePop3CommandFactory(),
      structuredLogger: new FakeStructuredLogger(),
    });

    const api = container.get<OperationsApi>(ApiModule.OperationsApi);
    const response = await request(api.createApplication())
      .get('/statistics')
      .set('authorization', 'Bearer token');
    const body = response.body as JobRunStatisticsDto;

    expect(response.status).toBe(200);
    expect(body.kpis).toEqual({
      detectedLast24h: 0,
      failedLast24h: 0,
      lastError: null,
      lastRun: null,
      lastSuccess: null,
      transferredLast24h: 0,
    });
  });
});
