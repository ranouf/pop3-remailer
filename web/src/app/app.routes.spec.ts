import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('routes', () => {
  it('defines login and dashboard routes', () => {
    const paths = routes.map((route) => route.path);

    expect(paths).toContain('login');
    expect(paths).toContain('dashboard');
    expect(paths).toContain('**');
  });
});
