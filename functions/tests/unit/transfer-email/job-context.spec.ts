import { describe, expect, it } from 'vitest';

import { JobContext } from '../../../src/jobs/email-transfer/models/job-context';

describe('unit/transfer-email/job-context', () => {
  it('creates a context from the provided clock', () => {
    const startedAt = new Date('2026-04-07T12:00:00.000Z');
    const context = JobContext.create({
      now: () => startedAt,
    });

    expect(context.startedAt).toEqual(startedAt);
    expect(context.executionTime).toBe('2026-04-07T12:00:00.000Z');
    expect(context.jobId).toContain('job-2026-04-07-120000000Z-');
  });
});
