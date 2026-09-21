import {
  DelegateBackoff,
  handleWhen,
  retry as createRetryPolicy,
} from 'cockatiel';
import type { ApplicationConfiguration } from '../../../core/configuration/models/application-configuration';
import {
  Pop3MessageMetadata,
  Pop3MessageReference,
  RawEmailMessage,
  type Pop3MailServiceInterface,
} from '../../../core/email/pop3';
import type { SourceAccount } from '../../../jobs/email-transfer/models/source-account';
import {
  JobErrorCategory,
  OperationErrorHelper,
  TransferJobError,
} from '../../../core/operation-error';
import type { Pop3CommandClientInterface } from './client/pop3-command-client.interface';
import type { Pop3CommandFactoryInterface } from './client/pop3-command-factory.interface';
import { Pop3ResponseParser } from './parser/pop3-response-parser';

export class NodePop3MailService implements Pop3MailServiceInterface {
  private readonly maxMessagesPerRun: number;
  private readonly pop3CommandFactory: Pop3CommandFactoryInterface;
  private readonly pop3Config: ApplicationConfiguration['pop3'];
  private readonly responseParser: Pop3ResponseParser;

  public constructor(
    pop3Config: ApplicationConfiguration['pop3'],
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
        const uidlResponse = await this.executeWithRetry(
          () => client.UIDL(messageNumber),
          {
            fallbackError: {
              category: JobErrorCategory.Technical,
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
          },
        );
        const listResponse = await this.executeWithRetry(
          () => client.LIST(messageNumber),
          {
            fallbackError: {
              category: JobErrorCategory.Technical,
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
          },
        );
        const rawMessage = await this.executeWithRetry(
          () => client.RETR(messageNumber),
          {
            fallbackError: {
              category: JobErrorCategory.Technical,
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
          },
        );

        const uidlEntry = this.responseParser.parseUidlEntry(uidlResponse);
        const sizeEntry = this.responseParser.parseListSizeEntry(listResponse);

        return new RawEmailMessage({
          messageNumber,
          messageSize: sizeEntry.messageSize,
          rawMessage,
          uidl: uidlEntry.uidl,
        });
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

  public async getMessageMetadata(
    sourceAccount: SourceAccount,
    messageNumber: number,
  ): Promise<Pop3MessageMetadata> {
    return this.withClient(async (client) => {
      try {
        const uidlResponse = await this.executeWithRetry(
          () => client.UIDL(messageNumber),
          {
            fallbackError: {
              category: JobErrorCategory.Technical,
              code: 'POP3_LIST_FAILED',
              details: {
                messageNumber,
                sourceAccountId: sourceAccount.id,
              },
              message: 'Failed to read POP3 UIDL for a message.',
              retriable: true,
            },
            policy: this.buildRetryPolicy(),
            isRetryable: (error) => this.isRetriablePop3Error(error),
          },
        );
        const listResponse = await this.executeWithRetry(
          () => client.LIST(messageNumber),
          {
            fallbackError: {
              category: JobErrorCategory.Technical,
              code: 'POP3_LIST_FAILED',
              details: {
                messageNumber,
                sourceAccountId: sourceAccount.id,
              },
              message: 'Failed to read POP3 size for a message.',
              retriable: true,
            },
            policy: this.buildRetryPolicy(),
            isRetryable: (error) => this.isRetriablePop3Error(error),
          },
        );
        const uidlEntry = this.responseParser.parseUidlEntry(uidlResponse);
        const sizeEntry = this.responseParser.parseListSizeEntry(listResponse);

        return new Pop3MessageMetadata({
          messageNumber,
          messageSize: sizeEntry.messageSize,
          uidl: uidlEntry.uidl,
        });
      } catch (error) {
        throw this.toPop3Error(error, {
          code: 'POP3_LIST_FAILED',
          details: {
            messageNumber,
            sourceAccountId: sourceAccount.id,
          },
          message: 'Failed to read POP3 metadata for a message.',
        });
      }
    }, sourceAccount);
  }

  public async listMessages(
    sourceAccount: SourceAccount,
    options: {
      readonly limit?: number;
    } = {},
  ): Promise<readonly Pop3MessageMetadata[]> {
    return this.withClient(async (client) => {
      try {
        const requestedLimit = Math.max(
          0,
          Math.min(
            options.limit ?? this.maxMessagesPerRun,
            this.maxMessagesPerRun,
          ),
        );

        if (requestedLimit === 0) {
          return [];
        }

        const statResponse = await this.executeWithRetry(() => client.STAT(), {
          fallbackError: {
            category: JobErrorCategory.Technical,
            code: 'POP3_LIST_FAILED',
            details: {
              sourceAccountId: sourceAccount.id,
            },
            message: 'Failed to read POP3 mailbox statistics.',
            retriable: true,
          },
          policy: this.buildRetryPolicy(),
          isRetryable: (error) => this.isRetriablePop3Error(error),
        });
        const totalMessageCount = this.parseMessageCount(statResponse);

        if (totalMessageCount === 0) {
          return [];
        }

        const metadata: Pop3MessageMetadata[] = [];

        for (const messageNumber of this.buildRecentMessageNumbers(
          totalMessageCount,
          requestedLimit,
        )) {
          const uidlResponse = await this.executeWithRetry(
            () => client.UIDL(messageNumber),
            {
              fallbackError: {
                category: JobErrorCategory.Technical,
                code: 'POP3_LIST_FAILED',
                details: {
                  messageNumber,
                  sourceAccountId: sourceAccount.id,
                },
                message: 'Failed to read POP3 UIDL for a message.',
                retriable: true,
              },
              policy: this.buildRetryPolicy(),
              isRetryable: (error) => this.isRetriablePop3Error(error),
            },
          );
          const listResponse = await this.executeWithRetry(
            () => client.LIST(messageNumber),
            {
              fallbackError: {
                category: JobErrorCategory.Technical,
                code: 'POP3_LIST_FAILED',
                details: {
                  messageNumber,
                  sourceAccountId: sourceAccount.id,
                },
                message: 'Failed to read POP3 size for a message.',
                retriable: true,
              },
              policy: this.buildRetryPolicy(),
              isRetryable: (error) => this.isRetriablePop3Error(error),
            },
          );
          const uidlEntry = this.responseParser.parseUidlEntry(uidlResponse);
          const sizeEntry =
            this.responseParser.parseListSizeEntry(listResponse);

          metadata.push(
            new Pop3MessageMetadata({
              messageNumber,
              messageSize: sizeEntry.messageSize,
              uidl: uidlEntry.uidl,
            }),
          );
        }

        return metadata.sort(
          (left, right) => right.messageNumber - left.messageNumber,
        );
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

  public async listMessageReferences(
    sourceAccount: SourceAccount,
    options: {
      readonly limit?: number;
    } = {},
  ): Promise<readonly Pop3MessageReference[]> {
    return this.withClient(async (client) => {
      try {
        const requestedLimit = Math.max(
          0,
          Math.min(
            options.limit ?? this.maxMessagesPerRun,
            this.maxMessagesPerRun,
          ),
        );

        if (requestedLimit === 0) {
          return [];
        }

        const statResponse = await this.executeWithRetry(() => client.STAT(), {
          fallbackError: {
            category: JobErrorCategory.Technical,
            code: 'POP3_LIST_FAILED',
            details: {
              sourceAccountId: sourceAccount.id,
            },
            message: 'Failed to read POP3 mailbox statistics.',
            retriable: true,
          },
          policy: this.buildRetryPolicy(),
          isRetryable: (error) => this.isRetriablePop3Error(error),
        });
        const totalMessageCount = this.parseMessageCount(statResponse);

        if (totalMessageCount === 0) {
          return [];
        }

        const references: Pop3MessageReference[] = [];

        for (const messageNumber of this.buildRecentMessageNumbers(
          totalMessageCount,
          requestedLimit,
        )) {
          const uidlResponse = await this.executeWithRetry(
            () => client.UIDL(messageNumber),
            {
              fallbackError: {
                category: JobErrorCategory.Technical,
                code: 'POP3_LIST_FAILED',
                details: {
                  messageNumber,
                  sourceAccountId: sourceAccount.id,
                },
                message: 'Failed to read POP3 UIDL for a message.',
                retriable: true,
              },
              policy: this.buildRetryPolicy(),
              isRetryable: (error) => this.isRetriablePop3Error(error),
            },
          );
          const uidlEntry = this.responseParser.parseUidlEntry(uidlResponse);

          references.push(
            new Pop3MessageReference({
              messageNumber,
              uidl: uidlEntry.uidl,
            }),
          );
        }

        return references.sort(
          (left, right) => right.messageNumber - left.messageNumber,
        );
      } catch (error) {
        throw this.toPop3Error(error, {
          code: 'POP3_LIST_FAILED',
          details: {
            sourceAccountId: sourceAccount.id,
          },
          message: 'Failed to list POP3 message references.',
        });
      }
    }, sourceAccount);
  }

  private buildRecentMessageNumbers(
    totalMessageCount: number,
    limit: number,
  ): readonly number[] {
    const firstMessageNumber = Math.max(1, totalMessageCount - limit + 1);
    const messageNumbers: number[] = [];

    for (
      let messageNumber = totalMessageCount;
      messageNumber >= firstMessageNumber;
      messageNumber -= 1
    ) {
      messageNumbers.push(messageNumber);
    }

    return messageNumbers;
  }

  private parseMessageCount(response: string): number {
    const [messageCountValue] = response.trim().split(/\s+/u);
    const messageCount = Number.parseInt(messageCountValue ?? '', 10);

    if (!Number.isInteger(messageCount) || messageCount < 0) {
      throw new Error(`Invalid POP3 STAT response: ${response}`);
    }

    return messageCount;
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

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      readonly fallbackError: {
        readonly category: JobErrorCategory.Technical;
        readonly code:
          | 'POP3_CONNECTION_FAILED'
          | 'POP3_LIST_FAILED'
          | 'POP3_RETR_FAILED';
        readonly details: Readonly<Record<string, unknown>>;
        readonly message: string;
        readonly retriable: boolean;
      };
      readonly isRetryable?: (error: TransferJobError) => boolean;
      readonly policy: {
        readonly backoffMultiplier: number;
        readonly initialDelayMs: number;
        readonly maxAttempts: number;
        readonly maxDelayMs: number;
      };
    },
  ): Promise<T> {
    const retryPolicy = createRetryPolicy(
      handleWhen(
        (error) =>
          TransferJobError.isInstance(error) &&
          error.retriable &&
          (options.isRetryable?.(error) ?? true),
      ),
      {
        backoff: new DelegateBackoff(({ attempt }) =>
          this.calculateRetryDelayMs(options.policy, attempt),
        ),
        maxAttempts: options.policy.maxAttempts,
      },
    );

    return retryPolicy.execute(async () => {
      try {
        return await operation();
      } catch (error) {
        throw OperationErrorHelper.create(error, options.fallbackError);
      }
    });
  }

  private calculateRetryDelayMs(
    policy: {
      readonly backoffMultiplier: number;
      readonly initialDelayMs: number;
      readonly maxAttempts: number;
      readonly maxDelayMs: number;
    },
    attempt: number,
  ): number {
    if (!Number.isInteger(attempt) || attempt < 1) {
      return 0;
    }

    const exponentialDelay =
      policy.initialDelayMs * policy.backoffMultiplier ** (attempt - 1);

    return Math.min(policy.maxDelayMs, exponentialDelay);
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

    if (TransferJobError.isInstance(error)) {
      return new TransferJobError(fallback.message, {
        category: JobErrorCategory.Technical,
        code: fallback.code,
        details: fallback.details,
        retriable,
        cause: error.cause ?? error,
      });
    }

    return OperationErrorHelper.create(error, {
      category: JobErrorCategory.Technical,
      code: fallback.code,
      details: fallback.details,
      message: fallback.message,
      retriable,
    });
  }

  private unwrapPop3Error(error: unknown): unknown {
    return TransferJobError.isInstance(error) && error.cause !== undefined
      ? error.cause
      : error;
  }

  private async withClient<T>(
    operation: (client: Pop3CommandClientInterface) => Promise<T>,
    sourceAccount: SourceAccount,
  ): Promise<T> {
    const client = this.pop3CommandFactory.create(this.pop3Config);

    try {
      await this.executeWithRetry(() => client.connect(), {
        fallbackError: {
          category: JobErrorCategory.Technical,
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
