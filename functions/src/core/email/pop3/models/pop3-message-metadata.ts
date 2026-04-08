import type { Uidl } from '../../uidl';

export class Pop3MessageMetadata {
  public readonly messageId?: string;
  public readonly messageNumber: number;
  public readonly messageSize: number;
  public readonly uidl: Uidl;

  public constructor(params: {
    readonly messageId?: string;
    readonly messageNumber: number;
    readonly messageSize: number;
    readonly uidl: Uidl;
  }) {
    if (params.messageId !== undefined) {
      this.messageId = params.messageId;
    }

    this.messageNumber = params.messageNumber;
    this.messageSize = params.messageSize;
    this.uidl = params.uidl;
  }
}
