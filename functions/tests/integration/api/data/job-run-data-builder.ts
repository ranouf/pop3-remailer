import {
  JobRunEntity,
  JobRunStatus,
  type JobRunRepository,
} from '../../../../src/core/job-run';
import {
  JobRunStatisticsManager,
  type JobRunStatisticsRepositoryInterface,
} from '../../../../src/core/job-run-statistics';
import { InfrastructureModule } from '../../../../src/infrastructure/infrastructure.module';
import { SourceProvider } from '../../../../src/jobs/email-transfer/models/source-account';
import type { ApiTestFactory } from '../api-test.factory';
import { BaseDataBuilder } from './base-data-builder';

export class JobRunDataBuilder extends BaseDataBuilder {
  public async seed(factory: ApiTestFactory): Promise<void> {
    const repository = factory.resolve<JobRunRepository>(
      InfrastructureModule.JobRunRepository,
    );
    const statisticsRepository =
      factory.resolve<JobRunStatisticsRepositoryInterface>(
        InfrastructureModule.JobRunStatisticsRepository,
      );

    await repository.saveFinished(
      new JobRunEntity({
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
      }),
    );

    await repository.saveFinished(
      new JobRunEntity({
        detectedCount: 2,
        durationMs: 1000,
        failedCount: 0,
        finishedAt: new Date('2026-04-07T10:05:00.000Z'),
        jobId: 'job-1',
        processedCount: 2,
        provider: SourceProvider.Orange,
        skippedCount: 0,
        sourceAccountId: 'orange:source@orange.fr',
        startedAt: new Date('2026-04-07T10:00:00.000Z'),
        status: JobRunStatus.Completed,
        transferredCount: 2,
      }),
    );

    const statisticsManager = new JobRunStatisticsManager(
      repository,
      'orange:source@orange.fr',
      {
        now: () => new Date('2026-04-07T12:00:00.000Z'),
      },
    );

    await statisticsRepository.save(await statisticsManager.getStatistics());
  }
}
