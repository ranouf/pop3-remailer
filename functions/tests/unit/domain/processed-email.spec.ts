import {
  EmailRecordStatus,
  ProcessedEmailEntity,
  ProcessedEmailMetadata,
  UidlClaimResult,
  UidlClaimStatus,
} from '../../../src/core/email/processed-email';
import { SourceProvider } from '../../../src/jobs/email-transfer/models/source-account';
import { Uidl } from '../../../src/core/email/uidl';

const baseRecord = new ProcessedEmailEntity({
  createdAt: new Date('2026-03-31T20:00:00.000Z'),
  metadata: new ProcessedEmailMetadata({
    claimJobId: 'job-1',
    messageNumber: 42,
    messageSize: 128,
  }),
  sourceAccountId: 'orange:user@example.com',
  sourceProvider: SourceProvider.Orange,
  status: EmailRecordStatus.Processing,
  uidl: Uidl.create('uidl-001'),
  updatedAt: new Date('2026-03-31T20:00:00.000Z'),
});

describe('domain/processed-email', () => {
  it('exposes the supported claim statuses', () => {
    expect(Object.values(UidlClaimStatus)).toEqual([
      'claimed',
      'already_imported',
      'already_processing',
    ]);
  });

  it('allows transfers only for claimed emails', () => {
    const claimedResult = new UidlClaimResult(
      baseRecord,
      UidlClaimStatus.Claimed,
    );
    const processingResult = new UidlClaimResult(
      baseRecord,
      UidlClaimStatus.AlreadyProcessing,
    );

    expect(claimedResult.canTransfer()).toBe(true);
    expect(processingResult.canTransfer()).toBe(false);
  });

  it('detects imported records', () => {
    expect(baseRecord.isImported()).toBe(false);

    expect(
      new ProcessedEmailEntity({
        ...baseRecord,
        status: EmailRecordStatus.Imported,
        gmailMessageId: 'gmail-123',
        importedAt: new Date('2026-03-31T20:01:00.000Z'),
      }).isImported(),
    ).toBe(true);
  });
});
