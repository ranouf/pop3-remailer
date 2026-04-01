import {
  createSourceAccountId,
  type SourceAccount,
} from '../../../src/domain/email';
import { createUidl } from '../../../src/domain/uidl';
import { FirestoreProcessedEmailRepository } from '../../../src/infrastructure/firestore/firestore-processed-email-repository';
import {
  createProcessedEmailDocumentId,
  processedEmailsCollectionName,
} from '../../../src/infrastructure/firestore/firestore-keys';
import type { StoredProcessedEmailRecord } from '../../../src/infrastructure/firestore/firestore-mappers';
import { InMemoryFirestoreDatabase } from './firestore-in-memory';

const sourceAccount: SourceAccount = {
  address: 'source@orange.fr',
  id: createSourceAccountId('orange', 'source@orange.fr'),
  provider: 'orange',
  username: 'source@orange.fr',
};

describe('infrastructure/firestore/firestore-processed-email-repository', () => {
  it('claims a new UIDL atomically and persists a processing record', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = createUidl('uidl-claim-1');

    const result = await repository.claimForProcessing({
      jobId: 'job-1',
      metadata: {
        messageId: 'message-id-1',
        messageNumber: 1,
        messageSize: 42,
      },
      sourceAccount,
      uidl,
    });

    expect(result.status).toBe('claimed');
    expect(result.record.status).toBe('processing');
    expect(result.record.metadata.claimJobId).toBe('job-1');

    const persistedRecord =
      await database.readDocument<StoredProcessedEmailRecord>(
        processedEmailsCollectionName,
        createProcessedEmailDocumentId(sourceAccount.id, uidl),
      );

    expect(persistedRecord).toMatchObject({
      metadata: {
        claimJobId: 'job-1',
        messageId: 'message-id-1',
      },
      sourceAccountId: sourceAccount.id,
      status: 'processing',
      uidl,
    });
  });

  it('returns already_imported when the UIDL has already been imported', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = createUidl('uidl-imported-1');

    await repository.claimForProcessing({
      jobId: 'job-import-seed',
      metadata: {},
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
      metadata: {},
      sourceAccount,
      uidl,
    });

    expect(result.status).toBe('already_imported');
    expect(result.record.gmailMessageId).toBe('gmail-123');
  });

  it('returns already_processing when the UIDL is already claimed', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = createUidl('uidl-processing-1');

    await repository.claimForProcessing({
      jobId: 'job-3',
      metadata: {},
      sourceAccount,
      uidl,
    });

    const result = await repository.claimForProcessing({
      jobId: 'job-4',
      metadata: {},
      sourceAccount,
      uidl,
    });

    expect(result.status).toBe('already_processing');
    expect(result.record.metadata.claimJobId).toBe('job-3');
  });

  it('reclaims a failed UIDL safely for a new job', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = createUidl('uidl-failed-1');

    await repository.claimForProcessing({
      jobId: 'job-5',
      metadata: {
        messageNumber: 5,
      },
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
      metadata: {
        messageSize: 512,
      },
      sourceAccount,
      uidl,
    });

    expect(result.status).toBe('claimed');
    expect(result.record.status).toBe('processing');
    expect(result.record.metadata.claimJobId).toBe('job-6');
    expect(result.record.metadata.messageNumber).toBe(5);
    expect(result.record.metadata.messageSize).toBe(512);
  });

  it('marks an email as imported and keeps the record available for replay safety', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = createUidl('uidl-import-2');

    await repository.claimForProcessing({
      jobId: 'job-7',
      metadata: {},
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
      status: 'imported',
      uidl,
    });
    expect(record?.importedAt).toBeInstanceOf(Date);
  });

  it('marks a record as failed without deleting deduplication metadata', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreProcessedEmailRepository(database);
    const uidl = createUidl('uidl-failure-2');

    await repository.claimForProcessing({
      jobId: 'job-8',
      metadata: {
        messageId: 'original-message-id',
      },
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
      status: 'failed',
    });
  });
});
