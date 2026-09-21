import {
  HealthCheckName,
  HealthCheckStatus,
} from '../../../../src/core/health-check/models';
import { TransferJobError } from '../../../../src/core/operation-error';
import { Pop3ConnectivityHealthChecker } from '../../../../src/infrastructure/email/node-pop3/healthchecks/pop3-health-checker';
import type { Pop3CommandClientInterface } from '../../../../src/infrastructure/email/node-pop3/client/pop3-command-client.interface';
import type { Pop3CommandFactoryInterface } from '../../../../src/infrastructure/email/node-pop3/client/pop3-command-factory.interface';

class FakePop3CommandClient implements Pop3CommandClientInterface {
  public connectError: Error | null = null;
  public quitError: Error | null = null;
  public quitCalls = 0;

  public LIST(): Promise<string[][]> {
    return Promise.resolve([]);
  }

  public QUIT(): Promise<string> {
    this.quitCalls += 1;

    if (this.quitError !== null) {
      return Promise.reject(this.quitError);
    }

    return Promise.resolve('+OK');
  }

  public RETR(): Promise<string> {
    return Promise.resolve('');
  }

  public STAT(): Promise<string> {
    return Promise.resolve('0 0');
  }

  public UIDL(): Promise<string[][]> {
    return Promise.resolve([]);
  }

  public connect(): Promise<void> {
    if (this.connectError !== null) {
      return Promise.reject(this.connectError);
    }

    return Promise.resolve();
  }
}

class FakePop3CommandFactory implements Pop3CommandFactoryInterface {
  public readonly client = new FakePop3CommandClient();

  public create(): Pop3CommandClientInterface {
    return this.client;
  }
}

describe('infrastructure/pop3/pop3-health-checker', () => {
  it('returns a healthy status when POP3 authentication succeeds', async () => {
    const factory = new FakePop3CommandFactory();
    const checker = new Pop3ConnectivityHealthChecker(
      {
        host: 'pop.orange.fr',
        password: 'secret',
        port: 995,
        timeoutMs: 15000,
        tls: true,
        username: 'user',
      },
      {
        clock: {
          now: () => new Date('2026-04-02T10:00:00.000Z'),
        },
        commandFactory: factory,
      },
    );

    await expect(checker.check()).resolves.toEqual({
      checkedAt: new Date('2026-04-02T10:00:00.000Z'),
      message: 'POP3 connection and authentication succeeded.',
      name: HealthCheckName.Pop3,
      status: HealthCheckStatus.Healthy,
    });
    expect(factory.client.quitCalls).toBe(1);
  });

  it('wraps POP3 failures into a typed technical error', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.connectError = new Error('Authentication failed.');
    const checker = new Pop3ConnectivityHealthChecker(
      {
        host: 'pop.orange.fr',
        password: 'secret',
        port: 995,
        timeoutMs: 15000,
        tls: true,
        username: 'user',
      },
      {
        commandFactory: factory,
      },
    );

    const error = await checker
      .check()
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(TransferJobError);

    if (!(error instanceof TransferJobError)) {
      return;
    }

    expect(error.code).toBe('POP3_HEALTHCHECK_FAILED');
    expect(error.message).toBe('Failed to validate POP3 connectivity.');
  });

  it('keeps a healthy result even when QUIT fails after a successful connect', async () => {
    const factory = new FakePop3CommandFactory();
    factory.client.quitError = new Error('socket closed during quit');
    const checker = new Pop3ConnectivityHealthChecker(
      {
        host: 'pop.orange.fr',
        password: 'secret',
        port: 995,
        timeoutMs: 15000,
        tls: true,
        username: 'user',
      },
      {
        commandFactory: factory,
      },
    );

    await expect(checker.check()).resolves.toMatchObject({
      message: 'POP3 connection and authentication succeeded.',
      name: HealthCheckName.Pop3,
      status: HealthCheckStatus.Healthy,
    });
    expect(factory.client.quitCalls).toBe(1);
  });
});
