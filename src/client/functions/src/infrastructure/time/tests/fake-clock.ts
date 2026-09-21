import type { Clock } from '../../../core/time/clock.interface';

export class FakeClock implements Clock {
  private readonly dates: readonly Date[];
  private index = 0;

  public constructor(...dates: readonly Date[]) {
    this.dates = dates;
  }

  public now(): Date {
    return (
      this.dates[Math.min(this.index++, this.dates.length - 1)] ?? new Date()
    );
  }
}
