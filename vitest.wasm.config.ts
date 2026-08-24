import { defineConfig } from 'vitest/config';
import { WASM_TESTS } from './tests/config/test-groups.ts';

// A test must justify real Rust/WASM startup by appearing here. Keep this list
// intentionally small: analytical correctness belongs in Rust, while ordinary
// TypeScript/UI behavior belongs in the Node or jsdom-only lanes.
export default defineConfig({
  test: {
    name: 'real-wasm-boundary',
    environment: 'jsdom',
    include: WASM_TESTS,
    setupFiles: ['./tests/setup.ts', './tests/setup-wasm.ts'],
    globals: false,
    pool: 'forks',
    maxWorkers: 2,
    testTimeout: 10000,
    teardownTimeout: 3000,
  },
});
