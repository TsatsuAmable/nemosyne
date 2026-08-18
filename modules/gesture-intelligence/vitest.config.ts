import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    maxWorkers: 2,
    minWorkers: 1,
    testTimeout: 15000,
    teardownTimeout: 3000,
  },
});
