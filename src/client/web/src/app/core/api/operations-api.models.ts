export interface JobRunStatisticsResponse {
  readonly apiVersion: string;
  readonly dailyPoints: readonly JobRunStatisticsDailyPointResponse[];
  readonly generatedAt: string;
  readonly kpis: JobRunStatisticsKpisResponse;
  readonly recentErrors: readonly RunSummaryResponse[];
  readonly recentRuns: readonly RunSummaryResponse[];
}

export interface JobRunStatisticsDailyPointResponse {
  readonly averageDurationMs: number | null;
  readonly date: string;
  readonly detectedCount: number;
  readonly failedCount: number;
  readonly runCount: number;
  readonly transferredCount: number;
}

export interface JobRunStatisticsKpisResponse {
  readonly detectedLast24h: number;
  readonly failedLast24h: number;
  readonly lastError: RunSummaryResponse | null;
  readonly lastRun: RunSummaryResponse | null;
  readonly lastSuccess: RunSummaryResponse | null;
  readonly transferredLast24h: number;
}

export interface RunSummaryResponse {
  readonly detectedCount: number;
  readonly durationMs?: number;
  readonly failedCount: number;
  readonly finishedAt?: string;
  readonly jobId: string;
  readonly processedCount: number;
  readonly provider: string;
  readonly skippedCount: number;
  readonly sourceAccountId: string;
  readonly startedAt: string;
  readonly status: string;
  readonly transferredCount: number;
}

export interface HealthCheckReportResponse {
  readonly apiVersion: string;
  readonly checkedAt: string;
  readonly checks: readonly HealthCheckResultResponse[];
  readonly overallStatus: string;
}

export interface HealthCheckResultResponse {
  readonly checkedAt: string;
  readonly message: string;
  readonly name: string;
  readonly status: string;
}
