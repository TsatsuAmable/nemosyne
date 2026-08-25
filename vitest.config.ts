import { defineConfig } from 'vitest/config';
import { FAST_NODE_TESTS, UI_ONLY_TESTS, WASM_TESTS } from './tests/config/test-groups.ts';

export default defineConfig({
  test: {
    name: 'jsdom-integration',
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: false,
    // Real WASM is opt-in via vitest.wasm.config.ts. Tests in this lane must
    // not depend on ambient kernel initialization.
    exclude: [
      'node_modules',
      'dist',
      '.claude',
      'wasm',
      'tests/smoke',
      'tests/collaboration-browser',
      'modules',
      ...FAST_NODE_TESTS,
      ...UI_ONLY_TESTS,
      ...WASM_TESTS,
    ],
    pool: 'threads',
    maxWorkers: 4,
    testTimeout: 10000,
    teardownTimeout: 2000,
    coverage: {
      provider: 'v8',
      thresholds: { lines: 75, statements: 75, functions: 70, branches: 60 },
    },
  },
});
