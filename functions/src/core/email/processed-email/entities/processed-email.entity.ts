import type { ProcessedEmailMetadata } from '../models';
import type { Uidl } from '../../uidl';

export enum EmailRecordStatus {
  Processing = 'processing',
  Imported = 'imported',
  Failed = 'failed',
}

export enum SourceProvider {
  Orange = 'orange',
  Wanadoo = 'wanadoo',
}

export class ProcessedEmailEntity {
  public readonly createdAt: Date;
  public readonly gmailMessageId?: string;
  public readonly importedAt?: Date;
  public readonly lastError?: string;
  public readonly metadata: ProcessedEmailMetadata;
  public readonly sourceAccountId: string;
  public readonly sourceProvider: SourceProvider;
  public readonly status: EmailRecordStatus;
  public readonly uidl: Uidl;
  public readonly updatedAt: Date;

  public constructor(params: {
    readonly createdAt: Date;
    readonly gmailMessageId?: string;
    readonly importedAt?: Date;
    readonly lastError?: string;
    readonly metadata: ProcessedEmailMetadata;
    readonly sourceAccountId: string;
    readonly sourceProvider: SourceProvider;
    readonly status: EmailRecordStatus;
    readonly uidl: Uidl;
    readonly updatedAt: Date;
  }) {
    this.createdAt = params.createdAt;

    if (params.gmailMessageId !== undefined) {
      this.gmailMessageId = params.gmailMessageId;
    }

    if (params.importedAt !== undefined) {
      this.importedAt = params.importedAt;
    }

    if (params.lastError !== undefined) {
      this.lastError = params.lastError;
    }

    this.metadata = params.metadata;
    this.sourceAccountId = params.sourceAccountId;
    this.sourceProvider = params.sourceProvider;
    this.status = params.status;
    this.uidl = params.uidl;
    this.updatedAt = params.updatedAt;
  }

  public isImported(): boolean {
    return this.status === EmailRecordStatus.Imported;
  }

  public isProcessing(): boolean {
    return this.status === EmailRecordStatus.Processing;
  }
}
