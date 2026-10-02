export const FAST_NODE_TESTS = [
  'tests/tec1-v3-package.test.ts',
  // Registered here by the #834 corrective lane, which owns this file: #842
  // landed this kernel-less consumer-policy binding test deliberately
  // unregistered because the seam was held by the in-flight #834 branch. It
  // still ran in the integration lane, which globs; this puts it in the fast
  // lane its author intended.
  'tests/tec1-consumer-policy.test.ts',
  // The loader-side half of the same tranche: the policy the governed loader
  // consults, the properties that keep that seam from reverting, and the
  // substituted-policy falsifiers that show the decision really is the policy's.
  'tests/tec1-consumer-policy-wiring.test.ts',
  'tests/tec1-consumer-policy-loader-decision.test.ts',
  'tests/tec1-governed-export.test.ts',
  'tests/tec1-governed-capture-ports.test.ts',
  // RFC 0009 tranche 3 slice 2 follow-up: unit-level falsifiers for the Worker
  // capture path's single-pass preference, driven in-process against the real
  // worker module with a RuntimeBridge mock.
  'tests/tec1-governed-capture-worker-single-pass.test.ts',
  // RFC 0009 tranche 3 slice 2: the production-path falsifiers for minted
  // governed uses (composition -> session export -> replay loader) and the
  // mutated-registry refusals over byte-identical archives.
  'tests/tec1-governed-use-minting.test.ts',
  'tests/tec1-mutated-policy-refusal.test.ts',
  'tests/tec1-f1-governed-replay.test.ts',
  'tests/tec1-f1-replay-attestation-text.test.ts',
  'tests/tec1-f1-continuity-attestation.test.ts',
  // TEC3-MA2 first slice: deterministic control fixtures over the fitness
  // model's boost gate (MA1 F-1), the anomaly-score floor (MA1 K-8) and the
  // periodicity null closure (MA1 K-5), with kernel-mock profiles.
  'tests/tec3-ma2-fitness-model-controls.test.ts',
  'tests/tec3-ma2-anomaly-floor-readback.test.ts',
  'tests/tec3-ma2-spectral-null-closure.test.ts',
  // TEC3-MA2 second slice: decision-layer control fixtures over the scale
  // envelope (F-3), information preservation (F-4), the p>=n gate (F-13),
  // DecisionPolicy thresholds (F-14), weight sensitivity (F-15) and the
  // signature equality gate (F-16).
  'tests/tec3-ma2-decision-layer-controls.test.ts',
  // TEC3-MA2 third slice: promotion-gate control fixtures over group-balanced
  // pairwise accuracy (P-1), the one-sided sign-test alpha boundary (P-2),
  // the leave-one-group-out improvement floor (P-3), feature-vector coupling
  // in the learned pairwise layer (P-4) and the gesture quality bar and
  // staged-deployment seam (P-5).
  'tests/tec3-ma2-promotion-gate-controls.test.ts',
  // TEC3-MA2 fourth slice: F-5 density-ladder controls (canonical never-set
  // densityVariation gate, hand-set rungs incl. the registry-unreachable 0.75)
  // and F-7 perceptual-fitness controls (prior/observed blends, surrogate
  // inputs, frustum-exclusion hard-constraint route, 32 px normalization).
  'tests/tec3-ma2-f5-f7-controls.test.ts',
  'tests/analyst-judgement-controller.test.ts',
  'tests/collaboration-recovery.test.ts',
  'tests/coordinator-consumer-contracts.test.ts',
  'tests/draco-production-import-boundary.test.ts',
  'tests/evidence-requirement-profile.test.ts',
  'tests/hygiene-audit.test.ts',
  'tests/moneta-gate0-authority.test.ts',
  'tests/moneta-evidence-scorer-authority.test.ts',
  'tests/moneta-kernel-fixture-producer-contract.test.ts',
  'tests/moneta-layout-authority.test.ts',
  'tests/moneta-scoring-ownership.test.ts',
  'tests/p1w1-collaboration-invite.test.ts',
  'tests/p1w1-signalling-runtime-config.test.ts',
  'tests/p1w1-signalling-service-runtime.test.ts',
  'tests/production-capability-registry.test.ts',
  'tests/pt3b-governed-event-contracts.test.ts',
  'tests/pt4b-browser-pkce-producer.test.ts',
  'tests/pt4b-consent-capture-authority.test.ts',
  'tests/pt4b-data-plane-auth.test.ts',
  'tests/pt4b-governance-composition-client-config.test.ts',
  'tests/pt4b-governance-http-surface.test.ts',
  'tests/pt4b-governed-event-ingestion.test.ts',
  'tests/pt4b-http-resource-budgets.test.ts',
  'tests/pt4b-lifecycle-export-erasure.test.ts',
  'tests/pt4b-lifecycle-restart.test.ts',
  'tests/pt4b-oidc-jwks-authority.test.ts',
  'tests/pt4b-runtime-manifest-authority.test.ts',
  'tests/pt4b9-postgres-migration-authority.test.ts',
  'tests/pt4b9b-postgres-cutover.test.ts',
  'tests/q2-dataset-identity-cross-language-golden.test.ts',
  'tests/q2-dataset-identity-parity.test.ts',
  'tests/q2-dataset-identity-properties.test.ts',
  'tests/quest-device-declaration.test.ts',
  'tests/quest-loadtest-sink.test.ts',
  'tests/quest-validation-manifest.test.ts',
  'tests/runtime-bridge-module-boundaries.test.ts',
  'tests/uv0-baseline-inventory.test.ts',
  'tests/uxr0-hot-path-allocation.test.ts',
  'tests/uxr0-replacement-qualification.test.ts',
  'tests/uxr0-worker-transfer-diagnostics.test.ts',
  'tests/wasm-unsafe-inventory.test.ts',
  'tests/world-lifecycle-owner.test.ts',
];

