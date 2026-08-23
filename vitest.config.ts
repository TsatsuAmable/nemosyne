import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/setup-wasm.ts'],
    globals: false,
    // tests/smoke is a Playwright suite (real Chromium), not a Vitest suite —
    // exclude it so `vitest run` doesn't try to load @playwright/test under jsdom.
    exclude: ['node_modules', 'dist', '.claude', 'wasm', 'tests/smoke', 'modules'],
    pool: 'forks',
    maxWorkers: 2,
    minWorkers: 1,
    testTimeout: 10000,
    teardownTimeout: 3000,
    coverage: {
      provider: 'v8',
      // Ratcheted coverage floors (baseline measured at ~83% stmt / 70% branch)
      thresholds: { lines: 75, statements: 75, functions: 70, branches: 60 },
    },
  },
});
