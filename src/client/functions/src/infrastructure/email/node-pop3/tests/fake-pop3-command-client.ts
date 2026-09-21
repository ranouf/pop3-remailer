import type { Pop3CommandClientInterface } from '../client/pop3-command-client.interface';
import type { RawEmailMessage } from '../../../../core/email/pop3';

export class FakePop3CommandClient implements Pop3CommandClientInterface {
  public constructor(private readonly messages: readonly RawEmailMessage[]) {}

  public LIST(messageNumber?: number | string): Promise<string[][] | string[]> {
    if (messageNumber !== undefined) {
      const message = this.findMessage(messageNumber);

      return Promise.resolve([
        String(message.messageNumber),
        String(message.messageSize),
      ]);
    }

    return Promise.resolve(
      this.messages.map((message) => [
        String(message.messageNumber),
        String(message.messageSize),
      ]),
    );
  }

  public QUIT(): Promise<string> {
    return Promise.resolve('+OK');
  }

  public RETR(messageNumber: number): Promise<string> {
    return Promise.resolve(this.findMessage(messageNumber).rawMessage);
  }

  public STAT(): Promise<string> {
    const totalSize = this.messages.reduce(
      (sum, message) => sum + message.messageSize,
      0,
    );

    return Promise.resolve(`${this.messages.length} ${totalSize}`);
  }

  public UIDL(messageNumber?: number | string): Promise<string[][] | string[]> {
    if (messageNumber !== undefined) {
      const message = this.findMessage(messageNumber);

      return Promise.resolve([
        String(message.messageNumber),
        message.uidl.toString(),
      ]);
    }

    return Promise.resolve(
      this.messages.map((message) => [
        String(message.messageNumber),
        message.uidl.toString(),
      ]),
    );
  }

  public async connect(): Promise<void> {
    return Promise.resolve();
  }

  private findMessage(messageNumber: number | string): RawEmailMessage {
    const parsedMessageNumber =
      typeof messageNumber === 'number'
        ? messageNumber
        : Number.parseInt(messageNumber, 10);
    const message = this.messages.find(
      (entry) => entry.messageNumber === parsedMessageNumber,
    );

    if (message === undefined) {
      throw new Error(`POP3 message ${messageNumber} was not configured.`);
    }

    return message;
  }
}
