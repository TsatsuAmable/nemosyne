import { defineConfig } from 'vitest/config';

// A test must justify real Rust/WASM startup by appearing here. Keep this list
// intentionally small: analytical correctness belongs in Rust, while ordinary
// TypeScript/UI behavior belongs in the Node or jsdom-only lanes.
export const WASM_TESTS = [
  'tests/accessibility.test.ts',
  'tests/analysis-templates.test.ts',
  'tests/chart-plane-integration.test.ts',
  'tests/desktop-preview.test.ts',
  'tests/draco-layouts.test.ts',
  'tests/draco-topology-node.test.ts',
  'tests/draco.test.ts',
  'tests/frequency-field.test.ts',
  'tests/intent-inference.test.ts',
  'tests/layout-binding-panel-typing.test.ts',
  'tests/moneta-metamorphic-provenance.test.ts',
  'tests/performance-budget.test.ts',
  'tests/production-runtime-wiring.test.ts',
  'tests/representation-topology-node.test.ts',
  'tests/subsystem-resiliency-audit.test.ts',
  'tests/vr-data-operations.test.ts',
  'tests/vr-metaphors.test.ts',
  'tests/vr-scalable-artefacts.test.ts',
  'tests/vr-topology-translator-live.test.ts',
  'tests/wasm-layouts.test.ts',
  'tests/wasm-row-identity.test.ts',
  'tests/wasm-runtime.test.ts',
  'tests/world-coverage.test.ts',
  'tests/world.test.ts',
  'tests/zero-alloc-instanced-buffer.test.ts',
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
