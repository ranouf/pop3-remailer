import { createUidl } from '../../../src/domain/uidl';
import {
  canTransferClaimedEmail,
  isImportedRecord,
  uidlClaimStatuses,
  type UidlClaimResult,
} from '../../../src/domain/processed-email';

const baseRecord = {
  createdAt: new Date('2026-03-31T20:00:00.000Z'),
  metadata: {
    claimJobId: 'job-1',
    messageNumber: 42,
    messageSize: 128,
  },
  sourceAccountId: 'orange:user@example.com',
  sourceProvider: 'orange' as const,
  status: 'processing' as const,
  uidl: createUidl('uidl-001'),
  updatedAt: new Date('2026-03-31T20:00:00.000Z'),
};

describe('domain/processed-email', () => {
  it('exposes the supported claim statuses', () => {
    expect(uidlClaimStatuses).toEqual([
      'claimed',
      'already_imported',
      'already_processing',
    ]);
  });

  it('allows transfers only for claimed emails', () => {
    const claimedResult: UidlClaimResult = {
      status: 'claimed',
      record: baseRecord,
    };

    const processingResult: UidlClaimResult = {
      status: 'already_processing',
      record: baseRecord,
    };

    expect(canTransferClaimedEmail(claimedResult)).toBe(true);
    expect(canTransferClaimedEmail(processingResult)).toBe(false);
  });

  it('detects imported records', () => {
    expect(isImportedRecord(baseRecord)).toBe(false);

    expect(
      isImportedRecord({
        ...baseRecord,
        status: 'imported',
        gmailMessageId: 'gmail-123',
        importedAt: new Date('2026-03-31T20:01:00.000Z'),
      }),
    ).toBe(true);
  });
});
