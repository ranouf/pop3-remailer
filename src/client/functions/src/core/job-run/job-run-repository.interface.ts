import type { JobRunEntity } from './index';

export interface JobRunRepository {
  delete(jobId: string): Promise<void>;
  listBySourceAccount(
    sourceAccountId: string,
  ): Promise<readonly JobRunEntity[]>;
  saveFinished(summary: JobRunEntity): Promise<void>;
  saveStarted(summary: JobRunEntity): Promise<void>;
}
