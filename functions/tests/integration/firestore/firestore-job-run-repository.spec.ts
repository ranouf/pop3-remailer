/* eslint-disable sort-imports */
import {
  createJobRunSummary,
  finalizeJobRunSummary,
} from '../../../src/domain/job-run';
import { FirestoreJobRunRepository } from '../../../src/infrastructure/firestore/firestore-job-run-repository';
import { jobRunsCollectionName } from '../../../src/infrastructure/firestore/firestore-keys';
import type { StoredJobRunRecord } from '../../../src/infrastructure/firestore/firestore-mappers';
import { InMemoryFirestoreDatabase } from './firestore-in-memory';

describe('infrastructure/firestore/firestore-job-run-repository', () => {
  it('stores started and finished job runs for audit purposes', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreJobRunRepository(database);
    const startedSummary = createJobRunSummary({
      jobId: 'job-audit-1',
      provider: 'orange',
      sourceAccountId: 'orange:source@orange.fr',
      startedAt: new Date('2026-03-31T22:00:00.000Z'),
    });

    await repository.saveStarted(startedSummary);

    const finishedSummary = finalizeJobRunSummary(
      startedSummary,
      {
        detectedCount: 4,
        failedCount: 1,
        processedCount: 4,
        skippedCount: 1,
        transferredCount: 2,
      },
      new Date('2026-03-31T22:05:00.000Z'),
    );

    await repository.saveFinished(finishedSummary);

    const storedRecord = await database.readDocument<StoredJobRunRecord>(
      jobRunsCollectionName,
      'job-audit-1',
    );

    expect(storedRecord).toMatchObject({
      detectedCount: 4,
      durationMs: 300000,
      failedCount: 1,
      jobId: 'job-audit-1',
      processedCount: 4,
      provider: 'orange',
      skippedCount: 1,
      sourceAccountId: 'orange:source@orange.fr',
      status: 'completed_with_failures',
      transferredCount: 2,
    });
  });
});
