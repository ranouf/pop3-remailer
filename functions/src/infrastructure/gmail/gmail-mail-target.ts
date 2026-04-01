/* eslint-disable sort-imports */
import type { AppConfig } from '../../config/environment';
import { toTransferJobError } from '../../domain/errors';
import type { RawEmailMessage } from '../../domain/email';
import type {
  GmailImportedMessageLookup,
  GmailImportResult,
  GmailMailTarget,
} from '../../domain/ports';
import {
  encodeMessageForGmailImport,
  extractRfc822MessageId,
} from '../../shared/email-message';
import { retry } from '../../shared/retry';
import type { GmailApiClientFactory } from './google-gmail-api-client';
import {
  gmailImportScope,
  type GmailOAuthProvider,
} from './gmail-oauth-provider';
import type { GmailApiClient } from './gmail-types';

const importedLabelIds = ['INBOX', 'UNREAD'] as const;

const escapeGmailQueryValue = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

const buildRfc822MessageIdQuery = (messageId: string): string =>
  `rfc822msgid:${escapeGmailQueryValue(messageId)}`;

export class GoogleGmailMailTarget implements GmailMailTarget {
  private readonly gmailConfig: AppConfig['gmail'];
  private readonly apiClientFactory: GmailApiClientFactory;
  private readonly oauthProvider: GmailOAuthProvider;

  public constructor(
    gmailConfig: AppConfig['gmail'],
    oauthProvider: GmailOAuthProvider,
    apiClientFactory: GmailApiClientFactory,
  ) {
    this.gmailConfig = gmailConfig;
    this.oauthProvider = oauthProvider;
    this.apiClientFactory = apiClientFactory;
  }

  public async findImportedMessageByRfc822MessageId(
    gmailUserEmail: string,
    rfc822MessageId: string,
  ): Promise<GmailImportedMessageLookup | null> {
    const gmailClient = this.createClient();

    try {
      const response = await retry(
        async () =>
          gmailClient.users.messages.list({
            maxResults: 1,
            q: buildRfc822MessageIdQuery(rfc822MessageId),
            userId: gmailUserEmail,
          }),
        {
          fallbackError: {
            category: 'technical',
            code: 'GMAIL_LOOKUP_FAILED',
            details: {
              gmailUserEmail,
              rfc822MessageId,
              scope: gmailImportScope,
            },
            message: 'Failed to query Gmail for an imported message.',
            retriable: true,
          },
          policy: {
            backoffMultiplier: 2,
            initialDelayMs: 250,
            maxAttempts: this.gmailConfig.maxImportRetries + 1,
            maxDelayMs: this.gmailConfig.timeoutMs,
          },
        },
      );

      const gmailMessageId = response.data.messages?.[0]?.id ?? null;

      return gmailMessageId === null
        ? null
        : {
            gmailMessageId,
          };
    } catch (error) {
      throw toTransferJobError(error, {
        category: 'technical',
        code: 'GMAIL_LOOKUP_FAILED',
        details: {
          gmailUserEmail,
          rfc822MessageId,
          scope: gmailImportScope,
        },
        message: 'Failed to query Gmail for an imported message.',
        retriable: true,
      });
    }
  }

  public async importMessage(
    gmailUserEmail: string,
    message: RawEmailMessage,
  ): Promise<GmailImportResult> {
    const gmailClient = this.createClient();

    try {
      const response = await retry(
        async () =>
          gmailClient.users.messages.import({
            requestBody: {
              internalDateSource: 'dateHeader',
              labelIds: importedLabelIds,
              raw: encodeMessageForGmailImport(message.rawMessage),
            },
            userId: gmailUserEmail,
          }),
        {
          fallbackError: {
            category: 'technical',
            code: 'GMAIL_IMPORT_FAILED',
            details: {
              gmailUserEmail,
              messageNumber: message.messageNumber,
              scope: gmailImportScope,
              uidl: message.uidl,
            },
            message: 'Failed to import the email into Gmail.',
            retriable: true,
          },
          policy: {
            backoffMultiplier: 2,
            initialDelayMs: 250,
            maxAttempts: this.gmailConfig.maxImportRetries + 1,
            maxDelayMs: this.gmailConfig.timeoutMs,
          },
        },
      );

      return {
        ...(response.data.id === undefined || response.data.id === null
          ? {}
          : {
              gmailMessageId: response.data.id,
            }),
        ...(response.data.threadId === undefined ||
        response.data.threadId === null
          ? {}
          : {
              gmailThreadId: response.data.threadId,
            }),
      };
    } catch (error) {
      throw toTransferJobError(error, {
        category: 'technical',
        code: 'GMAIL_IMPORT_FAILED',
        details: {
          gmailUserEmail,
          messageId: extractRfc822MessageId(message.rawMessage),
          messageNumber: message.messageNumber,
          scope: gmailImportScope,
          uidl: message.uidl,
        },
        message: 'Failed to import the email into Gmail.',
        retriable: true,
      });
    }
  }

  private createClient(): GmailApiClient {
    const oauthClient = this.oauthProvider.createClient(this.gmailConfig);

    return this.apiClientFactory.create(oauthClient);
  }
}
