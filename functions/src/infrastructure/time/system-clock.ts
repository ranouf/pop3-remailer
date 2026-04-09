import type { Clock } from '../../core/time/clock.interface';

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
