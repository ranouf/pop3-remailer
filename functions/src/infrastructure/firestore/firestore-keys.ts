import type { Uidl } from '../../domain/uidl';

export const processedEmailsCollectionName = 'processedEmails';
export const jobRunsCollectionName = 'jobRuns';

export const createProcessedEmailDocumentId = (
  sourceAccountId: string,
  uidl: Uidl,
): string =>
  Buffer.from(`${sourceAccountId}\u0000${uidl}`, 'utf8').toString('base64url');
