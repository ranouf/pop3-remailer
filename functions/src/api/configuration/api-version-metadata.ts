import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ApiVersionMetadata {
  readonly version: string;
}

export class ApiVersionMetadataResolver {
  private static cached: ApiVersionMetadata | null = null;

  public static resolve(): ApiVersionMetadata {
    ApiVersionMetadataResolver.cached ??= (() => {
      return {
        version: ApiVersionMetadataResolver.readAppVersion(),
      };
    })();

    return ApiVersionMetadataResolver.cached;
  }

  private static readAppVersion(): string {
    try {
      const packageJson = JSON.parse(
        readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'),
      ) as {
        readonly version?: unknown;
      };

      return typeof packageJson.version === 'string'
        ? packageJson.version
        : '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
}
