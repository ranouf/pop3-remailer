import type { Container } from 'inversify';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { type AnalyticsTrackerService } from '../core/analytics';
import { type ApplicationConfiguration } from '../core/configuration/models/application-configuration';
import type { GmailMailService } from '../core/email/gmail';
import type { Pop3MailServiceInterface } from '../core/email/pop3';
import type { ProcessedEmailRepository } from '../core/email/processed-email/processed-email-repository.interface';
import type { AmplitudeHealthChecker } from '../core/health-check/amplitude-health-checker.interface';
import type { FirestoreHealthChecker } from '../core/health-check/firestore-health-checker.interface';
import type { GmailHealthChecker } from '../core/health-check/gmail-health-checker.interface';
import type { Pop3HealthChecker } from '../core/health-check/pop3-health-checker.interface';
import type { JobRunRepository } from '../core/job-run';
import type { JobRunStatisticsRepositoryInterface } from '../core/job-run-statistics';
import type { StructuredLogger } from '../core/logging/structured-logger.interface';
import type { Clock } from '../core/time/clock.interface';
import { CoreModule } from '../core/core.module';
import type { AuthTokenVerifierInterface } from '../api/auth/auth-token-verifier.interface';
import { AmplitudeTrackerService } from './analytics/amplitude-tracker-service';
import { AmplitudeNodeClient } from './analytics/client/amplitude-node-client';
import type { AmplitudeNodeClientInterface } from './analytics/client/amplitude-node-client.interface';
import { AmplitudeConnectivityHealthChecker } from './analytics/healthchecks/amplitude-health-checker';
import { FirestoreProcessedEmailRepository } from './email/repositories/firestore-processed-email-repository';
import { GmailApiClientFactory } from './email/gmail/client/gmail-api-client-factory';
import type { GmailApiClientFactoryInterface } from './email/gmail/client/gmail-api-client-factory.interface';
import { GmailConnectivityHealthChecker } from './email/gmail/healthchecks/gmail-health-checker';
import { GoogleGmailMailService } from './email/gmail/gmail-mail-service';
import { GoogleGmailOAuthProvider } from './email/gmail/oauth/gmail-oauth-provider';
import type { GmailOAuthProviderInterface } from './email/gmail/oauth/gmail-oauth-provider.interface';
import { NodePop3CommandFactory } from './email/node-pop3/client/node-pop3-command-factory';
import type { Pop3CommandFactoryInterface } from './email/node-pop3/client/pop3-command-factory.interface';
import { Pop3ConnectivityHealthChecker } from './email/node-pop3/healthchecks/pop3-health-checker';
import { NodePop3MailService } from './email/node-pop3/node-pop3-mail-service';
import { Pop3ResponseParser } from './email/node-pop3/parser/pop3-response-parser';
import { FirebaseAuthTokenVerifier } from './firebase/firebase-auth-token-verifier';
import { FirebaseAdminFirestoreDatabase } from './firestore/database/firebase-admin-firestore-database';
import { FirestoreConnectivityHealthChecker } from './firestore/healthchecks/firestore-health-checker';
import type { FirestoreDatabase } from './firestore/models';
import { FirestoreJobRunRepository } from './job-run/repositories/firestore-job-run-repository';
import { FirestoreJobRunStatisticsRepository } from './job-run-statistics/repositories/firestore-job-run-statistics-repository';
import { StructuredConsoleLogger } from './logging/structured-console-logger';
import { SystemClock } from './time/system-clock';

