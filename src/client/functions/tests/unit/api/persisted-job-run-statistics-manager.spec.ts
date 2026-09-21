import { describe, expect, it } from 'vitest';

import {
  PersistedJobRunStatisticsManager,
  type JobRunStatisticsEntity,
  type JobRunStatisticsManagerInterface,
  type JobRunStatisticsRepositoryInterface,
} from '../../../src/core/job-run-statistics';

class FakeJobRunStatisticsRepository implements JobRunStatisticsRepositoryInterface {
  public statistics: JobRunStatisticsEntity | null = null;

  public get(): Promise<JobRunStatisticsEntity | null> {
    return Promise.resolve(this.statistics);
  }

  public save(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeFallbackManager implements JobRunStatisticsManagerInterface {
  public constructor(private readonly statistics: JobRunStatisticsEntity) {}

  public getStatistics(): Promise<JobRunStatisticsEntity> {
    return Promise.resolve(this.statistics);
  }
}

const storedStatistics: JobRunStatisticsEntity = {
  sourceAccountId: 'orange:source@orange.fr',
  dailyPoints: [],
  generatedAt: new Date('2026-04-07T12:00:00.000Z'),
  kpis: {
    detectedLast24h: 1,
    failedLast24h: 0,
    lastError: null,
    lastRun: null,
    lastSuccess: null,
    transferredLast24h: 1,
  },
  recentErrors: [],
  recentRuns: [],
};

describe('unit/api/persisted-job-run-statistics-manager', () => {
  it('returns the persisted projection when it exists', async () => {
    const repository = new FakeJobRunStatisticsRepository();
    repository.statistics = storedStatistics;
    const manager = new PersistedJobRunStatisticsManager(
      'orange:source@orange.fr',
      repository,
      new FakeFallbackManager({
        ...storedStatistics,
        kpis: {
          ...storedStatistics.kpis,
          detectedLast24h: 999,
        },
      }),
    );

    const statistics = await manager.getStatistics();

    expect(statistics).toBe(storedStatistics);
  });

  it('falls back to the calculated statistics when the projection is missing', async () => {
    const fallbackStatistics = {
      ...storedStatistics,
      kpis: {
        ...storedStatistics.kpis,
        detectedLast24h: 5,
      },
    };
    const manager = new PersistedJobRunStatisticsManager(
      'orange:source@orange.fr',
      new FakeJobRunStatisticsRepository(),
      new FakeFallbackManager(fallbackStatistics),
    );

    const statistics = await manager.getStatistics();

    expect(statistics).toEqual(fallbackStatistics);
  });
});
