import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: false,
    exclude: ['node_modules', 'dist', 'docs/nemosyne-world', '.claude', 'wasm'],
    pool: 'forks',
    maxWorkers: 2,
    minWorkers: 1,
    teardownTimeout: 3000,
  },
});
