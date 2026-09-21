# Amplitude Tracking

## Purpose

Amplitude is used for operational observability, not for end-user analytics.

## Tracked events

- `job_started`
- `job_finished`
- `job_duration_recorded`
- `email_detected`
- `email_skipped_already_processed`
- `email_transfer_started`
- `email_transferred`
- `email_transfer_failed`
- `email_processing_failed`
- `pop3_connection_failed`
- `gmail_import_failed`

## Common properties

- `jobId`
- `executionTime`
- `durationMs`
- `uidl`
- `messageSize`
- `processedCount`
- `transferredCount`
- `skippedCount`
- `failedCount`
- `provider`
- `environment`

## Implementation notes

- The analytics service is abstracted behind the domain `AnalyticsTracker`
  contract.
- The Amplitude implementation is non-blocking from the job point of view.
- Failures in Amplitude are logged as warnings and do not fail the transfer job.