export const UI_ONLY_TESTS = [
  'tests/adaptive-assist-controller.test.ts',
  'tests/ai-gesture-jit-hints.test.ts',
  'tests/asymmetric-desktop-companion.test.ts',
];

export const WASM_TESTS = [
  'tests/tec1-v3-package-wasm.test.ts',
  'tests/tec1-governed-export-wasm.test.ts',
  'tests/tec1-governed-capture-authority-wasm.test.ts',
  'tests/tec1-governed-capture-worker-runtime.test.ts',
  // RFC 0009 tranche 3 slice 2: end-to-end production-path falsifier —
  // real live-kernel governed export, committed bytes replayed through the
  // real loader under the real registry (kernel-minted attestation, minted
  // uses, policy enforcement actually applied).
  'tests/tec1-governed-use-minting-live.test.ts',
  'tests/tec1-statistics-evidence-receipts.test.ts',
  'tests/uxr3-statistics-json-wasm.test.ts',
  'tests/uxr3-semantic-transfer-wasm.test.ts',
  'tests/uxr3-spectral-transfer-wasm.test.ts',
  'tests/uxr3-prepared-results-wasm.test.ts',
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
  'tests/interaction-grammar-cts-coherence.test.ts',
  'tests/layout-binding-panel-typing.test.ts',
  'tests/moneta-known-structure-campaign-wasm.test.ts',
  'tests/moneta-metamorphic-provenance.test.ts',
  'tests/performance-budget.test.ts',
  'tests/production-runtime-wiring.test.ts',
  'tests/q2-dataset-identity-cross-language-wasm.test.ts',
  'tests/representation-topology-node.test.ts',
  'tests/rf062c-world-production-path.test.ts',
  'tests/runtime-bridge-concurrency.test.ts',
  'tests/runtime-recovery-endurance.test.ts',
  'tests/subsystem-resiliency-audit.test.ts',
  'tests/semantic-drill-down.test.ts',
  'tests/vr-data-operations.test.ts',
  'tests/vr-metaphors.test.ts',
  'tests/vr-scalable-artefacts.test.ts',
  'tests/vr-topology-translator-live.test.ts',
  'tests/wasm-abi-hardening.test.ts',
  'tests/wasm-columnar-structure-profile.test.ts',
  'tests/wasm-host-buffer-ownership.test.ts',
  'tests/wasm-layouts.test.ts',
  'tests/wasm-row-identity.test.ts',
  'tests/wasm-runtime.test.ts',
  'tests/world-coverage.test.ts',
  'tests/world-recreation-lifecycle.test.ts',
  'tests/world.test.ts',
  'tests/zero-alloc-instanced-buffer.test.ts',
];
