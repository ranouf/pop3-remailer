import type { JobRunSummary } from '../../domain/job-run';

export interface EmailTransferJobResult {
  readonly summary: JobRunSummary;
}
