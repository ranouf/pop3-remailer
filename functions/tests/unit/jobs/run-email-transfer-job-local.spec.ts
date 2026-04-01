import { describe, expect, it, vi } from 'vitest';

describe('jobs/run-email-transfer-job-local', () => {
  it('exports a callable local runner function', async () => {
    const runJobSpy = vi.fn(() => Promise.resolve());

    vi.doMock('../../../src/jobs/run-email-transfer-job.helper', () => ({
      RunEmailTransferJobHelper: {
        run: runJobSpy,
      },
    }));

    const module = await import('../../../src/jobs/run-email-transfer-job-local');

    await module.runEmailTransferJobLocally();

    expect(runJobSpy).toHaveBeenCalledTimes(1);
  });
});