export class InfrastructureModule {
  public static readonly AmplitudeHealthChecker = Symbol.for(
    'Infrastructure.AmplitudeHealthChecker',
  );
  public static readonly AnalyticsTrackerService = Symbol.for(
    'Infrastructure.AnalyticsTrackerService',
  );
  public static readonly AmplitudeNodeClient = Symbol.for(
    'Infrastructure.AmplitudeNodeClient',
  );
  public static readonly AuthTokenVerifier = Symbol.for(
    'Infrastructure.AuthTokenVerifier',
  );
  public static readonly Clock = Symbol.for('Infrastructure.Clock');
  public static readonly FirebaseApp = Symbol.for('Infrastructure.FirebaseApp');
  public static readonly FirestoreDatabase = Symbol.for(
    'Infrastructure.FirestoreDatabase',
  );
  public static readonly FirestoreHealthChecker = Symbol.for(
    'Infrastructure.FirestoreHealthChecker',
  );
  public static readonly GmailApiClientFactory = Symbol.for(
    'Infrastructure.GmailApiClientFactory',
  );
  public static readonly GmailHealthChecker = Symbol.for(
    'Infrastructure.GmailHealthChecker',
  );
  public static readonly GmailMailService = Symbol.for(
    'Infrastructure.GmailMailService',
  );
  public static readonly GmailOAuthProvider = Symbol.for(
    'Infrastructure.GmailOAuthProvider',
  );
  public static readonly JobRunRepository = Symbol.for(
    'Infrastructure.JobRunRepository',
  );
  public static readonly JobRunStatisticsRepository = Symbol.for(
    'Infrastructure.JobRunStatisticsRepository',
  );
  public static readonly Pop3CommandFactory = Symbol.for(
    'Infrastructure.Pop3CommandFactory',
  );
  public static readonly Pop3HealthChecker = Symbol.for(
    'Infrastructure.Pop3HealthChecker',
  );
  public static readonly Pop3MailService = Symbol.for(
    'Infrastructure.Pop3MailService',
  );
  public static readonly Pop3ResponseParser = Symbol.for(
    'Infrastructure.Pop3ResponseParser',
  );
  public static readonly ProcessedEmailRepository = Symbol.for(
    'Infrastructure.ProcessedEmailRepository',
  );
  public static readonly StructuredLogger = Symbol.for(
    'Infrastructure.StructuredLogger',
  );

  public static register(container: Container): void {
    container
      .bind<Clock>(InfrastructureModule.Clock)
      .toDynamicValue(() => new SystemClock())
      .inSingletonScope();

    container
      .bind<StructuredLogger>(InfrastructureModule.StructuredLogger)
      .toDynamicValue(() => new StructuredConsoleLogger())
      .inSingletonScope();

    container
      .bind<App>(InfrastructureModule.FirebaseApp)
      .toDynamicValue(() => {
        const config = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        );

        return (
          getApps()[0] ??
          initializeApp({
            projectId: config.firebase.projectId,
          })
        );
      })
      .inSingletonScope();

    container
      .bind<FirestoreDatabase>(InfrastructureModule.FirestoreDatabase)
      .toDynamicValue(
        () =>
          new FirebaseAdminFirestoreDatabase(
            getFirestore(container.get<App>(InfrastructureModule.FirebaseApp)),
          ),
      )
      .inSingletonScope();

    container
      .bind<AuthTokenVerifierInterface>(InfrastructureModule.AuthTokenVerifier)
      .toDynamicValue(
        () =>
          new FirebaseAuthTokenVerifier(
            container.get<App>(InfrastructureModule.FirebaseApp),
          ),
      )
      .inSingletonScope();

    container
      .bind<JobRunRepository>(InfrastructureModule.JobRunRepository)
      .toDynamicValue(
        () =>
          new FirestoreJobRunRepository(
            container.get<FirestoreDatabase>(
              InfrastructureModule.FirestoreDatabase,
            ),
          ),
      )
      .inSingletonScope();

    container
      .bind<JobRunStatisticsRepositoryInterface>(
        InfrastructureModule.JobRunStatisticsRepository,
      )
      .toDynamicValue(
        () =>
          new FirestoreJobRunStatisticsRepository(
            container.get<FirestoreDatabase>(
              InfrastructureModule.FirestoreDatabase,
            ),
          ),
      )
      .inSingletonScope();

    container
      .bind<ProcessedEmailRepository>(
        InfrastructureModule.ProcessedEmailRepository,
      )
      .toDynamicValue(
        () =>
          new FirestoreProcessedEmailRepository(
            container.get<FirestoreDatabase>(
              InfrastructureModule.FirestoreDatabase,
            ),
          ),
      )
      .inSingletonScope();

