import type { JobRunEntity, JobRunStatus } from '../../job-run';

export class JobRunStatisticsEntity {
  public constructor(
    public readonly sourceAccountId: string,
    public readonly dailyPoints: readonly {
      readonly averageDurationMs: number | null;
      readonly date: Date;
      readonly detectedCount: number;
      readonly failedCount: number;
      readonly runCount: number;
      readonly transferredCount: number;
    }[],
    public readonly generatedAt: Date,
    public readonly kpis: {
      readonly detectedLast24h: number;
      readonly failedLast24h: number;
      readonly lastError: {
        readonly detectedCount: number;
        readonly durationMs?: number;
        readonly failedCount: number;
        readonly finishedAt?: Date;
        readonly jobId: string;
        readonly processedCount: number;
        readonly provider: JobRunEntity['provider'];
        readonly skippedCount: number;
        readonly sourceAccountId: string;
        readonly startedAt: Date;
        readonly status: JobRunStatus;
        readonly transferredCount: number;
      } | null;
      readonly lastRun: {
        readonly detectedCount: number;
        readonly durationMs?: number;
        readonly failedCount: number;
        readonly finishedAt?: Date;
        readonly jobId: string;
        readonly processedCount: number;
        readonly provider: JobRunEntity['provider'];
        readonly skippedCount: number;
        readonly sourceAccountId: string;
        readonly startedAt: Date;
        readonly status: JobRunStatus;
        readonly transferredCount: number;
      } | null;
      readonly lastSuccess: {
        readonly detectedCount: number;
        readonly durationMs?: number;
        readonly failedCount: number;
        readonly finishedAt?: Date;
        readonly jobId: string;
        readonly processedCount: number;
        readonly provider: JobRunEntity['provider'];
        readonly skippedCount: number;
        readonly sourceAccountId: string;
        readonly startedAt: Date;
        readonly status: JobRunStatus;
        readonly transferredCount: number;
      } | null;
      readonly transferredLast24h: number;
    },
    public readonly recentErrors: readonly {
      readonly detectedCount: number;
      readonly durationMs?: number;
      readonly failedCount: number;
      readonly finishedAt?: Date;
      readonly jobId: string;
      readonly processedCount: number;
      readonly provider: JobRunEntity['provider'];
      readonly skippedCount: number;
      readonly sourceAccountId: string;
      readonly startedAt: Date;
      readonly status: JobRunStatus;
      readonly transferredCount: number;
    }[],
    public readonly recentRuns: readonly {
      readonly detectedCount: number;
      readonly durationMs?: number;
      readonly failedCount: number;
      readonly finishedAt?: Date;
      readonly jobId: string;
      readonly processedCount: number;
      readonly provider: JobRunEntity['provider'];
      readonly skippedCount: number;
      readonly sourceAccountId: string;
      readonly startedAt: Date;
      readonly status: JobRunStatus;
      readonly transferredCount: number;
    }[],
  ) {}

  public static createRunSummary(
    jobRun: JobRunEntity,
  ): JobRunStatisticsEntity['recentRuns'][number] {
    return {
      detectedCount: jobRun.detectedCount,
      ...(jobRun.durationMs === undefined
        ? {}
        : {
            durationMs: jobRun.durationMs,
          }),
      failedCount: jobRun.failedCount,
      ...(jobRun.finishedAt === undefined
        ? {}
        : {
            finishedAt: jobRun.finishedAt,
          }),
      jobId: jobRun.jobId,
      processedCount: jobRun.processedCount,
      provider: jobRun.provider,
      skippedCount: jobRun.skippedCount,
      sourceAccountId: jobRun.sourceAccountId,
      startedAt: jobRun.startedAt,
      status: jobRun.status,
      transferredCount: jobRun.transferredCount,
    };
  }
}
