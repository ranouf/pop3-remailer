import { Container } from 'inversify';

import type { AuthTokenVerifierInterface } from '../../../../src/api/auth/auth-token-verifier.interface';
import { ApiModule } from '../../../../src/api/api.module';
import type { ApplicationConfiguration } from '../../../../src/core/configuration/models/application-configuration';
import type { ConfigurationManagerInterface } from '../../../../src/core/configuration/configuration-manager.interface';
import { CoreModule } from '../../../../src/core/core.module';
import type { StructuredLogger } from '../../../../src/core/logging/structured-logger.interface';
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
import type { Clock } from '../../../../src/core/time/clock.interface';
import { FakeClock } from '../../../../src/infrastructure/time/tests/fake-clock';
import { InfrastructureModule } from '../../../../src/infrastructure/infrastructure.module';

export interface ApiTestModuleOverrides {
  readonly amplitudeNodeClient?: AmplitudeNodeClientInterface;
  readonly authTokenVerifier?: AuthTokenVerifierInterface;
  readonly clock?: Clock;
  readonly config?: ApplicationConfiguration;
  readonly configurationManager?: ConfigurationManagerInterface;
  readonly firestoreDatabase?: FirestoreDatabase;
  readonly gmailApiClientFactory?: GmailApiClientFactoryInterface;
  readonly gmailOAuthProvider?: GmailOAuthProviderInterface;
  readonly pop3CommandFactory?: Pop3CommandFactoryInterface;
  readonly structuredLogger?: StructuredLogger;
}

export class ApiTestModule {
  public static createContainer(
    overrides: ApiTestModuleOverrides = {},
  ): Container {
    const container = new Container();
    const coreOptions =
      overrides.config === undefined ? {} : { config: overrides.config };

    CoreModule.register(container, coreOptions);
    InfrastructureModule.register(container);
    ApiModule.register(container);

    ApiTestModule.overrideCore(container, overrides);
    ApiTestModule.overrideInfrastructure(container, overrides);
    return container;
  }

  private static overrideCore(
    container: Container,
    overrides: ApiTestModuleOverrides,
  ): void {
    if (overrides.configurationManager !== undefined) {
      container
        .rebind<ConfigurationManagerInterface>(CoreModule.ConfigurationManager)
        .toConstantValue(overrides.configurationManager);
    }
  }

  private static overrideInfrastructure(
    container: Container,
    overrides: ApiTestModuleOverrides,
  ): void {
    container
      .rebind<AmplitudeNodeClientInterface>(
        InfrastructureModule.AmplitudeNodeClient,
      )
      .toConstantValue(
        overrides.amplitudeNodeClient ?? new FakeAmplitudeNodeClient(),
      );

    if (overrides.authTokenVerifier !== undefined) {
      container
        .rebind<AuthTokenVerifierInterface>(
          InfrastructureModule.AuthTokenVerifier,
        )
        .toConstantValue(overrides.authTokenVerifier);
    }

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

    if (overrides.structuredLogger !== undefined) {
      container
        .rebind<StructuredLogger>(InfrastructureModule.StructuredLogger)
        .toConstantValue(overrides.structuredLogger);
    }
  }
}
