import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['browser'],
  },
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  coverage: {
    provider: 'v8',
    include: ['src/app/**/*.ts'],
    exclude: [
      '**/*.html',
      '**/*.css',
      'src/**/*.spec.ts',
      'src/app/app.config.ts',
      'src/app/core/auth/auth-session.service.ts',
      'src/app/core/config/app-runtime-config.ts',
      'src/app/core/firebase/**',
      'src/app/**/*.models.ts',
    ],
    thresholds: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
});
