import { defineConfig } from 'vitest/config';

export const UI_ONLY_TESTS = [
  'tests/adaptive-assist-controller.test.ts',
  'tests/ai-gesture-jit-hints.test.ts',
  'tests/asymmetric-desktop-companion.test.ts',
];

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
