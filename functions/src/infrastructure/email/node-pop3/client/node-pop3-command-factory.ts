import Pop3Command from 'node-pop3';

import type { ApplicationConfiguration } from '../../../../core/configuration/models/application-configuration';
import type { Pop3CommandClientInterface } from './pop3-command-client.interface';
import type { Pop3CommandFactoryInterface } from './pop3-command-factory.interface';

export class NodePop3CommandFactory implements Pop3CommandFactoryInterface {
  public create(
    config: ApplicationConfiguration['pop3'],
  ): Pop3CommandClientInterface {
    const client = new Pop3Command({
      host: config.host,
      password: config.password,
      port: config.port,
      servername: config.host,
      timeout: config.timeoutMs,
      tls: config.tls,
      user: config.username,
    });

    return {
      LIST: async (messageNumber) => client.LIST(messageNumber),
      QUIT: async () => client.QUIT(),
      RETR: async (messageNumber) => client.RETR(messageNumber),
      UIDL: async (messageNumber) => client.UIDL(messageNumber),
      connect: async () => {
        await this.connectAndAuthenticate(client);
      },
    };
  }

  private async connectAndAuthenticate(
    client: Pop3Command & {
      _connect?: () => Promise<string>;
    },
  ): Promise<void> {
    if (typeof client._connect === 'function') {
      await client._connect();
      return;
    }

    await client.connect();
  }
}
