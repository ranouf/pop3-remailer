import { RawEmailMessage } from '../../../../src/core/email/pop3';
import { Uidl } from '../../../../src/core/email/uidl';
import type { ProcessedEmailRepository } from '../../../../src/core/email/processed-email/processed-email-repository.interface';
import { ProcessedEmailMetadata } from '../../../../src/core/email/processed-email';
import type { JobRunRepository } from '../../../../src/core/job-run';
import type { JobRunStatisticsRepositoryInterface } from '../../../../src/core/job-run-statistics';
import type { AmplitudeNodeClientInterface } from '../../../../src/infrastructure/analytics/client/amplitude-node-client.interface';
import { type FakeAmplitudeNodeClient } from '../../../../src/infrastructure/analytics/tests/fake-amplitude-node-client';
import type { GmailApiClientFactoryInterface } from '../../../../src/infrastructure/email/gmail/client/gmail-api-client-factory.interface';
import { type FakeGmailApiClientFactory } from '../../../../src/infrastructure/email/gmail/tests/fake-gmail-api-client-factory';
import { FakePop3CommandFactory } from '../../../../src/infrastructure/email/node-pop3/tests/fake-pop3-command-factory';
import { InfrastructureModule } from '../../../../src/infrastructure/infrastructure.module';
import { EmailMessageHelper } from '../../../../src/core/email';
import { testApplicationConfiguration } from '../configuration/test-application-configuration';
import { BaseTest } from './base-test';

export class EmailTransferFunctionTest extends BaseTest {
  public static readonly sourceAccountId =
    testApplicationConfiguration.sourceAccount.id;

  public constructor(messages: readonly RawEmailMessage[]) {
    const pop3CommandFactory = new FakePop3CommandFactory(messages);

    super({
      pop3CommandFactory,
    });
  }

  public static createPop3Message(
    uidl: string,
    options: {
      readonly messageId?: string;
      readonly messageNumber: number;
      readonly messageSize?: number;
    },
  ): RawEmailMessage {
    const messageId = options.messageId ?? `${uidl}@example.com`;

    return new RawEmailMessage({
      ...(messageId === undefined
        ? {}
        : {
            messageId,
          }),
      messageNumber: options.messageNumber,
      messageSize: options.messageSize ?? 128,
      rawMessage: `From: source@example.com\r\nMessage-ID: <${messageId}>\r\n\r\nBody for ${uidl}`,
      uidl: Uidl.create(uidl),
    });
  }

  public get jobRunRepository(): JobRunRepository {
    return this.factory.resolve<JobRunRepository>(
      InfrastructureModule.JobRunRepository,
    );
  }

  public get processedEmailRepository(): ProcessedEmailRepository {
    return this.factory.resolve<ProcessedEmailRepository>(
      InfrastructureModule.ProcessedEmailRepository,
    );
  }

  public get jobRunStatisticsRepository(): JobRunStatisticsRepositoryInterface {
    return this.factory.resolve<JobRunStatisticsRepositoryInterface>(
      InfrastructureModule.JobRunStatisticsRepository,
    );
  }

  public async seedImportedEmail(message: RawEmailMessage): Promise<void> {
    const processedEmailRepository = this.processedEmailRepository;
    const uidl = message.uidl;

    await processedEmailRepository.claimForProcessing({
      jobId: 'seed-job',
      metadata: new ProcessedEmailMetadata({
        ...(EmailMessageHelper.extractRfc822MessageId(message.rawMessage) ===
        null
          ? {}
          : {
              messageId: EmailMessageHelper.extractRfc822MessageId(
                message.rawMessage,
              ) as string,
            }),
        messageNumber: message.messageNumber,
        messageSize: message.messageSize,
      }),
      sourceAccount: testApplicationConfiguration.sourceAccount,
      uidl,
    });

    await processedEmailRepository.markImported({
      gmailMessageId: 'existing-gmail-message-id',
      sourceAccountId: EmailTransferFunctionTest.sourceAccountId,
      uidl,
    });
  }

  public get amplitudeNodeClient(): FakeAmplitudeNodeClient {
    return this.factory.resolve<AmplitudeNodeClientInterface>(
      InfrastructureModule.AmplitudeNodeClient,
    ) as FakeAmplitudeNodeClient;
  }

  public get gmailApiClientFactory(): FakeGmailApiClientFactory {
    return this.factory.resolve<GmailApiClientFactoryInterface>(
      InfrastructureModule.GmailApiClientFactory,
    ) as FakeGmailApiClientFactory;
  }
}
