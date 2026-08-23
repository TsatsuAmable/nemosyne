import { defineConfig } from 'vitest/config';

const FAST_NODE_TESTS = [
  'tests/draco-production-import-boundary.test.ts',
  'tests/hygiene-audit.test.ts',
  'tests/moneta-gate0-authority.test.ts',
  'tests/moneta-layout-authority.test.ts',
  'tests/moneta-scoring-ownership.test.ts',
];

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/setup-wasm.ts'],
    globals: false,
    // tests/smoke is a Playwright suite (real Chromium), not a Vitest suite.
    // Pure architecture/source-scan tests run in vitest.fast.config.ts so they
    // do not pay jsdom + WASM bootstrap cost.
    exclude: [
      'node_modules',
      'dist',
      '.claude',
      'wasm',
      'tests/smoke',
      'modules',
      ...FAST_NODE_TESTS,
    ],
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
