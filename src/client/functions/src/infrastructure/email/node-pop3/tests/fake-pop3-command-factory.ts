import type { RawEmailMessage } from '../../../../core/email/pop3';
import type { Pop3CommandFactoryInterface } from '../client/pop3-command-factory.interface';
import { FakePop3CommandClient } from './fake-pop3-command-client';

export class FakePop3CommandFactory implements Pop3CommandFactoryInterface {
  public readonly clients: FakePop3CommandClient[] = [];

  public constructor(
    private readonly messages: readonly RawEmailMessage[] = [],
  ) {}

  public create(): FakePop3CommandClient {
    const client = new FakePop3CommandClient(this.messages);

    this.clients.push(client);

    return client;
  }
}
