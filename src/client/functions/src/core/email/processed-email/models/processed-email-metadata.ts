export class ProcessedEmailMetadata {
  public readonly claimJobId?: string;
  public readonly messageId?: string;
  public readonly messageNumber?: number;
  public readonly messageSize?: number;

  public constructor(
    params: {
      readonly claimJobId?: string;
      readonly messageId?: string;
      readonly messageNumber?: number;
      readonly messageSize?: number;
    } = {},
  ) {
    if (params.claimJobId !== undefined) {
      this.claimJobId = params.claimJobId;
    }

    if (params.messageId !== undefined) {
      this.messageId = params.messageId;
    }

    if (params.messageNumber !== undefined) {
      this.messageNumber = params.messageNumber;
    }

    if (params.messageSize !== undefined) {
      this.messageSize = params.messageSize;
    }
  }

  public mergeWith(overrides: ProcessedEmailMetadata): ProcessedEmailMetadata {
    return new ProcessedEmailMetadata({
      ...(this.claimJobId === undefined
        ? {}
        : {
            claimJobId: this.claimJobId,
          }),
      ...(this.messageId === undefined
        ? {}
        : {
            messageId: this.messageId,
          }),
      ...(this.messageNumber === undefined
        ? {}
        : {
            messageNumber: this.messageNumber,
          }),
      ...(this.messageSize === undefined
        ? {}
        : {
            messageSize: this.messageSize,
          }),
      ...(overrides.claimJobId === undefined
        ? {}
        : {
            claimJobId: overrides.claimJobId,
          }),
      ...(overrides.messageId === undefined
        ? {}
        : {
            messageId: overrides.messageId,
          }),
      ...(overrides.messageNumber === undefined
        ? {}
        : {
            messageNumber: overrides.messageNumber,
          }),
      ...(overrides.messageSize === undefined
        ? {}
        : {
            messageSize: overrides.messageSize,
          }),
    });
  }

  public withClaimJobId(claimJobId: string): ProcessedEmailMetadata {
    return new ProcessedEmailMetadata({
      ...(this.messageId === undefined
        ? {}
        : {
            messageId: this.messageId,
          }),
      ...(this.messageNumber === undefined
        ? {}
        : {
            messageNumber: this.messageNumber,
          }),
      ...(this.messageSize === undefined
        ? {}
        : {
            messageSize: this.messageSize,
          }),
      claimJobId,
    });
  }
}
