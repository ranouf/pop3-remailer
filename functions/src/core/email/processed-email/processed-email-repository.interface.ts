import type { SourceAccount } from '../../../jobs/email-transfer/models/source-account';
import type { Uidl } from '../uidl';
import type {
  ProcessedEmailCleanupResult,
  ProcessedEmailEntity,
  ProcessedEmailMetadata,
  UidlClaimResult,
} from './index';

export interface ProcessedEmailRepository {
  claimForProcessing(params: {
    readonly jobId: string;
    readonly metadata: ProcessedEmailMetadata;
    readonly sourceAccount: SourceAccount;
    readonly uidl: Uidl;
  }): Promise<UidlClaimResult>;
  cleanupImportedRecords(params: {
    readonly cleanupBatchSize: number;
    readonly minimumRetainedCount: number;
    readonly now: Date;
    readonly retentionDays: number;
    readonly sourceAccountId: string;
  }): Promise<ProcessedEmailCleanupResult>;
  findByUidl(
    sourceAccountId: string,
    uidl: Uidl,
  ): Promise<ProcessedEmailEntity | null>;
  findByUidls(
    sourceAccountId: string,
    uidls: readonly Uidl[],
  ): Promise<ReadonlyMap<string, ProcessedEmailEntity>>;
  markFailed(params: {
    readonly jobId: string;
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
    readonly errorMessage: string;
  }): Promise<void>;
  markImported(params: {
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
    readonly gmailMessageId?: string;
  }): Promise<void>;
}
