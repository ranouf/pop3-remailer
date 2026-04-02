import type { AppConfig } from '../../config/environment';
import type { RawEmailMessage } from '../../domain/email';
import { TransferJobError, toTransferJobError } from '../../domain/errors';
import type {
  GmailImportedMessageLookup,
  GmailImportResult,
  GmailMailService,
} from '../../domain/ports';
import {
  encodeMessageForGmailImport,
  extractRfc822MessageId,
} from '../../shared/email-message';
import { retry } from '../../shared/retry';
import type { GmailApiClientFactoryInterface } from './gmail-api-client-factory.interface';
import type { GmailApiClientInterface } from './gmail-api-client.interface';
import type { GmailOAuthProviderInterface } from './gmail-oauth-provider.interface';
import { GmailOAuthSettings } from './settings/gmail-oauth.settings';

export class GoogleGmailMailService implements GmailMailService {
  private static readonly importedLabelIds = ['INBOX', 'UNREAD'] as const;

  private readonly apiClientFactory: GmailApiClientFactoryInterface;
  private readonly gmailConfig: AppConfig['gmail'];
  private readonly oauthProvider: GmailOAuthProviderInterface;

  public constructor(
    gmailConfig: AppConfig['gmail'],
    oauthProvider: GmailOAuthProviderInterface,
    apiClientFactory: GmailApiClientFactoryInterface,
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
            q: this.buildRfc822MessageIdQuery(rfc822MessageId),
            userId: gmailUserEmail,
          }),
        {
          fallbackError: {
            category: 'technical',
            code: 'GMAIL_LOOKUP_FAILED',
            details: {
              gmailUserEmail,
              rfc822MessageId,
              scope: GmailOAuthSettings.importScope,
            },
            message: 'Failed to query Gmail for an imported message.',
            retriable: true,
          },
          policy: this.buildRetryPolicy(),
        },
      );

      const gmailMessageId = response.data.messages?.[0]?.id ?? null;

      return gmailMessageId === null ? null : { gmailMessageId };
    } catch (error) {
      throw this.toDiagnosticTransferError(error, {
        category: 'technical',
        code: 'GMAIL_LOOKUP_FAILED',
        details: {
          gmailUserEmail,
          rfc822MessageId,
          scope: GmailOAuthSettings.importScope,
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
              labelIds: GoogleGmailMailService.importedLabelIds,
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
              scope: GmailOAuthSettings.importScope,
              uidl: message.uidl,
            },
            message: 'Failed to import the email into Gmail.',
            retriable: true,
          },
          policy: this.buildRetryPolicy(),
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
      throw this.toDiagnosticTransferError(error, {
        category: 'technical',
        code: 'GMAIL_IMPORT_FAILED',
        details: {
          gmailUserEmail,
          messageId: extractRfc822MessageId(message.rawMessage),
          messageNumber: message.messageNumber,
          scope: GmailOAuthSettings.importScope,
          uidl: message.uidl,
        },
        message: 'Failed to import the email into Gmail.',
        retriable: true,
      });
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object') {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private buildDiagnosticDetails(
    error: unknown,
  ): Readonly<Record<string, unknown>> {
    const details: Record<string, unknown> = {};

    if (typeof error === 'string') {
      details.causeMessage = error;
      return details;
    }

    if (error instanceof Error) {
      details.causeMessage = error.message;
      details.causeName = error.name;
    }

    const errorRecord = this.asRecord(error);

    if (errorRecord === null) {
      return details;
    }

    const causeCode = errorRecord.code;

    if (typeof causeCode === 'string' || typeof causeCode === 'number') {
      details.causeCode = causeCode;
    }

    const causeStatus = errorRecord.status;

    if (typeof causeStatus === 'number') {
      details.causeStatus = causeStatus;
    }

    const responseRecord = this.asRecord(errorRecord.response);

    if (responseRecord === null) {
      return details;
    }

    const responseStatus = responseRecord.status;

    if (typeof responseStatus === 'number') {
      details.causeResponseStatus = responseStatus;
    }

    const responseStatusText = responseRecord.statusText;

    if (typeof responseStatusText === 'string') {
      details.causeResponseStatusText = responseStatusText;
    }

    const responseData = responseRecord.data;
    const responseDataRecord = this.asRecord(responseData);

    if (responseDataRecord === null) {
      if (responseData !== undefined) {
        details.causeResponseData = responseData;
      }

      return details;
    }

    const responseError = this.asRecord(responseDataRecord.error);

    if (responseError === null) {
      details.causeResponseData = responseDataRecord;
      return details;
    }

    const responseErrorCode = responseError.code;

    if (
      typeof responseErrorCode === 'string' ||
      typeof responseErrorCode === 'number'
    ) {
      details.causeResponseErrorCode = responseErrorCode;
    }

    const responseErrorMessage = responseError.message;

    if (typeof responseErrorMessage === 'string') {
      details.causeResponseErrorMessage = responseErrorMessage;
    }

    const responseErrorStatus = responseError.status;

    if (typeof responseErrorStatus === 'string') {
      details.causeResponseErrorStatus = responseErrorStatus;
    }

    if (Array.isArray(responseError.errors)) {
      details.causeResponseErrors = responseError.errors;
    }

    return details;
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
      maxAttempts: this.gmailConfig.maxImportRetries + 1,
      maxDelayMs: this.gmailConfig.timeoutMs,
    };
  }

  private buildRfc822MessageIdQuery(messageId: string): string {
    return `rfc822msgid:${this.escapeGmailQueryValue(messageId)}`;
  }

  private createClient(): GmailApiClientInterface {
    const oauthClient = this.oauthProvider.createClient(this.gmailConfig);

    return this.apiClientFactory.create(oauthClient);
  }

  private toDiagnosticTransferError(
    error: unknown,
    fallback: {
      readonly category: 'technical';
      readonly code: 'GMAIL_IMPORT_FAILED' | 'GMAIL_LOOKUP_FAILED';
      readonly details: Readonly<Record<string, unknown>>;
      readonly message: string;
      readonly retriable: boolean;
    },
  ): TransferJobError {
    const normalizedError = toTransferJobError(error, fallback);
    const diagnosticDetails = {
      ...fallback.details,
      ...(normalizedError.details ?? {}),
      ...this.buildDiagnosticDetails(normalizedError.cause ?? error),
    };

    return new TransferJobError(normalizedError.message, {
      category: normalizedError.category,
      code: normalizedError.code,
      ...(Object.keys(diagnosticDetails).length === 0
        ? {}
        : {
            details: diagnosticDetails,
          }),
      ...(normalizedError.cause === undefined
        ? {}
        : {
            cause: normalizedError.cause,
          }),
      retriable: normalizedError.retriable,
    });
  }

  private escapeGmailQueryValue(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  }
}
