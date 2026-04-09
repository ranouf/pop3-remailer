import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('project foundation', () => {
  it('exports the runtime entry points', () => {
    const entryPointSource = readFileSync(
      join(__dirname, '../../src/index.ts'),
      'utf8',
    );

    expect(entryPointSource).toContain('export const api =');
    expect(entryPointSource).toContain('export const scheduledEmailTransfer =');
  });

  it('runs under Node.js 22 during validated executions', () => {
    const [major] = process.versions.node.split('.');

    expect(Number(major)).toBe(22);
  });
});
