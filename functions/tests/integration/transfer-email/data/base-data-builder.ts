import type { EmailTransferTestFactory } from '../email-transfer-test.factory';

export abstract class BaseDataBuilder {
  public abstract seed(factory: EmailTransferTestFactory): Promise<void>;
}

export class TestDataInitializer {
  public static async seed(
    factory: EmailTransferTestFactory,
    builders: readonly BaseDataBuilder[],
  ): Promise<void> {
    for (const builder of builders) {
      await builder.seed(factory);
    }
  }
}
