import { describe, expect, it, vi } from 'vitest';

import { ConfigurationManager } from '../../../src/core/configuration/configuration-manager';
import { EmailTransferFunction } from '../../../src/jobs/email-transfer/email-transfer.function';

describe('unit/transfer-email/email-transfer.function scheduler', () => {
  it('exposes the expected scheduler options', () => {
    const functionInstance = new EmailTransferFunction();

    expect(functionInstance.createScheduleOptions()).toEqual({
      region: 'europe-west1',
      schedule: ConfigurationManager.scheduledTransferCron,
      timeoutSeconds: 300,
    });
  });

  it('creates a handler that delegates to run', async () => {
    const functionInstance = new EmailTransferFunction({
      job: {
        run: vi.fn().mockResolvedValue({
          summary: {},
        }),
      },
    });

    await expect(functionInstance.createHandler()()).resolves.toBeUndefined();
  });
});
