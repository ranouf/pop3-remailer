import { describe, expect, it, vi } from 'vitest';

import type { EmailTransferJobResult } from '../../../src/application/models/email-transfer-job-result';
import { ScheduledEmailTransferJobHelper } from '../../../src/jobs/email-transfer-scheduled-job.helper';

describe('jobs/email-transfer-scheduled-job.helper', () => {
  it('creates a handler that runs the transfer job', async () => {
    const jobResult: EmailTransferJobResult = {
      summary: {
        detectedCount: 0,
        failedCount: 0,
        jobId: 'job-1',
        processedCount: 0,
        provider: 'orange',
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: new Date('2026-04-01T00:00:00.000Z'),
        status: 'completed',
        transferredCount: 0,
      },
    };
    const runJob = vi.fn(() => Promise.resolve(jobResult));
    const handler = ScheduledEmailTransferJobHelper.createHandler({
      runJob,
    });

    await handler();

    expect(runJob).toHaveBeenCalledTimes(1);
  });

  it('creates a Firebase scheduled function wrapper', () => {
    const jobResult: EmailTransferJobResult = {
      summary: {
        detectedCount: 0,
        failedCount: 0,
        jobId: 'job-1',
        processedCount: 0,
        provider: 'orange',
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: new Date('2026-04-01T00:00:00.000Z'),
        status: 'completed',
        transferredCount: 0,
      },
    };
    const scheduledFunction = ScheduledEmailTransferJobHelper.createFunction({
      runJob: vi.fn(() => Promise.resolve(jobResult)),
    });

    expect(scheduledFunction).toBeTypeOf('function');
  });
});
