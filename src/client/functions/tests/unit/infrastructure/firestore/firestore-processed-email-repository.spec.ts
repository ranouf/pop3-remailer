import {
  EmailRecordStatus,
  ProcessedEmailMetadata,
  UidlClaimStatus,
} from '../../../../src/core/email/processed-email';
import {
  SourceAccount,
  SourceProvider,
} from '../../../../src/jobs/email-transfer/models/source-account';
import { Uidl } from '../../../../src/core/email/uidl';
import {
  createProcessedEmailDocumentId,
  processedEmailsCollectionName,
} from '../../../../src/infrastructure/firestore/firestore-keys';
import type { StoredProcessedEmailEntity } from '../../../../src/infrastructure/firestore/firestore-mappers';
import { FirestoreProcessedEmailRepository } from '../../../../src/infrastructure/email/repositories/firestore-processed-email-repository';
import { InMemoryFirestoreDatabase } from '../../../../src/infrastructure/firestore/tests/in-memory-firestore-database';

const sourceAccount: SourceAccount = new SourceAccount(
  'source@orange.fr',
  SourceAccount.createId(SourceProvider.Orange, 'source@orange.fr'),
  SourceProvider.Orange,
  'source@orange.fr',
);

describe('tests/unit/infrastructure/firestore/firestore-processed-email-repository', () => {
  it('claims a new UIDL atomically and persists a processing record', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = Uidl.create('uidl-claim-1');

    const result = await repository.claimForProcessing({
      jobId: 'job-1',
      metadata: new ProcessedEmailMetadata({
        messageId: 'message-id-1',
        messageNumber: 1,
        messageSize: 42,
      }),
      sourceAccount,
      uidl,
    });

    expect(result.status).toBe(UidlClaimStatus.Claimed);
    expect(result.record.status).toBe(EmailRecordStatus.Processing);
    expect(result.record.metadata.claimJobId).toBe('job-1');

    const persistedRecord =
      await database.readDocument<StoredProcessedEmailEntity>(
        processedEmailsCollectionName,
        createProcessedEmailDocumentId(sourceAccount.id, uidl),
      );

    expect(persistedRecord).toMatchObject({
      metadata: {
        claimJobId: 'job-1',
        messageId: 'message-id-1',
      },
      sourceAccountId: sourceAccount.id,
      status: EmailRecordStatus.Processing,
      uidl: uidl.toString(),
    });
  });

  it('returns already_imported when the UIDL has already been imported', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = Uidl.create('uidl-imported-1');

    await repository.claimForProcessing({
      jobId: 'job-import-seed',
      metadata: new ProcessedEmailMetadata(),
      sourceAccount,
      uidl,
    });
    await repository.markImported({
      sourceAccountId: sourceAccount.id,
      uidl,
      gmailMessageId: 'gmail-123',
    });

    const result = await repository.claimForProcessing({
      jobId: 'job-2',
      metadata: new ProcessedEmailMetadata(),
      sourceAccount,
      uidl,
    });

    expect(result.status).toBe(UidlClaimStatus.AlreadyImported);
    expect(result.record.gmailMessageId).toBe('gmail-123');
  });

  it('returns already_processing when the UIDL is already claimed', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = Uidl.create('uidl-processing-1');

    await repository.claimForProcessing({
      jobId: 'job-3',
      metadata: new ProcessedEmailMetadata(),
      sourceAccount,
      uidl,
    });

    const result = await repository.claimForProcessing({
      jobId: 'job-4',
      metadata: new ProcessedEmailMetadata(),
      sourceAccount,
      uidl,
    });

    expect(result.status).toBe(UidlClaimStatus.AlreadyProcessing);
    expect(result.record.metadata.claimJobId).toBe('job-3');
  });

  it('reclaims a failed UIDL safely for a new job', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = Uidl.create('uidl-failed-1');

    await repository.claimForProcessing({
      jobId: 'job-5',
      metadata: new ProcessedEmailMetadata({
        messageNumber: 5,
      }),
      sourceAccount,
      uidl,
    });
    await repository.markFailed({
      errorMessage: 'Gmail timeout',
      jobId: 'job-5',
      sourceAccountId: sourceAccount.id,
      uidl,
    });

    const result = await repository.claimForProcessing({
      jobId: 'job-6',
      metadata: new ProcessedEmailMetadata({
        messageSize: 512,
      }),
      sourceAccount,
      uidl,
    });

    expect(result.status).toBe(UidlClaimStatus.Claimed);
    expect(result.record.status).toBe(EmailRecordStatus.Processing);
    expect(result.record.metadata.claimJobId).toBe('job-6');
    expect(result.record.metadata.messageNumber).toBe(5);
    expect(result.record.metadata.messageSize).toBe(512);
  });

  it('marks an email as imported and keeps the record available for replay safety', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = Uidl.create('uidl-import-2');

    await repository.claimForProcessing({
      jobId: 'job-7',
      metadata: new ProcessedEmailMetadata(),
      sourceAccount,
      uidl,
    });
    await repository.markImported({
      sourceAccountId: sourceAccount.id,
      uidl,
      gmailMessageId: 'gmail-777',
    });

    const record = await repository.findByUidl(sourceAccount.id, uidl);

    expect(record).toMatchObject({
      gmailMessageId: 'gmail-777',
      sourceAccountId: sourceAccount.id,
      status: EmailRecordStatus.Imported,
      uidl,
    });
    expect(record?.importedAt).toBeInstanceOf(Date);
  });

  it('marks a record as failed without deleting deduplication metadata', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = Uidl.create('uidl-failure-2');

    await repository.claimForProcessing({
      jobId: 'job-8',
      metadata: new ProcessedEmailMetadata({
        messageId: 'original-message-id',
      }),
      sourceAccount,
      uidl,
    });
    await repository.markFailed({
      errorMessage: 'SMTP gateway unavailable',
      jobId: 'job-8',
      sourceAccountId: sourceAccount.id,
      uidl,
    });

    const record = await repository.findByUidl(sourceAccount.id, uidl);

    expect(record).toMatchObject({
      lastError: 'SMTP gateway unavailable',
      metadata: {
        claimJobId: 'job-8',
        messageId: 'original-message-id',
      },
      status: EmailRecordStatus.Failed,
    });
  });

  it('cleans up imported UIDLs older than the retention window while keeping the minimum retained count', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const now = new Date('2026-04-30T00:00:00.000Z');

    for (let index = 1; index <= 105; index += 1) {
      const uidl = Uidl.create(`cleanup-uidl-${index}`);

      await repository.claimForProcessing({
        jobId: `job-cleanup-${index}`,
        metadata: new ProcessedEmailMetadata({
          messageNumber: index,
        }),
        sourceAccount,
        uidl,
      });
      await repository.markImported({
        sourceAccountId: sourceAccount.id,
        uidl,
        gmailMessageId: `gmail-${index}`,
      });

      await database.writeDocument<StoredProcessedEmailEntity>(
        processedEmailsCollectionName,
        createProcessedEmailDocumentId(sourceAccount.id, uidl),
        {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          gmailMessageId: `gmail-${index}`,
          importedAt: new Date(
            index <= 5
              ? `2026-02-0${index}T00:00:00.000Z`
              : index <= 100
                ? `2026-03-${String(((index - 6) % 28) + 1).padStart(2, '0')}T00:00:00.000Z`
                : `2026-04-${String(index - 100).padStart(2, '0')}T00:00:00.000Z`,
          ),
          metadata: {
            claimJobId: `job-cleanup-${index}`,
            messageNumber: index,
          },
          sourceAccountId: sourceAccount.id,
          sourceProvider: sourceAccount.provider,
          status: EmailRecordStatus.Imported,
          uidl: uidl.toString(),
          updatedAt: new Date(
            index <= 5
              ? `2026-02-0${index}T00:00:00.000Z`
              : index <= 100
                ? `2026-03-${String(((index - 6) % 28) + 1).padStart(2, '0')}T00:00:00.000Z`
                : `2026-04-${String(index - 100).padStart(2, '0')}T00:00:00.000Z`,
          ),
        },
      );
    }

    const cleanupResult = await repository.cleanupImportedRecords({
      cleanupBatchSize: 250,
      minimumRetainedCount: 100,
      now,
      retentionDays: 30,
      sourceAccountId: sourceAccount.id,
    });

    expect(cleanupResult).toMatchObject({
      deletedCount: 5,
      retainedCount: 100,
    });

    const deletedRecord = await repository.findByUidl(
      sourceAccount.id,
      Uidl.create('cleanup-uidl-1'),
    );
    const retainedOldRecord = await repository.findByUidl(
      sourceAccount.id,
      Uidl.create('cleanup-uidl-100'),
    );
    const retainedRecentRecord = await repository.findByUidl(
      sourceAccount.id,
      Uidl.create('cleanup-uidl-105'),
    );

    expect(deletedRecord).toBeNull();
    expect(retainedOldRecord?.status).toBe(EmailRecordStatus.Imported);
    expect(retainedRecentRecord?.status).toBe(EmailRecordStatus.Imported);
  });
});
