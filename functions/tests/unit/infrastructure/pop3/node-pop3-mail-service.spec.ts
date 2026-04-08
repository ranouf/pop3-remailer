import { describe, expect, it, vi } from 'vitest';

import {
  SourceProvider,
  type SourceAccount,
} from '../../../../src/jobs/email-transfer/models/source-account';
import { Uidl } from '../../../../src/core/email/uidl';
import { NodePop3MailService } from '../../../../src/infrastructure/email/node-pop3/node-pop3-mail-service';
import type { Pop3CommandClientInterface } from '../../../../src/infrastructure/email/node-pop3/client/pop3-command-client.interface';
import type { Pop3CommandFactoryInterface } from '../../../../src/infrastructure/email/node-pop3/client/pop3-command-factory.interface';

class FakePop3CommandClient implements Pop3CommandClientInterface {
  public readonly commandOrder: string[] = [];
  public connectCalls = 0;
  public listCalls: Array<number | string | undefined> = [];
  public quitCalls = 0;
  public retrCalls: number[] = [];
  public statCalls = 0;
  public uidlCalls: Array<number | string | undefined> = [];
  public connectError: Error | null = null;
  public listError: Error | null = null;
  public retrError: Error | null = null;
  public uidlError: Error | null = null;
  public uidlResponse: string[][] | string[] = [
    ['1', 'uidl-001'],
    ['2', 'uidl-002'],
    ['3', 'uidl-003'],
  ];
  public listResponse: string[][] | string[] = [
    ['1', '100'],
    ['2', '200'],
    ['3', '300'],
  ];
  public retrResponse =
    'From: source@example.com\r\nMessage-ID: <id-3@example.com>\r\n\r\nHello';

  public connect(): Promise<void> {
    this.commandOrder.push('connect');
    this.connectCalls += 1;

    if (this.connectError !== null) {
      return Promise.reject(this.connectError);
    }

    return Promise.resolve();
  }

  public LIST(messageNumber?: string | number): Promise<string[][] | string[]> {
    this.commandOrder.push(
      messageNumber === undefined ? 'LIST' : `LIST ${messageNumber}`,
    );
    this.listCalls.push(messageNumber);

    if (this.listError !== null) {
      return Promise.reject(this.listError);
    }

    if (messageNumber === undefined) {
      return Promise.resolve(this.listResponse);
    }

    const responseEntry = (this.listResponse as string[][]).find(
      ([currentMessageNumber]) => currentMessageNumber === `${messageNumber}`,
    );

    return Promise.resolve(responseEntry ?? [`${messageNumber}`, '444']);
  }

  public QUIT(): Promise<string> {
    this.commandOrder.push('QUIT');
    this.quitCalls += 1;

    return Promise.resolve('OK');
  }

  public STAT(): Promise<string> {
    this.commandOrder.push('STAT');
    this.statCalls += 1;

    return Promise.resolve('3 600');
  }

  public RETR(messageNumber: number): Promise<string> {
    this.commandOrder.push(`RETR ${messageNumber}`);
    this.retrCalls.push(messageNumber);

    if (this.retrError !== null) {
      return Promise.reject(this.retrError);
    }

    return Promise.resolve(this.retrResponse);
  }

  public UIDL(messageNumber?: string | number): Promise<string[][] | string[]> {
    this.commandOrder.push(
      messageNumber === undefined ? 'UIDL' : `UIDL ${messageNumber}`,
    );
    this.uidlCalls.push(messageNumber);

    if (this.uidlError !== null) {
      return Promise.reject(this.uidlError);
    }

    if (messageNumber === undefined) {
      return Promise.resolve(this.uidlResponse);
    }

    return Promise.resolve([`${messageNumber}`, `uidl-00${messageNumber}`]);
  }
}

class FakePop3CommandFactory implements Pop3CommandFactoryInterface {
  public readonly client = new FakePop3CommandClient();

  public create(): Pop3CommandClientInterface {
    return this.client;
  }
}

const sourceAccount: SourceAccount = {
  address: 'source@orange.fr',
  id: 'orange:source@orange.fr',
  provider: SourceProvider.Orange,
  username: 'source@orange.fr',
};

const buildMailSource = (factory: FakePop3CommandFactory) =>
  new NodePop3MailService(
    {
      host: 'pop.orange.fr',
      password: 'secret',
      port: 995,
      timeoutMs: 15000,
      tls: true,
      username: 'source@orange.fr',
    },
    2,
    factory,
  );

