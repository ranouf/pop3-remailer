import type { Uidl } from './uidl';
import type { EmailRecordStatus, SourceProvider } from './email';

export interface ProcessedEmailMetadata {
  readonly claimJobId?: string;
  readonly messageId?: string;
  readonly messageNumber?: number;
  readonly messageSize?: number;
}

export interface ProcessedEmailRecord {
  readonly createdAt: Date;
  readonly gmailMessageId?: string;
  readonly importedAt?: Date;
  readonly lastError?: string;
  readonly metadata: ProcessedEmailMetadata;
  readonly sourceAccountId: string;
  readonly sourceProvider: SourceProvider;
  readonly status: EmailRecordStatus;
  readonly uidl: Uidl;
  readonly updatedAt: Date;
}

export const uidlClaimStatuses = [
  'claimed',
  'already_imported',
  'already_processing',
] as const;

export type UidlClaimStatus = (typeof uidlClaimStatuses)[number];

export type UidlClaimResult =
  | {
      readonly record: ProcessedEmailRecord;
      readonly status: 'claimed';
    }
  | {
      readonly record: ProcessedEmailRecord;
      readonly status: 'already_imported';
    }
  | {
      readonly record: ProcessedEmailRecord;
      readonly status: 'already_processing';
    };

export const canTransferClaimedEmail = (
  claimResult: UidlClaimResult,
): boolean => claimResult.status === 'claimed';

export const isImportedRecord = (record: ProcessedEmailRecord): boolean =>
  record.status === 'imported';
