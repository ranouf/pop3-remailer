import {
  calculateDurationMs,
  createOperationContext,
} from '../../../src/shared/operation-context';

describe('shared/operation-context', () => {
  it('creates a deterministic operation context from the provided clock', () => {
    const fixedDate = new Date('2026-03-31T21:00:00.000Z');

    const context = createOperationContext({
      now: () => fixedDate,
    });

    expect(context.startedAt).toEqual(fixedDate);
    expect(context.executionTime).toBe('2026-03-31T21:00:00.000Z');
    expect(context.jobId).toMatch(/^job-2026-03-31-210000000Z-[0-9a-f-]{36}$/u);
  });

  it('computes a non-negative duration', () => {
    expect(
      calculateDurationMs(
        new Date('2026-03-31T21:00:00.000Z'),
        new Date('2026-03-31T21:05:30.000Z'),
      ),
    ).toBe(330000);

    expect(
      calculateDurationMs(
        new Date('2026-03-31T21:05:30.000Z'),
        new Date('2026-03-31T21:00:00.000Z'),
      ),
    ).toBe(0);
  });
});
