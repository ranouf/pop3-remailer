import type { Container } from 'inversify';

import { type EmailTransferFunction } from '../../../src/jobs/email-transfer/email-transfer.function';
import { EmailTransferModule } from '../../../src/jobs/email-transfer/email-transfer.module';
import {
  EmailTransferTestModule,
  type EmailTransferTestModuleOverrides,
} from './bootstrap/email-transfer-test.module';
import { testApplicationConfiguration } from './configuration/test-application-configuration';

export class EmailTransferTestFactory {
  public readonly container: Container;
  public readonly entrypoint: EmailTransferFunction;

  public constructor(overrides: EmailTransferTestModuleOverrides = {}) {
    const container = EmailTransferTestModule.createContainer({
      ...overrides,
      config: overrides.config ?? testApplicationConfiguration,
    });

    this.container = container;
    this.entrypoint = container.get<EmailTransferFunction>(
      EmailTransferModule.EmailTransferFunction,
    );
  }

  public resolve<T>(identifier: symbol): T {
    return this.container.get<T>(identifier);
  }
}
