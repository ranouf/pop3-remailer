/* eslint-disable sort-imports */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NodePop3CommandFactory } from '../../../../src/infrastructure/pop3/node-pop3-command-factory';

const { pop3ConstructorMock } = vi.hoisted(() => ({
  pop3ConstructorMock: vi.fn(),
}));
const rawClient = {
  LIST: vi.fn(() => Promise.resolve(['1', '123'])),
  QUIT: vi.fn(() => Promise.resolve('OK')),
  RETR: vi.fn(() => Promise.resolve('raw-message')),
  UIDL: vi.fn(() => Promise.resolve(['1', 'uidl-001'])),
  connect: vi.fn(() => Promise.resolve()),
};

vi.mock('node-pop3', () => ({
  default: pop3ConstructorMock,
}));

describe('infrastructure/pop3/node-pop3-command-factory', () => {
  beforeEach(() => {
    pop3ConstructorMock.mockReset();
    rawClient.LIST.mockClear();
    rawClient.QUIT.mockClear();
    rawClient.RETR.mockClear();
    rawClient.UIDL.mockClear();
    rawClient.connect.mockClear();
    pop3ConstructorMock.mockImplementation(() => rawClient);
  });

  it('creates a node-pop3 client with secure POP3 settings', () => {
    const factory = new NodePop3CommandFactory();

    const client = factory.create({
      host: 'pop.orange.fr',
      password: 'secret',
      port: 995,
      timeoutMs: 15000,
      tls: true,
      username: 'user@orange.fr',
    });

    expect(pop3ConstructorMock).toHaveBeenCalledWith({
      host: 'pop.orange.fr',
      password: 'secret',
      port: 995,
      servername: 'pop.orange.fr',
      timeout: 15000,
      tls: true,
      user: 'user@orange.fr',
    });
    expect(typeof client.LIST).toBe('function');
    expect(typeof client.QUIT).toBe('function');
    expect(typeof client.RETR).toBe('function');
    expect(typeof client.UIDL).toBe('function');
    expect(typeof client.connect).toBe('function');

    void client.connect();
    void client.UIDL(1);
    void client.LIST(1);
    void client.RETR(1);
    void client.QUIT();

    expect(rawClient.connect).toHaveBeenCalledTimes(1);
    expect(rawClient.UIDL).toHaveBeenCalledWith(1);
    expect(rawClient.LIST).toHaveBeenCalledWith(1);
    expect(rawClient.RETR).toHaveBeenCalledWith(1);
    expect(rawClient.QUIT).toHaveBeenCalledTimes(1);
  });
});
