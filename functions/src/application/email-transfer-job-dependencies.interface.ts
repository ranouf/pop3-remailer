/* eslint-disable sort-imports */
import type {
  AnalyticsTracker,
  GmailMailService,
  JobRunRepository,
  Pop3MailService,
  ProcessedEmailRepository,
  StructuredLogger,
} from '../domain/ports';
import type { Clock } from '../shared/operation-context';

export interface EmailTransferJobDependencies {
  readonly analyticsTracker: AnalyticsTracker;
  readonly clock?: Clock;
  readonly gmailMailService: GmailMailService;
  readonly jobRunRepository: JobRunRepository;
  readonly logger: StructuredLogger;
  readonly pop3MailService: Pop3MailService;
  readonly processedEmailRepository: ProcessedEmailRepository;
}
