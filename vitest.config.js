import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: false,
    // tests/smoke is a Playwright suite (real Chromium), not a Vitest suite —
    // exclude it so `vitest run` doesn't try to load @playwright/test under jsdom.
    exclude: ['node_modules', 'dist', '.claude', 'wasm', 'tests/smoke'],
    pool: 'forks',
    maxWorkers: 2,
    minWorkers: 1,
    testTimeout: 10000,
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
