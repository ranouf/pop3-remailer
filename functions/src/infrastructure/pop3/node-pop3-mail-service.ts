import type { AppConfig } from '../../config/environment';
import type {
  Pop3MessageMetadata,
  RawEmailMessage,
  SourceAccount,
} from '../../domain/email';
import {
  TransferJobError,
  isTransferJobError,
  toTransferJobError,
} from '../../domain/errors';
import type { Pop3MailService } from '../../domain/ports';
import { retry } from '../../shared/retry';
import type { Pop3CommandClientInterface } from './pop3-command-client.interface';
import type { Pop3CommandFactoryInterface } from './pop3-command-factory.interface';
import { Pop3ResponseParser } from './pop3-response-parser';

export class NodePop3MailService implements Pop3MailService {
  private readonly maxMessagesPerRun: number;
  private readonly pop3CommandFactory: Pop3CommandFactoryInterface;
  private readonly pop3Config: AppConfig['pop3'];
  private readonly responseParser: Pop3ResponseParser;

  public constructor(
    pop3Config: AppConfig['pop3'],
    maxMessagesPerRun: number,
    pop3CommandFactory: Pop3CommandFactoryInterface,
    responseParser: Pop3ResponseParser = new Pop3ResponseParser(),
  ) {
    this.pop3Config = pop3Config;
    this.maxMessagesPerRun = maxMessagesPerRun;
    this.pop3CommandFactory = pop3CommandFactory;
    this.responseParser = responseParser;
  }

  public async getMessage(
    sourceAccount: SourceAccount,
    messageNumber: number,
  ): Promise<RawEmailMessage> {
    return this.withClient(async (client) => {
      try {
        const uidlResponse = await retry(() => client.UIDL(messageNumber), {
          fallbackError: {
            category: 'technical',
            code: 'POP3_RETR_FAILED',
            details: {
              messageNumber,
              sourceAccountId: sourceAccount.id,
            },
            message: 'Failed to read POP3 UIDL for a message.',
            retriable: true,
          },
          policy: this.buildRetryPolicy(),
          isRetryable: (error) => this.isRetriablePop3Error(error),
        });
        const listResponse = await retry(() => client.LIST(messageNumber), {
          fallbackError: {
            category: 'technical',
            code: 'POP3_RETR_FAILED',
            details: {
              messageNumber,
              sourceAccountId: sourceAccount.id,
            },
            message: 'Failed to read POP3 size for a message.',
            retriable: true,
          },
          policy: this.buildRetryPolicy(),
          isRetryable: (error) => this.isRetriablePop3Error(error),
        });
        const rawMessage = await retry(() => client.RETR(messageNumber), {
          fallbackError: {
            category: 'technical',
            code: 'POP3_RETR_FAILED',
            details: {
              messageNumber,
              sourceAccountId: sourceAccount.id,
            },
            message: 'Failed to retrieve a POP3 message.',
            retriable: true,
          },
          policy: this.buildRetryPolicy(),
          isRetryable: (error) => this.isRetriablePop3Error(error),
        });

        const uidlEntry = this.responseParser.parseUidlEntry(uidlResponse);
        const sizeEntry = this.responseParser.parseListSizeEntry(listResponse);

        return {
          messageNumber,
          messageSize: sizeEntry.messageSize,
          rawMessage,
          uidl: uidlEntry.uidl,
        };
      } catch (error) {
        throw this.toPop3Error(error, {
          code: 'POP3_RETR_FAILED',
          details: {
            messageNumber,
            sourceAccountId: sourceAccount.id,
          },
          message: 'Failed to retrieve a POP3 message.',
        });
      }
    }, sourceAccount);
  }

  public async listMessages(
    sourceAccount: SourceAccount,
  ): Promise<readonly Pop3MessageMetadata[]> {
    return this.withClient(async (client) => {
      try {
        const uidlResponse = await retry(() => client.UIDL(), {
          fallbackError: {
            category: 'technical',
            code: 'POP3_LIST_FAILED',
            details: {
              sourceAccountId: sourceAccount.id,
            },
            message: 'Failed to list POP3 UIDLs.',
            retriable: true,
          },
          policy: this.buildRetryPolicy(),
          isRetryable: (error) => this.isRetriablePop3Error(error),
        });
        const listResponse = await retry(() => client.LIST(), {
          fallbackError: {
            category: 'technical',
            code: 'POP3_LIST_FAILED',
            details: {
              sourceAccountId: sourceAccount.id,
            },
            message: 'Failed to list POP3 message sizes.',
            retriable: true,
          },
          policy: this.buildRetryPolicy(),
          isRetryable: (error) => this.isRetriablePop3Error(error),
        });

        const metadata = this.buildMetadataMap(
          this.responseParser.parseListEntries(uidlResponse),
          this.responseParser.parseListEntries(listResponse),
        );

        return [...metadata]
          .sort((left, right) => right.messageNumber - left.messageNumber)
          .slice(0, this.maxMessagesPerRun);
      } catch (error) {
        throw this.toPop3Error(error, {
          code: 'POP3_LIST_FAILED',
          details: {
            sourceAccountId: sourceAccount.id,
          },
          message: 'Failed to list POP3 messages.',
        });
      }
    }, sourceAccount);
  }

