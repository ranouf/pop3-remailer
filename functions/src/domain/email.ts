import type { Uidl } from './uidl';

export const sourceProviders = ['orange', 'wanadoo'] as const;

export type SourceProvider = (typeof sourceProviders)[number];

export const emailRecordStatuses = [
  'processing',
  'imported',
  'failed',
] as const;

export type EmailRecordStatus = (typeof emailRecordStatuses)[number];

export interface SourceAccount {
  readonly address: string;
  readonly id: string;
  readonly provider: SourceProvider;
  readonly username: string;
}

export interface Pop3MessageMetadata {
  readonly messageId?: string;
  readonly messageNumber: number;
  readonly messageSize: number;
  readonly uidl: Uidl;
}

export interface RawEmailMessage extends Pop3MessageMetadata {
  readonly rawMessage: string;
}

export const createSourceAccountId = (
  provider: SourceProvider,
  address: string,
): string => `${provider}:${address.trim().toLowerCase()}`;

export const isTerminalEmailRecordStatus = (
  status: EmailRecordStatus,
): boolean => status !== 'processing';
