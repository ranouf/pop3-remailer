import {
  type JobRunEntity,
  type JobRunRepository,
} from '../../../core/job-run';
import {
  type StoredJobRunRecord,
  toJobRunEntity,
  toStoredJobRunRecord,
} from '../../firestore/firestore-mappers';
import { jobRunsCollectionName } from '../../firestore/firestore-keys';
import type { FirestoreDatabase } from '../../firestore/models';

export class FirestoreJobRunRepository implements JobRunRepository {
  private readonly database: FirestoreDatabase;

  public constructor(database: FirestoreDatabase) {
    this.database = database;
  }

  public async saveFinished(summary: JobRunEntity): Promise<void> {
    await this.database
      .collection(jobRunsCollectionName)
      .doc(summary.jobId)
      .set(toStoredJobRunRecord(summary));
  }

  public async saveStarted(summary: JobRunEntity): Promise<void> {
    await this.database
      .collection(jobRunsCollectionName)
      .doc(summary.jobId)
      .set(toStoredJobRunRecord(summary));
  }

  public async listBySourceAccount(
    sourceAccountId: string,
  ): Promise<readonly JobRunEntity[]> {
    const documents = await this.getCollection().listDocuments();

    return documents
      .map((document) => toJobRunEntity(document.data))
      .filter(
        (summary: JobRunEntity) => summary.sourceAccountId === sourceAccountId,
      )
      .sort(
        (left: JobRunEntity, right: JobRunEntity) =>
          right.startedAt.getTime() - left.startedAt.getTime(),
      );
  }

  private getCollection() {
    return this.database.collection<StoredJobRunRecord>(jobRunsCollectionName);
  }
}
