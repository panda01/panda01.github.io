import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: './apps/web/vite.config.mts',
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.{mts,tsx}'],
          setupFiles: ['./apps/web/src/test-setup.mts'],
        },
      },
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['apps/server/src/**/*.test.mts', 'packages/shared/src/**/*.test.mts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['apps/web/src/**', 'apps/server/src/**', 'packages/shared/src/**'],
      // Fixed in Phase 0 (CLAUDE.md forbids loosening this later). Only entry points, type-only files,
      // test support files and thin third-party wrappers named *.adapter.* are excluded; all logic
      // must live outside adapters so it is measured.
      exclude: [
        '**/*.test.{mts,tsx}',
        '**/*.d.ts',
        '**/*.types.mts',
        '**/*.adapter.{mts,tsx}',
        'apps/web/src/main.tsx',
        'apps/web/src/test-setup.mts',
        'apps/server/src/index.mts',
      ],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
