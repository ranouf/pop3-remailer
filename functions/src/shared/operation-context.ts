import { randomUUID } from 'node:crypto';

export interface Clock {
  now(): Date;
}

export interface OperationContext {
  readonly executionTime: string;
  readonly jobId: string;
  readonly startedAt: Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export const createJobId = (clock: Clock = systemClock): string => {
  const timestamp = clock
    .now()
    .toISOString()
    .replaceAll(':', '')
    .replaceAll('.', '')
    .replace('T', '-')
    .replace('Z', 'Z');

  return `job-${timestamp}-${randomUUID()}`;
};

export const createOperationContext = (
  clock: Clock = systemClock,
): OperationContext => {
  const startedAt = clock.now();

  return {
    executionTime: startedAt.toISOString(),
    jobId: createJobId({
      now: () => startedAt,
    }),
    startedAt,
  };
};

export const calculateDurationMs = (
  startedAt: Date,
  finishedAt: Date,
): number => Math.max(0, finishedAt.getTime() - startedAt.getTime());
