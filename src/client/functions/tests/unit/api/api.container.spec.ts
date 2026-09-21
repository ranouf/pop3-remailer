import { describe, expect, it } from 'vitest';

import { ApiModule } from '../../../src/api/api.module';
import { OperationsApi } from '../../../src/api/program';

describe('unit/api/api.container', () => {
  it('creates a container configured with the API module bindings', () => {
    const container = OperationsApi.createContainer();

    expect(container.isBound(ApiModule.OperationsApi)).toBe(true);
    expect(container.isBound(ApiModule.HealthCheckManager)).toBe(true);
    expect(container.isBound(ApiModule.JobRunStatisticsManager)).toBe(true);
  });
});