describe('infrastructure/pop3/node-pop3-mail-service', () => {
  it('lists POP3 messages, sorts them, and applies the volume limit', async () => {
    const factory = new FakePop3CommandFactory();
    const mailSource = buildMailSource(factory);

    const messages = await mailSource.listMessages(sourceAccount);

    expect(messages).toEqual([
      {
        messageNumber: 3,
        messageSize: 300,
        uidl: Uidl.create('uidl-003'),
      },
      {
        messageNumber: 2,
        messageSize: 200,
        uidl: Uidl.create('uidl-002'),
      },
    ]);
    expect(factory.client.connectCalls).toBe(1);
    expect(factory.client.statCalls).toBe(1);
    expect(factory.client.uidlCalls).toEqual([3, 2]);
    expect(factory.client.listCalls).toEqual([3, 2]);
    expect(factory.client.quitCalls).toBe(1);
  });

  it('retrieves a raw POP3 message without deleting it from the server', async () => {
    const factory = new FakePop3CommandFactory();
    const mailSource = buildMailSource(factory);

    const message = await mailSource.getMessage(sourceAccount, 3);

    expect(message).toEqual({
      messageNumber: 3,
      messageSize: 300,
      rawMessage:
        'From: source@example.com\r\nMessage-ID: <id-3@example.com>\r\n\r\nHello',
      uidl: Uidl.create('uidl-003'),
    });
    expect(factory.client.retrCalls).toEqual([3]);
    expect(factory.client.quitCalls).toBe(1);
  });

  it('executes POP3 commands sequentially on a single connection', async () => {
    const factory = new FakePop3CommandFactory();
    const mailSource = buildMailSource(factory);

    await mailSource.listMessages(sourceAccount);
    await mailSource.getMessage(sourceAccount, 3);

    expect(factory.client.commandOrder).toEqual([
      'connect',
      'STAT',
      'UIDL 3',
      'LIST 3',
      'UIDL 2',
      'LIST 2',
      'QUIT',
      'connect',
      'UIDL 3',
      'LIST 3',
      'RETR 3',
      'QUIT',
    ]);
  });

  it('wraps network connection failures as POP3 connection errors', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.connectError = Object.assign(new Error('socket timeout'), {
      eventName: 'timeout',
    });
    const mailSource = buildMailSource(factory);

    await expect(mailSource.listMessages(sourceAccount)).rejects.toMatchObject({
      category: 'technical',
      code: 'POP3_CONNECTION_FAILED',
      retriable: true,
    });
  });

  it('wraps authentication failures as non-retriable POP3 connection errors', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.connectError = Object.assign(
      new Error('authentication failed'),
      {
        command: 'PASS ******',
      },
    );
    const mailSource = buildMailSource(factory);

    await expect(mailSource.listMessages(sourceAccount)).rejects.toMatchObject({
      category: 'technical',
      code: 'POP3_CONNECTION_FAILED',
      retriable: false,
    });
  });

  it('wraps message listing failures and still closes the POP3 session', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.uidlError = Object.assign(new Error('server disconnected'), {
      eventName: 'close',
    });
    const mailSource = buildMailSource(factory);

    await expect(mailSource.listMessages(sourceAccount)).rejects.toMatchObject({
      category: 'technical',
      code: 'POP3_LIST_FAILED',
      retriable: true,
    });
    expect(factory.client.quitCalls).toBe(1);
  });

  it('wraps message retrieval failures', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.retrError = Object.assign(new Error('timeout during retr'), {
      eventName: 'timeout',
    });
    const mailSource = buildMailSource(factory);

    await expect(mailSource.getMessage(sourceAccount, 3)).rejects.toMatchObject(
      {
        category: 'technical',
        code: 'POP3_RETR_FAILED',
        retriable: true,
      },
    );
  });

  it('wraps malformed POP3 listing responses as POP3 list failures', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.LIST = (messageNumber?: string | number) => {
      factory.client.commandOrder.push(
        messageNumber === undefined ? 'LIST' : `LIST ${messageNumber}`,
      );
      factory.client.listCalls.push(messageNumber);

      if (messageNumber === undefined) {
        return Promise.resolve(factory.client.listResponse);
      }

      return Promise.resolve([`${messageNumber}`, '-1']);
    };
    const mailSource = buildMailSource(factory);

    await expect(mailSource.listMessages(sourceAccount)).rejects.toMatchObject({
      category: 'technical',
      code: 'POP3_LIST_FAILED',
      retriable: false,
    });
  });

  it('returns an empty list when the POP3 mailbox is empty', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.STAT = () => {
      factory.client.commandOrder.push('STAT');
      factory.client.statCalls += 1;
      return Promise.resolve('0 0');
    };
    const mailSource = buildMailSource(factory);

    await expect(mailSource.listMessages(sourceAccount)).resolves.toEqual([]);
    expect(factory.client.uidlCalls).toEqual([]);
    expect(factory.client.listCalls).toEqual([]);
  });

  it('wraps non-POP3 raw retrieval errors as non-retriable POP3 retrieval failures', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.retrError = new Error('unexpected parser issue');
    const mailSource = buildMailSource(factory);

    await expect(mailSource.getMessage(sourceAccount, 3)).rejects.toMatchObject(
      {
        category: 'technical',
        code: 'POP3_RETR_FAILED',
        retriable: false,
      },
    );
  });

  it('ignores QUIT failures after a successful operation', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.QUIT = vi.fn(() => Promise.reject(new Error('quit failed')));
    const mailSource = buildMailSource(factory);

    await expect(mailSource.listMessages(sourceAccount)).resolves.toHaveLength(
      2,
    );
  });
});
