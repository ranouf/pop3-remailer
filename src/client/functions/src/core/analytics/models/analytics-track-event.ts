export enum TransferEventName {
  JobStarted = 'job_started',
  JobFinished = 'job_finished',
  JobDurationRecorded = 'job_duration_recorded',
  EmailDetected = 'email_detected',
  EmailSkippedAlreadyProcessed = 'email_skipped_already_processed',
  EmailTransferStarted = 'email_transfer_started',
  EmailTransferred = 'email_transferred',
  EmailTransferFailed = 'email_transfer_failed',
  EmailProcessingFailed = 'email_processing_failed',
  Pop3ConnectionFailed = 'pop3_connection_failed',
  GmailImportFailed = 'gmail_import_failed',
}

export type TrackerEventProperties = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

export class AnalyticsTrackEvent {
  public readonly eventName: TransferEventName;
  public readonly properties: TrackerEventProperties;

  public constructor(
    eventName: TransferEventName,
    properties: TrackerEventProperties,
  ) {
    this.eventName = eventName;
    this.properties = properties;
  }
}
