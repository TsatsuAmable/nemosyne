import { defineConfig } from 'vitest/config';
import { UI_ONLY_TESTS } from './tests/config/test-groups.ts';

export default defineConfig({
  test: {
    name: 'ui-jsdom',
    environment: 'jsdom',
    include: UI_ONLY_TESTS,
    setupFiles: ['./tests/setup.ts'],
    globals: false,
    pool: 'threads',
    maxWorkers: 4,
    testTimeout: 10000,
    teardownTimeout: 2000,
  },
});
