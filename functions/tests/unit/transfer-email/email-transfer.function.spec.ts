import { describe, expect, it, vi } from 'vitest';

import { EmailTransferFunction } from '../../../src/jobs/email-transfer/email-transfer.function';

describe('unit/transfer-email/email-transfer.function', () => {
  it('uses the provided job double when one is supplied', async () => {
    const job = {
      run: vi.fn().mockResolvedValue({
        summary: {
          jobId: 'job-1',
        },
      }),
    };

    const result = await new EmailTransferFunction({
      job,
    }).run();

    expect(job.run).toHaveBeenCalledOnce();
    expect(result.summary.jobId).toBe('job-1');
  });
});
