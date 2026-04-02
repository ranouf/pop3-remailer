import { foundationMarker } from '../../src/index';

describe('project foundation', () => {
  it('exports a bootstrap marker', () => {
    expect(foundationMarker).toBe('project-foundation');
  });

  it('runs under Node.js 22 during validated executions', () => {
    const [major] = process.versions.node.split('.');

    expect(Number(major)).toBe(22);
  });
});
