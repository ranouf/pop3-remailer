import type { Uidl } from '../../uidl';
import { Pop3MessageMetadata } from './pop3-message-metadata';

export class RawEmailMessage extends Pop3MessageMetadata {
  public readonly rawMessage: string;

  public constructor(params: {
    readonly messageId?: string;
    readonly messageNumber: number;
    readonly messageSize: number;
    readonly rawMessage: string;
    readonly uidl: Uidl;
  }) {
    super({
      ...(params.messageId === undefined
        ? {}
        : {
            messageId: params.messageId,
          }),
      messageNumber: params.messageNumber,
      messageSize: params.messageSize,
      uidl: params.uidl,
    });
    this.rawMessage = params.rawMessage;
  }
}
