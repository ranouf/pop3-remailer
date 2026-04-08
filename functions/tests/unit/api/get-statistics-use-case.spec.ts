import { describe, expect, it } from 'vitest';

import {
  JobRunEntity,
  JobRunStatus,
  type JobRunRepository,
} from '../../../src/core/job-run';
import { JobRunStatisticsManager } from '../../../src/core/job-run-statistics';
import { SourceProvider } from '../../../src/jobs/email-transfer/models/source-account';

class FakeJobRunRepository implements JobRunRepository {
  public listBySourceAccount(): Promise<readonly JobRunEntity[]> {
    return Promise.resolve([
      new JobRunEntity({
        detectedCount: 3,
        failedCount: 1,
        finishedAt: new Date('2026-04-07T09:10:00.000Z'),
        jobId: 'job-1',
        processedCount: 3,
        provider: SourceProvider.Orange,
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: new Date('2026-04-07T09:00:00.000Z'),
        status: JobRunStatus.Completed,
        transferredCount: 2,
      }),
    ]);
  }

  public saveFinished(): Promise<void> {
    return Promise.resolve();
  }

  public saveStarted(): Promise<void> {
    return Promise.resolve();
  }
}

describe('unit/api/get-statistics-use-case', () => {
  it('aggregates recent KPIs from job runs', async () => {
    const manager = new JobRunStatisticsManager(
      new FakeJobRunRepository(),
      'orange:source@orange.fr',
      {
        now: () => new Date('2026-04-07T12:00:00.000Z'),
      },
    );

    const statistics = await manager.getStatistics();

    expect(statistics.kpis.detectedLast24h).toBe(3);
    expect(statistics.kpis.transferredLast24h).toBe(2);
    expect(statistics.kpis.failedLast24h).toBe(1);
    expect(statistics.recentRuns).toHaveLength(1);
  });
});
