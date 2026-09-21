import type { ProcessedEmailEntity } from '../entities';

export enum UidlClaimStatus {
  Claimed = 'claimed',
  AlreadyImported = 'already_imported',
  AlreadyProcessing = 'already_processing',
}

export class UidlClaimResult {
  public readonly record: ProcessedEmailEntity;
  public readonly status: UidlClaimStatus;

  public constructor(record: ProcessedEmailEntity, status: UidlClaimStatus) {
    this.record = record;
    this.status = status;
  }

  public canTransfer(): boolean {
    return this.status === UidlClaimStatus.Claimed;
  }
}
