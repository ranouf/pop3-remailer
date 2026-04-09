import type { Uidl } from '../../core/email/uidl';

export const processedEmailsCollectionName = 'processedEmails';
export const jobRunsCollectionName = 'jobRuns';
export const jobRunStatisticsCollectionName = 'jobRunStatistics';
export const operationsHealthChecksCollectionName = 'operationsHealthChecks';

export const createProcessedEmailDocumentId = (
  sourceAccountId: string,
  uidl: Uidl,
): string =>
  Buffer.from(`${sourceAccountId}\u0000${uidl.toString()}`, 'utf8').toString(
    'base64url',
  );
