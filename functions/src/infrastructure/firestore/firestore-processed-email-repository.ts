import type { SourceAccount } from '../../domain/email';
import type { ProcessedEmailRepository } from '../../domain/ports';
import type {
  ProcessedEmailMetadata,
  ProcessedEmailRecord,
  UidlClaimResult,
} from '../../domain/processed-email';
import type { Uidl } from '../../domain/uidl';
import {
  toProcessedEmailRecord,
  toStoredProcessedEmailRecord,
  type StoredProcessedEmailRecord,
} from './firestore-mappers';
import {
  createProcessedEmailDocumentId,
  processedEmailsCollectionName,
} from './firestore-keys';
import type { FirestoreDatabase } from './firestore-types';

const createProcessingRecord = (
  sourceAccount: SourceAccount,
  uidl: Uidl,
  metadata: ProcessedEmailMetadata,
  jobId: string,
  existingRecord?: ProcessedEmailRecord,
): ProcessedEmailRecord => {
  const now = new Date();

  return {
    createdAt: existingRecord?.createdAt ?? now,
    metadata: {
      ...(existingRecord?.metadata ?? {}),
      ...metadata,
      claimJobId: jobId,
    },
    sourceAccountId: sourceAccount.id,
    sourceProvider: sourceAccount.provider,
    status: 'processing',
    uidl,
    updatedAt: now,
  };
};

export class FirestoreProcessedEmailRepository implements ProcessedEmailRepository {
  private readonly database: FirestoreDatabase;

  public constructor(database: FirestoreDatabase) {
    this.database = database;
  }

  public async claimForProcessing(params: {
    readonly jobId: string;
    readonly metadata: ProcessedEmailMetadata;
    readonly sourceAccount: SourceAccount;
    readonly uidl: Uidl;
  }): Promise<UidlClaimResult> {
    const documentReference = this.getCollection().doc(
      createProcessedEmailDocumentId(params.sourceAccount.id, params.uidl),
    );

    return this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(documentReference);

      if (!snapshot.exists) {
        const record = createProcessingRecord(
          params.sourceAccount,
          params.uidl,
          params.metadata,
          params.jobId,
        );

        transaction.set(
          documentReference,
          toStoredProcessedEmailRecord(record),
          {
            merge: false,
          },
        );

        return {
          status: 'claimed',
          record,
        };
      }

      const existingRecord = toProcessedEmailRecord(
        snapshot.data() as StoredProcessedEmailRecord,
      );

      if (existingRecord.status === 'imported') {
        return {
          status: 'already_imported',
          record: existingRecord,
        };
      }

      if (existingRecord.status === 'processing') {
        return {
          status: 'already_processing',
          record: existingRecord,
        };
      }

      const reclaimedRecord = createProcessingRecord(
        params.sourceAccount,
        params.uidl,
        params.metadata,
        params.jobId,
        existingRecord,
      );

      transaction.set(
        documentReference,
        toStoredProcessedEmailRecord(reclaimedRecord),
        {
          merge: true,
        },
      );

      return {
        status: 'claimed',
        record: reclaimedRecord,
      };
    });
  }

  public async findByUidl(
    sourceAccountId: string,
    uidl: Uidl,
  ): Promise<ProcessedEmailRecord | null> {
    const snapshot = await this.getCollection()
      .doc(createProcessedEmailDocumentId(sourceAccountId, uidl))
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return toProcessedEmailRecord(
      snapshot.data() as StoredProcessedEmailRecord,
    );
  }

  public async markFailed(params: {
    readonly jobId: string;
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
    readonly errorMessage: string;
  }): Promise<void> {
    await this.getCollection()
      .doc(createProcessedEmailDocumentId(params.sourceAccountId, params.uidl))
      .set(
        {
          lastError: params.errorMessage,
          metadata: {
            claimJobId: params.jobId,
          },
          status: 'failed',
          updatedAt: new Date(),
        },
        {
          merge: true,
        },
      );
  }

  public async markImported(params: {
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
    readonly gmailMessageId?: string;
  }): Promise<void> {
    await this.getCollection()
      .doc(createProcessedEmailDocumentId(params.sourceAccountId, params.uidl))
      .set(
        {
          ...(params.gmailMessageId === undefined
            ? {}
            : {
                gmailMessageId: params.gmailMessageId,
              }),
          importedAt: new Date(),
          lastError: null,
          status: 'imported',
          updatedAt: new Date(),
        },
        {
          merge: true,
        },
      );
  }

  private getCollection() {
    return this.database.collection<StoredProcessedEmailRecord>(
      processedEmailsCollectionName,
    );
  }
}
