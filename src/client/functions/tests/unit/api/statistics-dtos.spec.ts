import { describe, expect, it } from 'vitest';

import { JobRunStatisticsDto } from '../../../src/api/controllers/statistics/dtos/job-run-statistics.dto';
import { JobRunStatus } from '../../../src/core/job-run';
import { JobRunStatisticsEntity } from '../../../src/core/job-run-statistics';
import { SourceProvider } from '../../../src/jobs/email-transfer/models/source-account';

describe('unit/api/statistics-dtos', () => {
  it('maps a domain statistics model to its DTO', () => {
    const dto = JobRunStatisticsDto.fromDomain(
      new JobRunStatisticsEntity(
        'orange:source@orange.fr',
        [
          {
            averageDurationMs: 10,
            date: new Date('2026-04-07T00:00:00.000Z'),
            detectedCount: 2,
            failedCount: 1,
            runCount: 1,
            transferredCount: 1,
          },
        ],
        new Date('2026-04-07T12:00:00.000Z'),
        {
          detectedLast24h: 2,
          failedLast24h: 1,
          lastError: {
            detectedCount: 2,
            durationMs: 10,
            failedCount: 1,
            finishedAt: new Date('2026-04-07T12:00:00.000Z'),
            jobId: 'job-1',
            processedCount: 1,
            provider: SourceProvider.Orange,
            skippedCount: 0,
            sourceAccountId: 'orange:source@orange.fr',
            startedAt: new Date('2026-04-07T11:59:50.000Z'),
            status: JobRunStatus.Failed,
            transferredCount: 1,
          },
          lastRun: null,
          lastSuccess: null,
          transferredLast24h: 1,
        },
        [],
        [],
      ),
      {
        version: '0.1.0',
      },
    );

    expect(dto.apiVersion).toBe('0.1.0');
    expect(dto.kpis.detectedLast24h).toBe(2);
    expect(dto.dailyPoints).toHaveLength(1);
    expect(dto.dailyPoints[0]?.runCount).toBe(1);
  });
});
