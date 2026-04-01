import { transferEventNames } from '../../../src';

describe('domain/ports', () => {
  it('defines all required tracking event names', () => {
    expect(transferEventNames).toEqual([
      'job_started',
      'job_finished',
      'job_duration_recorded',
      'email_detected',
      'email_skipped_already_processed',
      'email_transfer_started',
      'email_transferred',
      'email_transfer_failed',
      'email_processing_failed',
      'pop3_connection_failed',
      'gmail_import_failed',
    ]);
  });
});
