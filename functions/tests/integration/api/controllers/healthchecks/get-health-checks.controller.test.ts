import { BaseTest } from '../base-test';
import type { ApiTestModuleOverrides } from '../../bootstrap/api-test.module';

export class GetHealthChecksControllerTest extends BaseTest {
  public constructor(overrides: ApiTestModuleOverrides = {}) {
    super(overrides);
  }
}
