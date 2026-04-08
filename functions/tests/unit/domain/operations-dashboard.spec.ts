import {
  HealthCheckName,
  HealthCheckReport,
  HealthCheckResult,
  HealthCheckStatus,
} from '../../../src/core/health-check/models';
import { SourceProvider } from '../../../src/jobs/email-transfer/models/source-account';
import { JobRunStatisticsEntity } from '../../../src/core/job-run-statistics';
import { JobRunStatus, JobRunEntity } from '../../../src/core/job-run';

const buildJobRunSummary = (
  overrides: Partial<Omit<JobRunEntity, 'finalize'>> = {},
): JobRunEntity =>
  new JobRunEntity({
    detectedCount: overrides.detectedCount ?? 2,
    ...(overrides.durationMs === undefined
      ? {}
      : {
          durationMs: overrides.durationMs,
        }),
    failedCount: overrides.failedCount ?? 0,
    ...(overrides.finishedAt === undefined
      ? {}
      : {
          finishedAt: overrides.finishedAt,
        }),
    jobId: overrides.jobId ?? 'job-1',
    processedCount: overrides.processedCount ?? 2,
    provider: overrides.provider ?? SourceProvider.Wanadoo,
    skippedCount: overrides.skippedCount ?? 0,
    sourceAccountId: overrides.sourceAccountId ?? 'wanadoo:cedric@wanadoo.fr',
    startedAt: overrides.startedAt ?? new Date('2026-04-02T10:00:00.000Z'),
    status: overrides.status ?? JobRunStatus.Completed,
    transferredCount: overrides.transferredCount ?? 2,
  });

describe('domain/operations', () => {
  it('prioritizes warning over healthy and error over warning', () => {
    expect(
      new HealthCheckReport(new Date('2026-04-02T10:00:00.000Z'), [
        new HealthCheckResult({
          checkedAt: new Date('2026-04-02T10:00:00.000Z'),
          message: 'POP3 OK',
          name: HealthCheckName.Pop3,
          status: HealthCheckStatus.Healthy,
        }),
        new HealthCheckResult({
          checkedAt: new Date('2026-04-02T10:00:00.000Z'),
          message: 'Amplitude warning',
          name: HealthCheckName.Amplitude,
          status: HealthCheckStatus.Warning,
        }),
      ]).overallStatus,
    ).toBe(HealthCheckStatus.Warning);

    expect(
      new HealthCheckReport(new Date('2026-04-02T10:00:00.000Z'), [
        new HealthCheckResult({
          checkedAt: new Date('2026-04-02T10:00:00.000Z'),
          message: 'Amplitude warning',
          name: HealthCheckName.Amplitude,
          status: HealthCheckStatus.Warning,
        }),
        new HealthCheckResult({
          checkedAt: new Date('2026-04-02T10:00:00.000Z'),
          message: 'Gmail failed',
          name: HealthCheckName.Gmail,
          status: HealthCheckStatus.Error,
        }),
      ]).overallStatus,
    ).toBe(HealthCheckStatus.Error);
  });

  it('omits optional fields when converting a job run summary', () => {
    expect(
      JobRunStatisticsEntity.createRunSummary(buildJobRunSummary()),
    ).toEqual({
      detectedCount: 2,
      failedCount: 0,
      jobId: 'job-1',
      processedCount: 2,
      provider: SourceProvider.Wanadoo,
      skippedCount: 0,
      sourceAccountId: 'wanadoo:cedric@wanadoo.fr',
      startedAt: new Date('2026-04-02T10:00:00.000Z'),
      status: JobRunStatus.Completed,
      transferredCount: 2,
    });
  });

  it('preserves optional fields when converting a job run summary', () => {
    expect(
      JobRunStatisticsEntity.createRunSummary(
        buildJobRunSummary({
          durationMs: 1450,
          failedCount: 1,
          finishedAt: new Date('2026-04-02T10:00:01.450Z'),
          status: JobRunStatus.CompletedWithFailures,
        }),
      ),
    ).toEqual({
      detectedCount: 2,
      durationMs: 1450,
      failedCount: 1,
      finishedAt: new Date('2026-04-02T10:00:01.450Z'),
      jobId: 'job-1',
      processedCount: 2,
      provider: SourceProvider.Wanadoo,
      skippedCount: 0,
      sourceAccountId: 'wanadoo:cedric@wanadoo.fr',
      startedAt: new Date('2026-04-02T10:00:00.000Z'),
      status: JobRunStatus.CompletedWithFailures,
      transferredCount: 2,
    });
  });
});
