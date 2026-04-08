import { EmailTransferTestFactory } from '../email-transfer-test.factory';
import type { EmailTransferTestModuleOverrides } from '../bootstrap/email-transfer-test.module';
import {
  type BaseDataBuilder,
  TestDataInitializer,
} from '../data/base-data-builder';

export abstract class BaseTest {
  public readonly factory: EmailTransferTestFactory;
  private readonly dataBuilders: readonly BaseDataBuilder[];

  protected constructor(
    overrides: EmailTransferTestModuleOverrides = {},
    dataBuilders: readonly BaseDataBuilder[] = [],
  ) {
    this.factory = new EmailTransferTestFactory(overrides);
    this.dataBuilders = dataBuilders;
  }

  public async initialize(): Promise<void> {
    await TestDataInitializer.seed(this.factory, this.dataBuilders);
  }
}
