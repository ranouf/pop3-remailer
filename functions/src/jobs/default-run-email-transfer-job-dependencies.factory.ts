import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import type { EmailTransferJobDependencies } from '../application/email-transfer-job-dependencies.interface';
import type { AppConfig } from '../config/environment';
import { AmplitudeTrackerService } from '../infrastructure/analytics/amplitude-tracker-service';
import { FirebaseAdminFirestoreDatabase } from '../infrastructure/firestore/database/firebase-admin-firestore-database';
import { FirestoreJobRunRepository } from '../infrastructure/firestore/firestore-job-run-repository';
import { FirestoreProcessedEmailRepository } from '../infrastructure/firestore/firestore-processed-email-repository';
import { GmailApiClientFactory } from '../infrastructure/gmail/gmail-api-client-factory';
import { GoogleGmailMailService } from '../infrastructure/gmail/gmail-mail-service';
import { GoogleGmailOAuthProvider } from '../infrastructure/gmail/gmail-oauth-provider';
import { StructuredConsoleLogger } from '../infrastructure/logging/structured-console-logger';
import { NodePop3CommandFactory } from '../infrastructure/pop3/node-pop3-command-factory';
import { NodePop3MailService } from '../infrastructure/pop3/node-pop3-mail-service';
import { Pop3ResponseParser } from '../infrastructure/pop3/pop3-response-parser';
import type { RunEmailTransferJobDependenciesFactoryInterface } from './run-email-transfer-job-dependencies-factory.interface';

export class DefaultRunEmailTransferJobDependenciesFactory implements RunEmailTransferJobDependenciesFactoryInterface {
  public create(config: AppConfig): EmailTransferJobDependencies {
    const logger = new StructuredConsoleLogger();
    const firebaseApp =
      getApps()[0] ??
      initializeApp({
        projectId: config.firebase.projectId,
      });
    const firestoreDatabase = new FirebaseAdminFirestoreDatabase(
      getFirestore(firebaseApp),
    );

    return {
      analyticsTracker: new AmplitudeTrackerService(config.analytics, logger),
      gmailMailService: new GoogleGmailMailService(
        config.gmail,
        new GoogleGmailOAuthProvider(),
        new GmailApiClientFactory(),
      ),
      jobRunRepository: new FirestoreJobRunRepository(firestoreDatabase),
      logger,
      pop3MailService: new NodePop3MailService(
        config.pop3,
        config.job.maxMessagesPerRun,
        new NodePop3CommandFactory(),
        new Pop3ResponseParser(),
      ),
      processedEmailRepository: new FirestoreProcessedEmailRepository(
        firestoreDatabase,
      ),
    };
  }
}
