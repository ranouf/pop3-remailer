import { randomUUID } from 'node:crypto';

import type { Clock } from '../../../core/time/clock.interface';

export class JobContext {
  public readonly executionTime: string;
  public readonly jobId: string;
  public readonly startedAt: Date;

  public constructor(executionTime: string, jobId: string, startedAt: Date) {
    this.executionTime = executionTime;
    this.jobId = jobId;
    this.startedAt = startedAt;
  }

  public static create(clock: Clock): JobContext {
    const startedAt = clock.now();

    return new JobContext(
      startedAt.toISOString(),
      JobContext.createJobId({
        now: () => startedAt,
      }),
      startedAt,
    );
  }

  private static createJobId(clock: Clock): string {
    const timestamp = clock
      .now()
      .toISOString()
      .replaceAll(':', '')
      .replaceAll('.', '')
      .replace('T', '-')
      .replace('Z', 'Z');

    return `job-${timestamp}-${randomUUID()}`;
  }
}
