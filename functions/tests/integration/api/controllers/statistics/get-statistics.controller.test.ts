import { JobRunDataBuilder } from '../../data/job-run-data-builder';
import { BaseTest } from '../base-test';
import type { ApiTestModuleOverrides } from '../../bootstrap/api-test.module';

export class GetStatisticsControllerTest extends BaseTest {
  public constructor(overrides: ApiTestModuleOverrides = {}) {
    super(overrides, [new JobRunDataBuilder()]);
  }
}
