import type { ProcessedEmailRepository } from '../../../core/email/processed-email/processed-email-repository.interface';
import {
  EmailRecordStatus,
  ProcessedEmailCleanupResult,
  ProcessedEmailEntity as ProcessedEmailEntityModel,
  type ProcessedEmailMetadata,
  type ProcessedEmailEntity,
  type UidlClaimResult,
  UidlClaimResult as UidlClaimResultModel,
  UidlClaimStatus,
} from '../../../core/email/processed-email';
import type { SourceAccount } from '../../../jobs/email-transfer/models/source-account';
import { Uidl } from '../../../core/email/uidl';
import {
  toProcessedEmailEntity,
  toStoredProcessedEmailEntity,
  type StoredProcessedEmailEntity,
} from '../../firestore/firestore-mappers';
import {
  createProcessedEmailDocumentId,
  processedEmailsCollectionName,
} from '../../firestore/firestore-keys';
import type { FirestoreDatabase } from '../../firestore/models';

const createProcessingRecord = (
  sourceAccount: SourceAccount,
  uidl: Uidl,
  metadata: ProcessedEmailMetadata,
  jobId: string,
  existingEntity?: ProcessedEmailEntity,
): ProcessedEmailEntity => {
  const now = new Date();

  return new ProcessedEmailEntityModel({
    createdAt: existingEntity?.createdAt ?? now,
    metadata:
      existingEntity === undefined
        ? metadata.withClaimJobId(jobId)
        : existingEntity.metadata.mergeWith(metadata).withClaimJobId(jobId),
    sourceAccountId: sourceAccount.id,
    sourceProvider: sourceAccount.provider,
    status: EmailRecordStatus.Processing,
    uidl,
    updatedAt: now,
  });
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
        const entity = createProcessingRecord(
          params.sourceAccount,
          params.uidl,
          params.metadata,
          params.jobId,
        );

        transaction.set(
          documentReference,
          toStoredProcessedEmailEntity(entity),
          {
            merge: false,
          },
        );

        return new UidlClaimResultModel(entity, UidlClaimStatus.Claimed);
      }

      const existingEntity = toProcessedEmailEntity(
        snapshot.data() as StoredProcessedEmailEntity,
      );

      if (existingEntity.isImported()) {
        return new UidlClaimResultModel(
          existingEntity,
          UidlClaimStatus.AlreadyImported,
        );
      }

      if (existingEntity.isProcessing()) {
        return new UidlClaimResultModel(
          existingEntity,
          UidlClaimStatus.AlreadyProcessing,
        );
      }

      const reclaimedEntity = createProcessingRecord(
        params.sourceAccount,
        params.uidl,
        params.metadata,
        params.jobId,
        existingEntity,
      );

      transaction.set(
        documentReference,
        toStoredProcessedEmailEntity(reclaimedEntity),
        {
          merge: true,
        },
      );

      return new UidlClaimResultModel(reclaimedEntity, UidlClaimStatus.Claimed);
    });
  }

  public async cleanupImportedRecords(params: {
    readonly cleanupBatchSize: number;
    readonly minimumRetainedCount: number;
    readonly now: Date;
    readonly retentionDays: number;
    readonly sourceAccountId: string;
  }): Promise<ProcessedEmailCleanupResult> {
    const importedRecords = [
      ...(await this.listImportedRecords(params.sourceAccountId)),
    ].sort(
      (leftEntity: ProcessedEmailEntity, rightEntity: ProcessedEmailEntity) =>
        this.toImportedAtTime(rightEntity) - this.toImportedAtTime(leftEntity),
    );
    const retainedUidls = new Set(
      importedRecords
        .slice(0, params.minimumRetainedCount)
        .map((record) => record.uidl.toString()),
    );
    const retentionCutoff = new Date(
      params.now.getTime() - params.retentionDays * 24 * 60 * 60 * 1000,
    );
    const deletionCandidates = importedRecords
      .filter(
        (record) =>
          record.importedAt !== undefined &&
          record.importedAt < retentionCutoff &&
          !retainedUidls.has(record.uidl.toString()),
      )
      .slice(0, params.cleanupBatchSize);

    await Promise.all(
      deletionCandidates.map((record) =>
        this.getCollection()
          .doc(
            createProcessedEmailDocumentId(params.sourceAccountId, record.uidl),
          )
          .delete(),
      ),
    );

    return new ProcessedEmailCleanupResult({
      deletedCount: deletionCandidates.length,
      retainedCount: importedRecords.length - deletionCandidates.length,
    });
  }

  public async findByUidl(
    sourceAccountId: string,
    uidl: Uidl,
  ): Promise<ProcessedEmailEntity | null> {
    const snapshot = await this.getCollection()
      .doc(createProcessedEmailDocumentId(sourceAccountId, uidl))
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return toProcessedEmailEntity(
      snapshot.data() as StoredProcessedEmailEntity,
    );
  }

  public async findByUidls(
    sourceAccountId: string,
    uidls: readonly Uidl[],
  ): Promise<ReadonlyMap<string, ProcessedEmailEntity>> {
    const uniqueUidls = [...new Set(uidls.map((uidl) => uidl.toString()))];

    if (uniqueUidls.length === 0) {
      return new Map();
    }

    const snapshots = await Promise.all(
      uniqueUidls.map((uidl) =>
        this.getCollection()
          .doc(
            createProcessedEmailDocumentId(sourceAccountId, Uidl.create(uidl)),
          )
          .get(),
      ),
    );
    const entities = new Map<string, ProcessedEmailEntity>();

    for (const snapshot of snapshots) {
      if (!snapshot.exists) {
        continue;
      }

      const entity = toProcessedEmailEntity(
        snapshot.data() as StoredProcessedEmailEntity,
      );

      entities.set(entity.uidl.toString(), entity);
    }

    return entities;
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
          status: EmailRecordStatus.Failed,
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
          status: EmailRecordStatus.Imported,
          updatedAt: new Date(),
        },
        {
          merge: true,
        },
      );
  }

  private getCollection() {
    return this.database.collection<StoredProcessedEmailEntity>(
      processedEmailsCollectionName,
    );
  }

  private async listImportedRecords(
    sourceAccountId: string,
  ): Promise<readonly ProcessedEmailEntity[]> {
    const storedDocuments = await this.getCollection().listDocuments();

    return storedDocuments
      .map((document) => toProcessedEmailEntity(document.data))
      .filter(
        (entity) =>
          entity.sourceAccountId === sourceAccountId &&
          entity.status === EmailRecordStatus.Imported,
      );
  }

  private toImportedAtTime(entity: ProcessedEmailEntity): number {
    return entity.importedAt?.getTime() ?? entity.updatedAt.getTime();
  }
}
