import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: false,
    exclude: ['node_modules', 'dist', '.claude', 'wasm'],
    pool: 'forks',
    maxWorkers: 2,
    minWorkers: 1,
    teardownTimeout: 3000,
    coverage: {
      provider: 'v8',
      // Conservative floors set below the measured baseline (~83% stmt / 70% branch)
      // so CI fails on a real regression without flaking on small variance. Tighten
      // toward the true baseline in a follow-up once it is measured exactly.
      thresholds: { lines: 70, statements: 70, functions: 65, branches: 55 },
    },
  },
});
