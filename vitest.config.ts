import { defineConfig } from 'vitest/config';

const FAST_NODE_TESTS = [
  'tests/analyst-judgement-controller.test.ts',
  'tests/draco-production-import-boundary.test.ts',
  'tests/hygiene-audit.test.ts',
  'tests/moneta-gate0-authority.test.ts',
  'tests/moneta-layout-authority.test.ts',
  'tests/moneta-scoring-ownership.test.ts',
];

const UI_ONLY_TESTS = [
  'tests/adaptive-assist-controller.test.ts',
  'tests/ai-gesture-jit-hints.test.ts',
  'tests/asymmetric-desktop-companion.test.ts',
];

const WASM_TESTS = [
  'tests/accessibility.test.ts',
  'tests/analysis-templates.test.ts',
  'tests/chart-plane-integration.test.ts',
  'tests/desktop-preview.test.ts',
  'tests/draco-layouts.test.ts',
  'tests/draco-topology-node.test.ts',
  'tests/draco.test.ts',
  'tests/e2e/tier1_feature_coverage/f02_draco_vr_decoupling.spec.ts',
  'tests/e2e/tier1_feature_coverage/f07_edge_line_segments.spec.ts',
  'tests/e2e/tier1_feature_coverage/f16_render_loop_gl_introspection.spec.ts',
  'tests/e2e/tier2_boundary_corner/f02_boundary.spec.ts',
  'tests/e2e/tier2_boundary_corner/f07_boundary.spec.ts',
  'tests/e2e/tier3_cross_feature/suite_3_1_arch_memory.spec.ts',
  'tests/e2e/tier4_real_world/scenario1_large_scale_analytics.spec.ts',
  'tests/e2e/tier4_real_world/scenario5_complete_analyst_journey.spec.ts',
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
