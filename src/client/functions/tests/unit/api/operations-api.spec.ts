import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthTokenVerifierInterface } from '../../../src/api/auth/auth-token-verifier.interface';
import type { HealthCheckReportDto } from '../../../src/api/controllers/healthchecks/dtos';
import type { JobRunStatisticsDto } from '../../../src/api/controllers/statistics/dtos/job-run-statistics.dto';
import { OperationsApi } from '../../../src/api/program';
import type { HealthCheckManagerInterface } from '../../../src/core/health-check/health-check-manager.interface';
import {
  HealthCheckName,
  HealthCheckReport,
  HealthCheckResult,
  HealthCheckStatus,
} from '../../../src/core/health-check/models';
import {
  JobRunStatisticsEntity,
  type JobRunStatisticsManagerInterface,
} from '../../../src/core/job-run-statistics';
import type { StructuredLogger } from '../../../src/core/logging/structured-logger.interface';
import { testApplicationConfiguration } from '../../integration/api/configuration/test-application-configuration';

class FakeAuthTokenVerifier implements AuthTokenVerifierInterface {
  public readonly tokens: string[] = [];

  public constructor(
    private readonly shouldReject = false,
    private readonly email = 'destination@gmail.com',
  ) {}

  public verifyIdToken(token: string): Promise<{
    readonly email: string;
    readonly uid: string;
  }> {
    this.tokens.push(token);

    if (this.shouldReject) {
      return Promise.reject(new Error('Invalid token'));
    }

    return Promise.resolve({
      email: this.email,
      uid: 'user-1',
    });
  }
}

class FakeStatisticsManager implements JobRunStatisticsManagerInterface {
  public getStatistics(): Promise<JobRunStatisticsEntity> {
    return Promise.resolve(
      new JobRunStatisticsEntity(
        'orange:source@orange.fr',
        [],
        new Date('2026-04-07T12:00:00.000Z'),
        {
          detectedLast24h: 1,
          failedLast24h: 0,
          lastError: null,
          lastRun: null,
          lastSuccess: null,
          transferredLast24h: 1,
        },
        [],
        [],
      ),
    );
  }
}

class FakeHealthCheckManager implements HealthCheckManagerInterface {
  public execute(): Promise<HealthCheckReport> {
    return Promise.resolve(
      new HealthCheckReport(new Date('2026-04-07T12:00:00.000Z'), [
        new HealthCheckResult({
          checkedAt: new Date('2026-04-07T12:00:00.000Z'),
          message: 'POP3 healthy',
          name: HealthCheckName.Pop3,
          status: HealthCheckStatus.Healthy,
        }),
      ]),
    );
  }
}

class FakeStructuredLogger implements StructuredLogger {
  public readonly errors: unknown[] = [];
  public readonly warnings: unknown[] = [];

  public debug(): void {}

  public error(message: string, metadata?: unknown): void {
    this.errors.push({ message, metadata });
  }

  public info(): void {}

  public warn(message: string, metadata?: unknown): void {
    this.warnings.push({ message, metadata });
  }
}

const createApi = (
  authTokenVerifier = new FakeAuthTokenVerifier(),
  logger = new FakeStructuredLogger(),
): {
  readonly api: OperationsApi;
  readonly authTokenVerifier: FakeAuthTokenVerifier;
  readonly logger: FakeStructuredLogger;
} => ({
  api: new OperationsApi(
    authTokenVerifier,
    testApplicationConfiguration,
    new FakeStatisticsManager(),
    new FakeHealthCheckManager(),
    logger,
  ),
  authTokenVerifier,
  logger,
});

type OpenApiResponseBody = {
  readonly info: {
    readonly title: string;
  };
  readonly servers: Array<{
    readonly url: string;
  }>;
};

describe('unit/api/program', () => {
  it('serves the statistics endpoint through the express application', async () => {
    const { api, authTokenVerifier } = createApi();

    const response = await request(api.createApplication())
      .get('/statistics')
      .set('authorization', 'Bearer token');
    const body = response.body as JobRunStatisticsDto;

    expect(response.status).toBe(200);
    expect(body.apiVersion).toBe('0.1.0');
    expect(body.kpis.detectedLast24h).toBe(1);
    expect(authTokenVerifier.tokens).toEqual(['token']);
  });

  it('normalizes the /api prefix before routing requests', async () => {
    const { api } = createApi();

    const response = await request(api.createApplication())
      .get('/api/healthcheck')
      .set('authorization', 'Bearer token');
    const body = response.body as HealthCheckReportDto;

    expect(response.status).toBe(200);
    expect(body.apiVersion).toBe('0.1.0');
    expect(body.overallStatus).toBe('healthy');
  });

  it('returns the OpenAPI document with the normalized server URL', async () => {
    const { api } = createApi();

    const response = await request(api.createApplication()).get(
      '/api/openapi.json',
    );
    const body = response.body as OpenApiResponseBody;

    expect(response.status).toBe(200);
    expect(body.info.title).toBe('POP3 Remailer Operations API');
    expect(body.servers).toEqual([{ url: '/api' }]);
  });

  it('returns unauthorized when the bearer token is missing', async () => {
    const { api } = createApi();

    const response = await request(api.createApplication()).get('/statistics');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
    });
  });

  it('returns forbidden and logs a warning when token verification fails', async () => {
    const authTokenVerifier = new FakeAuthTokenVerifier(true);
    const logger = new FakeStructuredLogger();
    const { api } = createApi(authTokenVerifier, logger);

    const response = await request(api.createApplication())
      .get('/statistics')
      .set('authorization', 'Bearer token');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
    });
    expect(logger.warnings).toEqual([
      {
        message: 'Operations API request rejected.',
        metadata: {
          error: 'Forbidden',
          path: '/statistics',
        },
      },
    ]);
  });

  it('returns a not found payload for unknown routes', async () => {
    const { api } = createApi();

    const response = await request(api.createApplication()).get('/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Not Found',
    });
  });
});
