import { TransferJobError } from '../../../src/core/operation-error';
import { JobRunEntity, JobRunStatus } from '../../../src/core/job-run';
import { SourceProvider } from '../../../src/jobs/email-transfer/models/source-account';

describe('domain/job-run', () => {
  it('exposes the supported job run statuses', () => {
    expect(Object.values(JobRunStatus)).toEqual([
      JobRunStatus.Running,
      JobRunStatus.Completed,
      JobRunStatus.CompletedWithFailures,
      JobRunStatus.Failed,
    ]);
  });

  it('creates a running job summary with zeroed counters', () => {
    expect(
      JobRunEntity.createStarted({
        jobId: 'job-1',
        provider: SourceProvider.Orange,
        sourceAccountId: 'orange:user@example.com',
        startedAt: new Date('2026-03-31T20:00:00.000Z'),
      }),
    ).toEqual({
      detectedCount: 0,
      failedCount: 0,
      jobId: 'job-1',
      processedCount: 0,
      provider: SourceProvider.Orange,
      skippedCount: 0,
      sourceAccountId: 'orange:user@example.com',
      startedAt: new Date('2026-03-31T20:00:00.000Z'),
      status: JobRunStatus.Running,
      transferredCount: 0,
    });
  });

  it('determines the right final job status from counters', () => {
    expect(
      JobRunEntity.determineStatus({
        detectedCount: 2,
        failedCount: 0,
        processedCount: 2,
        skippedCount: 1,
        transferredCount: 1,
      }),
    ).toBe(JobRunStatus.Completed);

    expect(
      JobRunEntity.determineStatus({
        detectedCount: 2,
        failedCount: 1,
        processedCount: 2,
        skippedCount: 1,
        transferredCount: 0,
      }),
    ).toBe(JobRunStatus.CompletedWithFailures);

    expect(
      JobRunEntity.determineStatus({
        detectedCount: 2,
        failedCount: 2,
        processedCount: 2,
        skippedCount: 0,
        transferredCount: 0,
      }),
    ).toBe(JobRunStatus.Failed);
  });

  it('rejects invalid negative counters', () => {
    expect(() =>
      JobRunEntity.determineStatus({
        detectedCount: 0,
        failedCount: -1,
        processedCount: 0,
        skippedCount: 0,
        transferredCount: 0,
      }),
    ).toThrowError(TransferJobError);
  });

  it('finalizes a job summary and computes duration', () => {
    const summary = JobRunEntity.createStarted({
      jobId: 'job-2',
      provider: SourceProvider.Wanadoo,
      sourceAccountId: 'wanadoo:user@example.com',
      startedAt: new Date('2026-03-31T20:00:00.000Z'),
    });

    expect(
      summary.finalize(
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
      provider: SourceProvider.Wanadoo,
      skippedCount: 1,
      sourceAccountId: 'wanadoo:user@example.com',
      startedAt: new Date('2026-03-31T20:00:00.000Z'),
      status: JobRunStatus.CompletedWithFailures,
      transferredCount: 1,
    });
  });
});
