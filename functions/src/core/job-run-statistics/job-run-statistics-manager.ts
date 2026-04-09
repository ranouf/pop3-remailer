import {
  JobRunStatus,
  type JobRunEntity,
  type JobRunRepository,
} from '../job-run';
import type { Clock } from '../time/clock.interface';
import { SystemClock } from '../../infrastructure/time/system-clock';
import { JobRunStatisticsEntity } from './entities/job-run-statistics.entity';
import { JobRunStatisticsDailyAccumulator } from './job-run-statistics-daily-accumulator';
import type { JobRunStatisticsManagerInterface } from './job-run-statistics-manager.interface';

export class JobRunStatisticsManager implements JobRunStatisticsManagerInterface {
  private static readonly last24HoursWindowMs = 24 * 60 * 60 * 1000;
  private static readonly recentDaysCount = 14;
  private static readonly recentErrorsLimit = 10;
  private static readonly recentRunsLimit = 10;

  public constructor(
    private readonly jobRunRepository: JobRunRepository,
    private readonly sourceAccountId: string,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  public async getStatistics(): Promise<JobRunStatisticsEntity> {
    const generatedAt = this.clock.now();
    const jobRuns = await this.jobRunRepository.listBySourceAccount(
      this.sourceAccountId,
    );
    const sortedJobRuns = [...jobRuns].sort(
      (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
    );
    const recentRuns = sortedJobRuns
      .slice(0, JobRunStatisticsManager.recentRunsLimit)
      .map((jobRun) => JobRunStatisticsEntity.createRunSummary(jobRun));
    const recentErrors = sortedJobRuns
      .filter((jobRun) => this.isErroredRun(jobRun))
      .slice(0, JobRunStatisticsManager.recentErrorsLimit)
      .map((jobRun) => JobRunStatisticsEntity.createRunSummary(jobRun));
    const last24HoursCutoff = new Date(
      generatedAt.getTime() - JobRunStatisticsManager.last24HoursWindowMs,
    );
    const last24HoursRuns = sortedJobRuns.filter(
      (jobRun) => jobRun.startedAt.getTime() >= last24HoursCutoff.getTime(),
    );

    return new JobRunStatisticsEntity(
      this.sourceAccountId,
      this.buildDailyPoints(sortedJobRuns, generatedAt),
      generatedAt,
      {
        detectedLast24h: this.sumCounts(last24HoursRuns, 'detectedCount'),
        failedLast24h: this.sumCounts(last24HoursRuns, 'failedCount'),
        lastError: this.findLastError(sortedJobRuns),
        lastRun: recentRuns[0] ?? null,
        lastSuccess: this.findLastSuccess(sortedJobRuns),
        transferredLast24h: this.sumCounts(last24HoursRuns, 'transferredCount'),
      },
      recentErrors,
      recentRuns,
    );
  }

  private buildDailyPoints(
    jobRuns: readonly JobRunEntity[],
    now: Date,
  ): JobRunStatisticsEntity['dailyPoints'] {
    const pointsByDate = new Map<string, JobRunStatisticsDailyAccumulator>();

    for (
      let offset = JobRunStatisticsManager.recentDaysCount - 1;
      offset >= 0;
      offset -= 1
    ) {
      const pointDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - offset,
        ),
      );
      const dateKey = pointDate.toISOString().slice(0, 10);

      pointsByDate.set(
        dateKey,
        new JobRunStatisticsDailyAccumulator(pointDate),
      );
    }

    for (const jobRun of jobRuns) {
      const dateKey = jobRun.startedAt.toISOString().slice(0, 10);
      const currentPoint = pointsByDate.get(dateKey);

      if (currentPoint === undefined) {
        continue;
      }

      currentPoint.addRun({
        detectedCount: jobRun.detectedCount,
        ...(jobRun.durationMs === undefined
          ? {}
          : {
              durationMs: jobRun.durationMs,
            }),
        failedCount: jobRun.failedCount,
        transferredCount: jobRun.transferredCount,
      });
    }

    return [...pointsByDate.values()].map((point) => point.toDailyPoint());
  }

  private findLastError(
    jobRuns: readonly JobRunEntity[],
  ): JobRunStatisticsEntity['kpis']['lastError'] {
    const lastError = jobRuns.find((jobRun) => this.isErroredRun(jobRun));

    return lastError === undefined
      ? null
      : JobRunStatisticsEntity.createRunSummary(lastError);
  }

  private findLastSuccess(
    jobRuns: readonly JobRunEntity[],
  ): JobRunStatisticsEntity['kpis']['lastSuccess'] {
    const lastSuccess = jobRuns.find(
      (jobRun) => jobRun.status === JobRunStatus.Completed,
    );

    return lastSuccess === undefined
      ? null
      : JobRunStatisticsEntity.createRunSummary(lastSuccess);
  }

  private isErroredRun(jobRun: JobRunEntity): boolean {
    return jobRun.failedCount > 0 || jobRun.status === JobRunStatus.Failed;
  }

  private sumCounts(
    jobRuns: readonly JobRunEntity[],
    key: 'detectedCount' | 'failedCount' | 'transferredCount',
  ): number {
    return jobRuns.reduce((total, jobRun) => total + jobRun[key], 0);
  }
}
