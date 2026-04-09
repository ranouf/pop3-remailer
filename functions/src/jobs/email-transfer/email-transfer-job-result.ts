import type { JobRunEntity } from '../../core/job-run';

export interface EmailTransferJobResult {
  readonly summary: JobRunEntity;
}
