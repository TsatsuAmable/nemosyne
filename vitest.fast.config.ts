import { defineConfig } from 'vitest/config';
import { FAST_NODE_TESTS } from './tests/config/test-groups.ts';

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