  private buildMetadataMap(
    uidlEntries: readonly {
      readonly messageNumber: number;
      readonly value: string;
    }[],
    listEntries: readonly {
      readonly messageNumber: number;
      readonly value: string;
    }[],
  ): readonly Pop3MessageMetadata[] {
    const sizeByMessageNumber = new Map<number, number>();

    for (const entry of listEntries) {
      const parsedSize = Number.parseInt(entry.value, 10);

      if (!Number.isInteger(parsedSize) || parsedSize < 0) {
        throw new Error(`Invalid POP3 message size: ${entry.value}`);
      }

      sizeByMessageNumber.set(entry.messageNumber, parsedSize);
    }

    return uidlEntries.map((entry) => ({
      messageNumber: entry.messageNumber,
      messageSize: sizeByMessageNumber.get(entry.messageNumber) ?? 0,
      uidl: this.responseParser.parseUidlEntry([
        [`${entry.messageNumber}`, entry.value],
      ]).uidl,
    }));
  }

  private buildRetryPolicy(): {
    readonly backoffMultiplier: number;
    readonly initialDelayMs: number;
    readonly maxAttempts: number;
    readonly maxDelayMs: number;
  } {
    return {
      backoffMultiplier: 2,
      initialDelayMs: 250,
      maxAttempts: 3,
      maxDelayMs: this.pop3Config.timeoutMs,
    };
  }

  private isAuthenticationError(error: unknown): boolean {
    const candidate = this.unwrapPop3Error(error);

    if (!(candidate instanceof Error)) {
      return false;
    }

    const message = candidate.message.toLowerCase();
    const command = `${Reflect.get(candidate, 'command') ?? ''}`.toLowerCase();

    return (
      message.includes('auth') ||
      message.includes('login') ||
      message.includes('invalid password') ||
      message.includes('authentication failed') ||
      command.startsWith('user') ||
      command.startsWith('pass')
    );
  }

  private isRetriablePop3Error(error: unknown): boolean {
    const candidate = this.unwrapPop3Error(error);

    if (!(candidate instanceof Error)) {
      return false;
    }

    const eventName =
      `${Reflect.get(candidate, 'eventName') ?? ''}`.toLowerCase();

    return (
      eventName === 'timeout' ||
      eventName === 'error' ||
      eventName === 'close' ||
      eventName === 'end' ||
      eventName === 'bad-server-response'
    );
  }

  private toPop3Error(
    error: unknown,
    fallback: {
      readonly code: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly message: string;
    },
  ): TransferJobError {
    const retriable = this.isAuthenticationError(error)
      ? false
      : this.isRetriablePop3Error(error);

    if (isTransferJobError(error)) {
      return new TransferJobError(fallback.message, {
        category: 'technical',
        code: fallback.code,
        details: fallback.details,
        retriable,
        cause: error.cause ?? error,
      });
    }

    return toTransferJobError(error, {
      category: 'technical',
      code: fallback.code,
      details: fallback.details,
      message: fallback.message,
      retriable,
    });
  }

  private unwrapPop3Error(error: unknown): unknown {
    return isTransferJobError(error) && error.cause !== undefined
      ? error.cause
      : error;
  }

  private async withClient<T>(
    operation: (client: Pop3CommandClientInterface) => Promise<T>,
    sourceAccount: SourceAccount,
  ): Promise<T> {
    const client = this.pop3CommandFactory.create(this.pop3Config);

    try {
      await retry(() => client.connect(), {
        fallbackError: {
          category: 'technical',
          code: 'POP3_CONNECTION_FAILED',
          details: {
            host: this.pop3Config.host,
            sourceAccountId: sourceAccount.id,
            tls: this.pop3Config.tls,
          },
          message: 'Failed to connect to the POP3 server.',
          retriable: true,
        },
        policy: this.buildRetryPolicy(),
        isRetryable: (error) => this.isRetriablePop3Error(error),
      });
    } catch (error) {
      throw this.toPop3Error(error, {
        code: 'POP3_CONNECTION_FAILED',
        details: {
          host: this.pop3Config.host,
          sourceAccountId: sourceAccount.id,
          tls: this.pop3Config.tls,
        },
        message: 'Failed to connect to the POP3 server.',
      });
    }

    try {
      return await operation(client);
    } finally {
      try {
        await client.QUIT();
      } catch {
        // Ignore QUIT failures because the main operation already completed.
      }
    }
  }
}
