export class JobRunStatisticsDailyAccumulator {
  private durationCount = 0;
  private durationTotalMs = 0;
  private readonly point: {
    averageDurationMs: number | null;
    readonly date: Date;
    detectedCount: number;
    failedCount: number;
    runCount: number;
    transferredCount: number;
  };

  public constructor(date: Date) {
    this.point = {
      averageDurationMs: null,
      date,
      detectedCount: 0,
      failedCount: 0,
      runCount: 0,
      transferredCount: 0,
    };
  }

  public addRun(run: {
    readonly detectedCount: number;
    readonly durationMs?: number;
    readonly failedCount: number;
    readonly transferredCount: number;
  }): void {
    this.point.detectedCount += run.detectedCount;
    this.point.failedCount += run.failedCount;
    this.point.runCount += 1;
    this.point.transferredCount += run.transferredCount;

    if (run.durationMs === undefined) {
      return;
    }

    this.durationCount += 1;
    this.durationTotalMs += run.durationMs;
    this.point.averageDurationMs = Math.round(
      this.durationTotalMs / this.durationCount,
    );
  }

  public toDailyPoint() {
    return this.point;
  }
}
