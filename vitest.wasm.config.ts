import { defineConfig } from 'vitest/config';

// A test must justify real Rust/WASM startup by appearing here. Keep this list
// intentionally small: analytical correctness belongs in Rust, while ordinary
// TypeScript/UI behavior belongs in the Node or jsdom-only lanes.
export const WASM_TESTS = [
  'tests/accessibility.test.ts',
  'tests/analysis-templates.test.ts',
  'tests/desktop-preview.test.ts',
  'tests/intent-inference.test.ts',
  'tests/moneta-metamorphic-provenance.test.ts',
  'tests/performance-budget.test.ts',
  'tests/production-runtime-wiring.test.ts',
  'tests/subsystem-resiliency-audit.test.ts',
  'tests/wasm-layouts.test.ts',
  'tests/wasm-row-identity.test.ts',
  'tests/wasm-runtime.test.ts',
  'tests/world-coverage.test.ts',
  'tests/world.test.ts',
];

export default defineConfig({
  test: {
    name: 'real-wasm-boundary',
    environment: 'jsdom',
    include: WASM_TESTS,
    setupFiles: ['./tests/setup.ts', './tests/setup-wasm.ts'],
    globals: false,
    pool: 'forks',
    maxWorkers: 2,
    minWorkers: 1,
    testTimeout: 10000,
    teardownTimeout: 3000,
  },
});
