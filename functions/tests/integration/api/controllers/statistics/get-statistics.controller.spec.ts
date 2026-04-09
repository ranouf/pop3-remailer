import { describe, expect, it } from 'vitest';

import type { JobRunStatisticsDto } from '../../../../../src/api/controllers/statistics/dtos/job-run-statistics.dto';
import { FakeApiAuthTokenVerifier } from '../../auth/fake-api-auth-token-verifier';
import { ApiHttpHelper } from '../../helpers/api-http.helper';
import { GetStatisticsControllerTest } from './get-statistics.controller.test';

describe('integration/api/controllers/statistics/get-statistics.controller', () => {
  it('returns the statistics payload through the API endpoint', async () => {
    const test = new GetStatisticsControllerTest();

    await test.initialize();

    const response = await ApiHttpHelper.authenticatedGet(
      test.factory.client,
      '/statistics',
    );
    const body = response.body as JobRunStatisticsDto;

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBe('2026-04-07T12:00:00.000Z');
    expect(body.kpis).toEqual({
      detectedLast24h: 4,
      failedLast24h: 1,
      lastError: {
        detectedCount: 2,
        durationMs: 2000,
        failedCount: 1,
        finishedAt: '2026-04-07T11:05:00.000Z',
        jobId: 'job-2',
        processedCount: 2,
        provider: 'orange',
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: '2026-04-07T11:00:00.000Z',
        status: 'failed',
        transferredCount: 1,
      },
      lastRun: {
        detectedCount: 2,
        durationMs: 2000,
        failedCount: 1,
        finishedAt: '2026-04-07T11:05:00.000Z',
        jobId: 'job-2',
        processedCount: 2,
        provider: 'orange',
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: '2026-04-07T11:00:00.000Z',
        status: 'failed',
        transferredCount: 1,
      },
      lastSuccess: {
        detectedCount: 2,
        durationMs: 1000,
        failedCount: 0,
        finishedAt: '2026-04-07T10:05:00.000Z',
        jobId: 'job-1',
        processedCount: 2,
        provider: 'orange',
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: '2026-04-07T10:00:00.000Z',
        status: 'completed',
        transferredCount: 2,
      },
      transferredLast24h: 3,
    });
    expect(body.recentErrors).toEqual([
      {
        detectedCount: 2,
        durationMs: 2000,
        failedCount: 1,
        finishedAt: '2026-04-07T11:05:00.000Z',
        jobId: 'job-2',
        processedCount: 2,
        provider: 'orange',
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: '2026-04-07T11:00:00.000Z',
        status: 'failed',
        transferredCount: 1,
      },
    ]);
    expect(body.recentRuns).toEqual([
      {
        detectedCount: 2,
        durationMs: 2000,
        failedCount: 1,
        finishedAt: '2026-04-07T11:05:00.000Z',
        jobId: 'job-2',
        processedCount: 2,
        provider: 'orange',
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: '2026-04-07T11:00:00.000Z',
        status: 'failed',
        transferredCount: 1,
      },
      {
        detectedCount: 2,
        durationMs: 1000,
        failedCount: 0,
        finishedAt: '2026-04-07T10:05:00.000Z',
        jobId: 'job-1',
        processedCount: 2,
        provider: 'orange',
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: '2026-04-07T10:00:00.000Z',
        status: 'completed',
        transferredCount: 2,
      },
    ]);
    expect(body.dailyPoints).toHaveLength(14);
    expect(body.dailyPoints).toContainEqual({
      averageDurationMs: 1500,
      date: '2026-04-07T00:00:00.000Z',
      detectedCount: 4,
      failedCount: 1,
      runCount: 2,
      transferredCount: 3,
    });
    expect(test.factory.authTokenVerifier).toBeInstanceOf(
      FakeApiAuthTokenVerifier,
    );
    expect(
      (test.factory.authTokenVerifier as FakeApiAuthTokenVerifier).tokens,
    ).toEqual(['integration-token']);
  });

  it('returns unauthorized when the bearer token is missing', async () => {
    const test = new GetStatisticsControllerTest();

    const response = await test.factory.client.get('/statistics');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
    });
  });

  it('returns forbidden when token verification fails', async () => {
    const test = new GetStatisticsControllerTest({
      authTokenVerifier: new FakeApiAuthTokenVerifier(true),
    });

    const response = await ApiHttpHelper.authenticatedGet(
      test.factory.client,
      '/statistics',
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
    });
  });

  it('returns forbidden when the authenticated Firebase email is not authorized', async () => {
    const test = new GetStatisticsControllerTest({
      authTokenVerifier: new FakeApiAuthTokenVerifier(
        false,
        'cedric@carnould.com',
      ),
    });

    const response = await ApiHttpHelper.authenticatedGet(
      test.factory.client,
      '/statistics',
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
    });
  });
});
