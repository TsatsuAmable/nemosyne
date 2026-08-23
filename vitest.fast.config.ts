import { defineConfig } from 'vitest/config';

const FAST_NODE_TESTS = [
  'tests/analyst-judgement-controller.test.ts',
  'tests/draco-production-import-boundary.test.ts',
  'tests/hygiene-audit.test.ts',
  'tests/moneta-gate0-authority.test.ts',
  'tests/moneta-layout-authority.test.ts',
  'tests/moneta-scoring-ownership.test.ts',
];

export default defineConfig({
  test: {
    name: 'fast-node',
    environment: 'node',
    include: FAST_NODE_TESTS,
    globals: false,
    pool: 'threads',
    testTimeout: 5000,
    teardownTimeout: 1000,
  },
});
