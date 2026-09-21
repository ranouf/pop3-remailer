import { JobRunStatus, JobRunEntity } from '../../../../src/core/job-run';
import { SourceProvider } from '../../../../src/jobs/email-transfer/models/source-account';
import { jobRunsCollectionName } from '../../../../src/infrastructure/firestore/firestore-keys';
import type { StoredJobRunRecord } from '../../../../src/infrastructure/firestore/firestore-mappers';
import { FirestoreJobRunRepository } from '../../../../src/infrastructure/job-run/repositories/firestore-job-run-repository';
import { InMemoryFirestoreDatabase } from '../../../../src/infrastructure/firestore/tests/in-memory-firestore-database';

describe('tests/unit/infrastructure/firestore/firestore-job-run-repository', () => {
  it('stores started and finished job runs for audit purposes', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreJobRunRepository(database);
    const startedSummary = JobRunEntity.createStarted({
      jobId: 'job-audit-1',
      provider: SourceProvider.Orange,
      sourceAccountId: 'orange:source@orange.fr',
      startedAt: new Date('2026-03-31T22:00:00.000Z'),
    });

    await repository.saveStarted(startedSummary);

    const finishedSummary = startedSummary.finalize(
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
      provider: SourceProvider.Orange,
      skippedCount: 1,
      sourceAccountId: 'orange:source@orange.fr',
      status: JobRunStatus.CompletedWithFailures,
      transferredCount: 2,
    });
  });
});
