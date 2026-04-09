import type { JobRunStatisticsEntity } from './entities/job-run-statistics.entity';

export interface JobRunStatisticsManagerInterface {
  getStatistics(): Promise<JobRunStatisticsEntity>;
}
