import type { JobRunEntity } from './index';

export interface JobRunRepository {
  listBySourceAccount(
    sourceAccountId: string,
  ): Promise<readonly JobRunEntity[]>;
  saveFinished(summary: JobRunEntity): Promise<void>;
  saveStarted(summary: JobRunEntity): Promise<void>;
}
