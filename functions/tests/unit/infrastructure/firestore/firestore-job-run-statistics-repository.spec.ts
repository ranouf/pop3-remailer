import { JobRunStatisticsEntity } from '../../../../src/core/job-run-statistics';
import { jobRunStatisticsCollectionName } from '../../../../src/infrastructure/firestore/firestore-keys';
import type { StoredJobRunStatisticsRecord } from '../../../../src/infrastructure/firestore/firestore-mappers';
import { InMemoryFirestoreDatabase } from '../../../../src/infrastructure/firestore/tests/in-memory-firestore-database';
import { FirestoreJobRunStatisticsRepository } from '../../../../src/infrastructure/job-run-statistics/repositories/firestore-job-run-statistics-repository';
import { SourceProvider } from '../../../../src/jobs/email-transfer/models/source-account';
import { JobRunStatus } from '../../../../src/core/job-run';

describe('tests/unit/infrastructure/firestore/firestore-job-run-statistics-repository', () => {
  it('stores and reads the latest statistics projection for a source account', async () => {
    const database = new InMemoryFirestoreDatabase();
    const repository = new FirestoreJobRunStatisticsRepository(database);
    const statistics = new JobRunStatisticsEntity(
      'orange:source@orange.fr',
      [
        {
          averageDurationMs: 1500,
          date: new Date('2026-04-07T00:00:00.000Z'),
          detectedCount: 4,
          failedCount: 1,
          runCount: 2,
          transferredCount: 3,
        },
      ],
      new Date('2026-04-07T12:00:00.000Z'),
      {
        detectedLast24h: 4,
        failedLast24h: 1,
        lastError: {
          detectedCount: 2,
          durationMs: 2000,
          failedCount: 1,
          finishedAt: new Date('2026-04-07T11:05:00.000Z'),
          jobId: 'job-2',
          processedCount: 2,
          provider: SourceProvider.Orange,
          skippedCount: 0,
          sourceAccountId: 'orange:source@orange.fr',
          startedAt: new Date('2026-04-07T11:00:00.000Z'),
          status: JobRunStatus.Failed,
          transferredCount: 1,
        },
        lastRun: null,
        lastSuccess: null,
        transferredLast24h: 3,
      },
      [],
      [],
    );

    await repository.save(statistics);

    const storedRecord =
      await database.readDocument<StoredJobRunStatisticsRecord>(
        jobRunStatisticsCollectionName,
        'orange:source@orange.fr',
      );
    const savedStatistics = await repository.get('orange:source@orange.fr');

    expect(storedRecord).toMatchObject({
      generatedAt: new Date('2026-04-07T12:00:00.000Z'),
      sourceAccountId: 'orange:source@orange.fr',
    });
    expect(savedStatistics).toEqual(statistics);
  });
});
