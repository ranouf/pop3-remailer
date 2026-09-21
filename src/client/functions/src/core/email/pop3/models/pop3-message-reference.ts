import type { Uidl } from '../../uidl';

export class Pop3MessageReference {
  public readonly messageNumber: number;
  public readonly uidl: Uidl;

  public constructor(params: {
    readonly messageNumber: number;
    readonly uidl: Uidl;
  }) {
    this.messageNumber = params.messageNumber;
    this.uidl = params.uidl;
  }
}