    container
      .bind<AmplitudeNodeClientInterface>(
        InfrastructureModule.AmplitudeNodeClient,
      )
      .toDynamicValue(() => {
        const config = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        );

        return new AmplitudeNodeClient(config.analytics.amplitudeApiKey);
      })
      .inSingletonScope();

    container
      .bind<AnalyticsTrackerService>(
        InfrastructureModule.AnalyticsTrackerService,
      )
      .toDynamicValue(() => {
        const config = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        );

        return new AmplitudeTrackerService(
          config.analytics,
          container.get<StructuredLogger>(
            InfrastructureModule.StructuredLogger,
          ),
          container.get<AmplitudeNodeClientInterface>(
            InfrastructureModule.AmplitudeNodeClient,
          ),
        );
      })
      .inSingletonScope();

    container
      .bind<GmailOAuthProviderInterface>(
        InfrastructureModule.GmailOAuthProvider,
      )
      .toDynamicValue(() => new GoogleGmailOAuthProvider())
      .inSingletonScope();

    container
      .bind<GmailApiClientFactoryInterface>(
        InfrastructureModule.GmailApiClientFactory,
      )
      .toDynamicValue(() => new GmailApiClientFactory())
      .inSingletonScope();

    container
      .bind<GmailMailService>(InfrastructureModule.GmailMailService)
      .toDynamicValue(() => {
        const config = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        );

        return new GoogleGmailMailService(
          config.gmail,
          container.get<GmailOAuthProviderInterface>(
            InfrastructureModule.GmailOAuthProvider,
          ),
          container.get<GmailApiClientFactoryInterface>(
            InfrastructureModule.GmailApiClientFactory,
          ),
        );
      })
      .inSingletonScope();

    container
      .bind<Pop3CommandFactoryInterface>(
        InfrastructureModule.Pop3CommandFactory,
      )
      .toDynamicValue(() => new NodePop3CommandFactory())
      .inSingletonScope();

    container
      .bind<Pop3ResponseParser>(InfrastructureModule.Pop3ResponseParser)
      .toDynamicValue(() => new Pop3ResponseParser())
      .inSingletonScope();

    container
      .bind<Pop3MailServiceInterface>(InfrastructureModule.Pop3MailService)
      .toDynamicValue(() => {
        const config = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        );

        return new NodePop3MailService(
          config.pop3,
          config.job.maxMessagesPerRun,
          container.get<Pop3CommandFactoryInterface>(
            InfrastructureModule.Pop3CommandFactory,
          ),
          container.get<Pop3ResponseParser>(
            InfrastructureModule.Pop3ResponseParser,
          ),
        );
      })
      .inSingletonScope();

    container
      .bind<Pop3HealthChecker>(InfrastructureModule.Pop3HealthChecker)
      .toDynamicValue(() => {
        const config = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        );

        return new Pop3ConnectivityHealthChecker(config.pop3, {
          clock: container.get<Clock>(InfrastructureModule.Clock),
          commandFactory: container.get<Pop3CommandFactoryInterface>(
            InfrastructureModule.Pop3CommandFactory,
          ),
        });
      })
      .inSingletonScope();

    container
      .bind<GmailHealthChecker>(InfrastructureModule.GmailHealthChecker)
      .toDynamicValue(() => {
        const config = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        );

        return new GmailConnectivityHealthChecker(config.gmail, {
          apiClientFactory: container.get<GmailApiClientFactoryInterface>(
            InfrastructureModule.GmailApiClientFactory,
          ),
          clock: container.get<Clock>(InfrastructureModule.Clock),
          oauthProvider: container.get<GmailOAuthProviderInterface>(
            InfrastructureModule.GmailOAuthProvider,
          ),
        });
      })
      .inSingletonScope();

    container
      .bind<FirestoreHealthChecker>(InfrastructureModule.FirestoreHealthChecker)
      .toDynamicValue(
        () =>
          new FirestoreConnectivityHealthChecker(
            container.get<FirestoreDatabase>(
              InfrastructureModule.FirestoreDatabase,
            ),
            {
              clock: container.get<Clock>(InfrastructureModule.Clock),
            },
          ),
      )
      .inSingletonScope();

    container
      .bind<AmplitudeHealthChecker>(InfrastructureModule.AmplitudeHealthChecker)
      .toDynamicValue(() => {
        const config = container.get<ApplicationConfiguration>(
          CoreModule.ApplicationConfiguration,
        );

        return new AmplitudeConnectivityHealthChecker(config.analytics, {
          amplitudeClient: container.get<AmplitudeNodeClientInterface>(
            InfrastructureModule.AmplitudeNodeClient,
          ),
          clock: container.get<Clock>(InfrastructureModule.Clock),
        });
      })
      .inSingletonScope();
  }
}
