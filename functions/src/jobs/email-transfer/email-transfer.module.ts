import type { Container } from 'inversify';

import type { GmailMailService } from '../../core/email/gmail';
import type { Pop3MailServiceInterface } from '../../core/email/pop3';
import type { ProcessedEmailRepository } from '../../core/email/processed-email/processed-email-repository.interface';
import type { JobRunRepository } from '../../core/job-run';
import {
  JobRunStatisticsManager as DefaultJobRunStatisticsManager,
  type JobRunStatisticsRepositoryInterface,
} from '../../core/job-run-statistics';
import type { StructuredLogger } from '../../core/logging/structured-logger.interface';
import type { AnalyticsTrackerService } from '../../core/analytics';
import type { ApplicationConfiguration } from '../../core/configuration/models/application-configuration';
import { CoreModule } from '../../core/core.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { EmailTransferFunction } from './email-transfer.function';
import { EmailTransferJob } from './email-transfer-job';

export class EmailTransferModule {
  public static readonly EmailTransferJob = Symbol.for(
    'EmailTransfer.EmailTransferJob',
  );
  public static readonly EmailTransferFunction = Symbol.for(
    'EmailTransfer.EmailTransferFunction',
  );

  public static register(container: Container): void {
    container
      .bind<EmailTransferJob>(EmailTransferModule.EmailTransferJob)
      .toDynamicValue(() => {
        const config = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        );

        return new EmailTransferJob(
          config,
          container.get<AnalyticsTrackerService>(
            InfrastructureModule.AnalyticsTrackerService,
          ),
          container.get<GmailMailService>(
            InfrastructureModule.GmailMailService,
          ),
          container.get<JobRunRepository>(
            InfrastructureModule.JobRunRepository,
          ),
          new DefaultJobRunStatisticsManager(
            container.get<JobRunRepository>(
              InfrastructureModule.JobRunRepository,
            ),
            config.sourceAccount.id,
            container.get(InfrastructureModule.Clock),
          ),
          container.get<JobRunStatisticsRepositoryInterface>(
            InfrastructureModule.JobRunStatisticsRepository,
          ),
          container.get<StructuredLogger>(
            InfrastructureModule.StructuredLogger,
          ),
          container.get<Pop3MailServiceInterface>(
            InfrastructureModule.Pop3MailService,
          ),
          container.get<ProcessedEmailRepository>(
            InfrastructureModule.ProcessedEmailRepository,
          ),
        );
      })
      .inSingletonScope();

    container
      .bind<EmailTransferFunction>(EmailTransferModule.EmailTransferFunction)
      .toDynamicValue(() => new EmailTransferFunction())
      .inSingletonScope();
  }
}
