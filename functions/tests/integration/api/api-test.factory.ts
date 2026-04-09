import request from 'supertest';
import type { Container } from 'inversify';

import { ApiModule } from '../../../src/api/api.module';
import type { AuthTokenVerifierInterface } from '../../../src/api/auth/auth-token-verifier.interface';
import { type OperationsApi } from '../../../src/api/program';
import type { StructuredLogger } from '../../../src/core/logging/structured-logger.interface';
import { FakeStructuredLogger } from '../../../src/infrastructure/logging/tests/fake-structured-logger';
import { FakeApiAuthTokenVerifier } from './auth/fake-api-auth-token-verifier';
import {
  ApiTestModule,
  type ApiTestModuleOverrides,
} from './bootstrap/api-test.module';
import { testApplicationConfiguration } from './configuration/test-application-configuration';

export class ApiTestFactory {
  public readonly api: OperationsApi;
  public readonly authTokenVerifier: AuthTokenVerifierInterface;
  public readonly client: ReturnType<typeof request>;
  public readonly container: Container;
  public readonly logger: StructuredLogger;

  public constructor(overrides: ApiTestModuleOverrides = {}) {
    const authTokenVerifier =
      overrides.authTokenVerifier ?? new FakeApiAuthTokenVerifier();
    const structuredLogger =
      overrides.structuredLogger ?? new FakeStructuredLogger();
    const container = ApiTestModule.createContainer({
      ...overrides,
      authTokenVerifier,
      config: overrides.config ?? testApplicationConfiguration,
      structuredLogger,
    });

    this.container = container;
    this.api = container.get<OperationsApi>(ApiModule.OperationsApi);
    this.authTokenVerifier = authTokenVerifier;
    this.client = request(this.api.createApplication());
    this.logger = structuredLogger;
  }

  public resolve<T>(identifier: symbol): T {
    return this.container.get<T>(identifier);
  }
}
