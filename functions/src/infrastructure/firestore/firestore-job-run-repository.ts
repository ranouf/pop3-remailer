import type { JobRunSummary } from '../../domain/job-run';
import type { JobRunRepository } from '../../domain/ports';
import { jobRunsCollectionName } from './firestore-keys';
import {
  toStoredJobRunRecord,
  type StoredJobRunRecord,
} from './firestore-mappers';
import type { FirestoreDatabase } from './firestore-types';

export class FirestoreJobRunRepository implements JobRunRepository {
  private readonly database: FirestoreDatabase;

  public constructor(database: FirestoreDatabase) {
    this.database = database;
  }

  public async saveFinished(summary: JobRunSummary): Promise<void> {
    await this.getCollection()
      .doc(summary.jobId)
      .set(toStoredJobRunRecord(summary), {
        merge: true,
      });
  }

  public async saveStarted(summary: JobRunSummary): Promise<void> {
    await this.getCollection()
      .doc(summary.jobId)
      .set(toStoredJobRunRecord(summary), {
        merge: false,
      });
  }

  private getCollection() {
    return this.database.collection<StoredJobRunRecord>(jobRunsCollectionName);
  }
}
