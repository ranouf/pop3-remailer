import type { JobRunStatisticsEntity } from './entities/job-run-statistics.entity';
import type { JobRunStatisticsManagerInterface } from './job-run-statistics-manager.interface';
import type { JobRunStatisticsRepositoryInterface } from './job-run-statistics-repository.interface';

export class PersistedJobRunStatisticsManager implements JobRunStatisticsManagerInterface {
  public constructor(
    private readonly sourceAccountId: string,
    private readonly repository: JobRunStatisticsRepositoryInterface,
    private readonly fallbackManager: JobRunStatisticsManagerInterface,
  ) {}

  public async getStatistics(): Promise<JobRunStatisticsEntity> {
    const statistics = await this.repository.get(this.sourceAccountId);

    if (statistics !== null) {
      return statistics;
    }

    return this.fallbackManager.getStatistics();
  }
}
