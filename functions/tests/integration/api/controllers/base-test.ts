import { ApiTestFactory } from '../api-test.factory';
import type { ApiTestModuleOverrides } from '../bootstrap/api-test.module';
import {
  type BaseDataBuilder,
  TestDataInitializer,
} from '../data/base-data-builder';

export abstract class BaseTest {
  public readonly factory: ApiTestFactory;
  private readonly dataBuilders: readonly BaseDataBuilder[];

  protected constructor(
    overrides: ApiTestModuleOverrides = {},
    dataBuilders: readonly BaseDataBuilder[] = [],
  ) {
    this.factory = new ApiTestFactory(overrides);
    this.dataBuilders = dataBuilders;
  }

  public async initialize(): Promise<void> {
    await TestDataInitializer.seed(this.factory, this.dataBuilders);
  }
}
