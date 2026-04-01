import { TransferJobError } from '../../../src/domain/errors';
import {
  createJobRunSummary,
  determineJobRunStatus,
  finalizeJobRunSummary,
  jobRunStatuses,
} from '../../../src/domain/job-run';

describe('domain/job-run', () => {
  it('exposes the supported job run statuses', () => {
    expect(jobRunStatuses).toEqual([
      'running',
      'completed',
      'completed_with_failures',
      'failed',
    ]);
  });

  it('creates a running job summary with zeroed counters', () => {
    expect(
      createJobRunSummary({
        jobId: 'job-1',
        provider: 'orange',
        sourceAccountId: 'orange:user@example.com',
        startedAt: new Date('2026-03-31T20:00:00.000Z'),
      }),
    ).toEqual({
      detectedCount: 0,
      failedCount: 0,
      jobId: 'job-1',
      processedCount: 0,
      provider: 'orange',
      skippedCount: 0,
      sourceAccountId: 'orange:user@example.com',
      startedAt: new Date('2026-03-31T20:00:00.000Z'),
      status: 'running',
      transferredCount: 0,
    });
  });

  it('determines the right final job status from counters', () => {
    expect(
      determineJobRunStatus({
        detectedCount: 2,
        failedCount: 0,
        processedCount: 2,
        skippedCount: 1,
        transferredCount: 1,
      }),
    ).toBe('completed');

    expect(
      determineJobRunStatus({
        detectedCount: 2,
        failedCount: 1,
        processedCount: 2,
        skippedCount: 1,
        transferredCount: 0,
      }),
    ).toBe('completed_with_failures');

    expect(
      determineJobRunStatus({
        detectedCount: 2,
        failedCount: 2,
        processedCount: 2,
        skippedCount: 0,
        transferredCount: 0,
      }),
    ).toBe('failed');
  });

  it('rejects invalid negative counters', () => {
    expect(() =>
      determineJobRunStatus({
        detectedCount: 0,
        failedCount: -1,
        processedCount: 0,
        skippedCount: 0,
        transferredCount: 0,
      }),
    ).toThrowError(TransferJobError);
  });

  it('finalizes a job summary and computes duration', () => {
    const summary = createJobRunSummary({
      jobId: 'job-2',
      provider: 'wanadoo',
      sourceAccountId: 'wanadoo:user@example.com',
      startedAt: new Date('2026-03-31T20:00:00.000Z'),
    });

    expect(
      finalizeJobRunSummary(
        summary,
        {
          detectedCount: 3,
          failedCount: 1,
          processedCount: 3,
          skippedCount: 1,
          transferredCount: 1,
        },
        new Date('2026-03-31T20:05:00.000Z'),
      ),
    ).toEqual({
      detectedCount: 3,
      durationMs: 300000,
      failedCount: 1,
      finishedAt: new Date('2026-03-31T20:05:00.000Z'),
      jobId: 'job-2',
      processedCount: 3,
      provider: 'wanadoo',
      skippedCount: 1,
      sourceAccountId: 'wanadoo:user@example.com',
      startedAt: new Date('2026-03-31T20:00:00.000Z'),
      status: 'completed_with_failures',
      transferredCount: 1,
    });
  });
});
