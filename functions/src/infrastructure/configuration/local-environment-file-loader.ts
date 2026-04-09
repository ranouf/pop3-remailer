import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'dotenv';

export interface LocalEnvironmentFileLoaderOptions {
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
}

export class LocalEnvironmentFileLoader {
  public execute(options: LocalEnvironmentFileLoaderOptions): string | null {
    const filePath = join(
      options.cwd,
      this.resolveFileName(options.env.NODE_ENV),
    );

    if (!existsSync(filePath)) {
      return null;
    }

    const parsedEnvironment = parse(readFileSync(filePath, 'utf8'));

    for (const [key, value] of Object.entries(parsedEnvironment)) {
      if (options.env[key] === undefined) {
        options.env[key] = value;
      }
    }

    return filePath;
  }

  public resolveFileName(
    nodeEnv: string | undefined,
  ): '.env.local' | '.env.test.local' {
    return nodeEnv === 'test' ? '.env.test.local' : '.env.local';
  }
}
