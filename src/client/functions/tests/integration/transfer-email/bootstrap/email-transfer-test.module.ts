import { Container } from 'inversify';

import type { ApplicationConfiguration } from '../../../../src/core/configuration/models/application-configuration';
import type { ConfigurationManagerInterface } from '../../../../src/core/configuration/configuration-manager.interface';
import { CoreModule } from '../../../../src/core/core.module';
import type { StructuredLogger } from '../../../../src/core/logging/structured-logger.interface';
import type { Clock } from '../../../../src/core/time/clock.interface';
import type { AmplitudeNodeClientInterface } from '../../../../src/infrastructure/analytics/client/amplitude-node-client.interface';
import { FakeAmplitudeNodeClient } from '../../../../src/infrastructure/analytics/tests/fake-amplitude-node-client';
import type { GmailApiClientFactoryInterface } from '../../../../src/infrastructure/email/gmail/client/gmail-api-client-factory.interface';
import { FakeGmailApiClientFactory } from '../../../../src/infrastructure/email/gmail/tests/fake-gmail-api-client-factory';
import type { GmailOAuthProviderInterface } from '../../../../src/infrastructure/email/gmail/oauth/gmail-oauth-provider.interface';
import { FakeGmailOAuthProvider } from '../../../../src/infrastructure/email/gmail/tests/fake-gmail-oauth-provider';
import type { Pop3CommandFactoryInterface } from '../../../../src/infrastructure/email/node-pop3/client/pop3-command-factory.interface';
import { FakePop3CommandFactory } from '../../../../src/infrastructure/email/node-pop3/tests/fake-pop3-command-factory';
import { InMemoryFirestoreDatabase } from '../../../../src/infrastructure/firestore/tests/in-memory-firestore-database';
import type { FirestoreDatabase } from '../../../../src/infrastructure/firestore/models';
import { InfrastructureModule } from '../../../../src/infrastructure/infrastructure.module';
import { FakeStructuredLogger } from '../../../../src/infrastructure/logging/tests/fake-structured-logger';
import { FakeClock } from '../../../../src/infrastructure/time/tests/fake-clock';
import { EmailTransferFunction } from '../../../../src/jobs/email-transfer/email-transfer.function';
import type { EmailTransferJobInterface } from '../../../../src/jobs/email-transfer/email-transfer-job.interface';
import { EmailTransferModule } from '../../../../src/jobs/email-transfer/email-transfer.module';

export interface EmailTransferTestModuleOverrides {
  readonly amplitudeNodeClient?: AmplitudeNodeClientInterface;
  readonly clock?: Clock;
  readonly config?: ApplicationConfiguration;
  readonly configurationManager?: ConfigurationManagerInterface;
  readonly firestoreDatabase?: FirestoreDatabase;
  readonly gmailApiClientFactory?: GmailApiClientFactoryInterface;
  readonly gmailOAuthProvider?: GmailOAuthProviderInterface;
  readonly pop3CommandFactory?: Pop3CommandFactoryInterface;
  readonly structuredLogger?: StructuredLogger;
}

export class EmailTransferTestModule {
  public static createContainer(
    overrides: EmailTransferTestModuleOverrides = {},
  ): Container {
    const container = new Container();
    const coreOptions =
      overrides.config === undefined ? {} : { config: overrides.config };

    CoreModule.register(container, coreOptions);
    InfrastructureModule.register(container);
    EmailTransferModule.register(container);

    EmailTransferTestModule.overrideCore(container, overrides);
    EmailTransferTestModule.overrideInfrastructure(container, overrides);
    EmailTransferTestModule.overrideFunction(container);

    return container;
  }

  private static overrideCore(
    container: Container,
    overrides: EmailTransferTestModuleOverrides,
  ): void {
    if (overrides.configurationManager !== undefined) {
      container
        .rebind<ConfigurationManagerInterface>(CoreModule.ConfigurationManager)
        .toConstantValue(overrides.configurationManager);
    }
  }

  private static overrideInfrastructure(
    container: Container,
    overrides: EmailTransferTestModuleOverrides,
  ): void {
    container
      .rebind<AmplitudeNodeClientInterface>(
        InfrastructureModule.AmplitudeNodeClient,
      )
      .toConstantValue(
        overrides.amplitudeNodeClient ?? new FakeAmplitudeNodeClient(),
      );

    container
      .rebind<Clock>(InfrastructureModule.Clock)
      .toConstantValue(
        overrides.clock ?? new FakeClock(new Date('2026-04-07T12:00:00.000Z')),
      );

    container
      .rebind<FirestoreDatabase>(InfrastructureModule.FirestoreDatabase)
      .toConstantValue(
        overrides.firestoreDatabase ?? new InMemoryFirestoreDatabase(),
      );

    container
      .rebind<GmailApiClientFactoryInterface>(
        InfrastructureModule.GmailApiClientFactory,
      )
      .toConstantValue(
        overrides.gmailApiClientFactory ?? new FakeGmailApiClientFactory(),
      );

    container
      .rebind<GmailOAuthProviderInterface>(
        InfrastructureModule.GmailOAuthProvider,
      )
      .toConstantValue(
        overrides.gmailOAuthProvider ?? new FakeGmailOAuthProvider(),
      );

    container
      .rebind<Pop3CommandFactoryInterface>(
        InfrastructureModule.Pop3CommandFactory,
      )
      .toConstantValue(
        overrides.pop3CommandFactory ?? new FakePop3CommandFactory(),
      );

    container
      .rebind<StructuredLogger>(InfrastructureModule.StructuredLogger)
      .toConstantValue(
        overrides.structuredLogger ?? new FakeStructuredLogger(),
      );
  }

  private static overrideFunction(container: Container): void {
    container
      .rebind<EmailTransferFunction>(EmailTransferModule.EmailTransferFunction)
      .toDynamicValue(
        () =>
          new EmailTransferFunction({
            config: container.get<ApplicationConfiguration>(
              CoreModule.ApplicationConfiguration,
            ),
            job: container.get<EmailTransferJobInterface>(
              EmailTransferModule.EmailTransferJob,
            ),
          }),
      )
      .inSingletonScope();
  }
}
