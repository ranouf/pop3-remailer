import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiModule } from '../../../src/api/api.module';
import { OperationsApi } from '../../../src/api/program';

describe('unit/api/program.create', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves OperationsApi from the API container', () => {
    const resolvedApi = {
      createApplication: vi.fn(),
    } as unknown as OperationsApi;
    const containerGet = vi.fn().mockReturnValue(resolvedApi);

    vi.spyOn(OperationsApi, 'createContainer').mockReturnValue({
      get: containerGet,
    } as never);

    const api = OperationsApi.create();

    expect(containerGet).toHaveBeenCalledWith(ApiModule.OperationsApi);
    expect(api).toBe(resolvedApi);
  });
});
