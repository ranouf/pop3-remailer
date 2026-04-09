import type { ApiTestFactory } from '../api-test.factory';

export abstract class BaseDataBuilder {
  public abstract seed(factory: ApiTestFactory): Promise<void>;
}

export class TestDataInitializer {
  public static async seed(
    factory: ApiTestFactory,
    builders: readonly BaseDataBuilder[],
  ): Promise<void> {
    for (const builder of builders) {
      await builder.seed(factory);
    }
  }
}
