import type { Test } from 'supertest';

export class ApiHttpHelper {
  public static authenticatedGet(
    client: { get(path: string): Test },
    path: string,
  ): Test {
    return client.get(path).set('authorization', 'Bearer integration-token');
  }
}
