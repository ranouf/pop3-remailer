import type { JobRunStatisticsEntity } from './entities/job-run-statistics.entity';

export interface JobRunStatisticsRepositoryInterface {
  get(sourceAccountId: string): Promise<JobRunStatisticsEntity | null>;
  save(statistics: JobRunStatisticsEntity): Promise<void>;
}
