import {
  type JobRunStatisticsEntity,
  type JobRunStatisticsRepositoryInterface,
} from '../../../core/job-run-statistics';
import {
  type StoredJobRunStatisticsRecord,
  toJobRunStatisticsEntity,
  toStoredJobRunStatisticsRecord,
} from '../../firestore/firestore-mappers';
import { jobRunStatisticsCollectionName } from '../../firestore/firestore-keys';
import type { FirestoreDatabase } from '../../firestore/models';

export class FirestoreJobRunStatisticsRepository implements JobRunStatisticsRepositoryInterface {
  public constructor(private readonly database: FirestoreDatabase) {}

  public async get(
    sourceAccountId: string,
  ): Promise<JobRunStatisticsEntity | null> {
    const document = await this.getCollection().doc(sourceAccountId).get();

    if (!document.exists) {
      return null;
    }

    const data = document.data();

    if (data === undefined) {
      return null;
    }

    return toJobRunStatisticsEntity(data);
  }

  public async save(statistics: JobRunStatisticsEntity): Promise<void> {
    await this.getCollection()
      .doc(statistics.sourceAccountId)
      .set(toStoredJobRunStatisticsRecord(statistics));
  }

  private getCollection() {
    return this.database.collection<StoredJobRunStatisticsRecord>(
      jobRunStatisticsCollectionName,
    );
  }
}
