import type { JobRunSummary } from './job-run';
import type { Uidl } from './uidl';
import type {
  Pop3MessageMetadata,
  RawEmailMessage,
  SourceAccount,
} from './email';
import type {
  ProcessedEmailMetadata,
  ProcessedEmailRecord,
  UidlClaimResult,
} from './processed-email';

export const transferEventNames = [
  'job_started',
  'job_finished',
  'job_duration_recorded',
  'email_detected',
  'email_skipped_already_processed',
  'email_transfer_started',
  'email_transferred',
  'email_transfer_failed',
  'email_processing_failed',
  'pop3_connection_failed',
  'gmail_import_failed',
] as const;

export type TransferEventName = (typeof transferEventNames)[number];

export interface TrackerEventProperties {
  readonly [key: string]: string | number | boolean | null | undefined;
}

export interface AnalyticsTracker {
  flush(): Promise<void>;
  track(
    eventName: TransferEventName,
    properties: TrackerEventProperties,
  ): Promise<void>;
}

export interface StructuredLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export interface GmailImportResult {
  readonly gmailMessageId?: string;
  readonly gmailThreadId?: string;
}

export interface GmailImportedMessageLookup {
  readonly gmailMessageId: string;
}

export interface GmailMailTarget {
  findImportedMessageByRfc822MessageId(
    gmailUserEmail: string,
    rfc822MessageId: string,
  ): Promise<GmailImportedMessageLookup | null>;
  importMessage(
    gmailUserEmail: string,
    message: RawEmailMessage,
  ): Promise<GmailImportResult>;
}

export interface Pop3MailSource {
  getMessage(
    sourceAccount: SourceAccount,
    messageNumber: number,
  ): Promise<RawEmailMessage>;
  listMessages(
    sourceAccount: SourceAccount,
  ): Promise<readonly Pop3MessageMetadata[]>;
}

export interface ProcessedEmailRepository {
  claimForProcessing(params: {
    readonly jobId: string;
    readonly metadata: ProcessedEmailMetadata;
    readonly sourceAccount: SourceAccount;
    readonly uidl: Uidl;
  }): Promise<UidlClaimResult>;
  findByUidl(
    sourceAccountId: string,
    uidl: Uidl,
  ): Promise<ProcessedEmailRecord | null>;
  markFailed(params: {
    readonly jobId: string;
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
    readonly errorMessage: string;
  }): Promise<void>;
  markImported(params: {
    readonly sourceAccountId: string;
    readonly uidl: Uidl;
    readonly gmailMessageId?: string;
  }): Promise<void>;
}

export interface JobRunRepository {
  saveFinished(summary: JobRunSummary): Promise<void>;
  saveStarted(summary: JobRunSummary): Promise<void>;
}
