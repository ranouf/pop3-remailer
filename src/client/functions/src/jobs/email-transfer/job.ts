import type { Clock } from '../../core/time/clock.interface';
import { SystemClock } from '../../infrastructure/time/system-clock';
import { JobContext } from './models/job-context';

export abstract class Job {
  protected readonly clock: Clock;

  protected constructor(clock: Clock = new SystemClock()) {
    this.clock = clock;
  }

  protected calculateDurationMs(startedAt: Date, finishedAt: Date): number {
    return Math.max(0, finishedAt.getTime() - startedAt.getTime());
  }

  protected createJobContext(): JobContext {
    return JobContext.create(this.clock);
  }
}
