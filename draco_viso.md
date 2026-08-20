# Draco Dataset-Aware Representation Reasoning Engine

## Context

Nemosyne's Draco system currently evaluates 3,168 candidate visual specifications (layout x geometry x behavior x interaction) and selects the lowest-cost spec. The `ConstraintArbiter` improves on this by producing a richer `SpatialStrategy` with rejection logs. However, both systems jump straight to **layout/geometry** — they never ask the deeper question: *"What structural property of this dataset should be represented, and which representational family best exposes it?"*

This migration introduces an explicit **representation reasoning layer** above the existing solver. Draco will first select a `RepresentationFamily` (Point, Distribution, Cluster, Graph, Field, Topology, Temporal, Hierarchical, Frequency) based on a `DatasetSignature`, then delegate to the existing `ConstraintArbiter`/`ConstraintEngine` for spatial embodiment. The existing solver is preserved underneath — this is a wrapping migration, not a replacement.

The architectural principle: **Representation follows structure.** Rendering primitives must never become analytical authorities. Rust/WASM remains the sole analytical engine; Draco remains a pure fact consumer.

---

## Phase 1: Introduce Representation Ontology Types (No Behavioral Change)

**Goal:** Add `RepresentationFamily`, `DatasetSignature`, and `RepresentationDecision` type definitions. No runtime behavior changes.

### New Files
- `src/draco/representation/RepresentationFamily.ts` — `RepresentationFamily` union type (9 families), `LAYOUT_TO_FAMILY` mapping (existing 6 layouts → families), `FAMILY_TO_LAYOUTS` reverse mapping
- `src/draco/representation/DatasetSignature.ts` — `DatasetSignature` interface (schema, cardinality, distribution, dependence, clusterStructure, anomalyStructure, temporalStructure, spatialStructure, topologicalStructure, spectralStructure, provenance), `SpectralFacts` interface, `buildDatasetSignature()` + `minimalDatasetSignature()` function signatures
- `src/draco/representation/RepresentationDecision.ts` — `RepresentationDecision` interface (representationFamily, confidence, evidence[], rejectedAlternatives[], embodiment, scalePolicy, progressiveDisclosurePolicy, datasetSignature, provenance), `RepresentationEvidence`, `RejectedAlternative`, `ProgressiveDisclosurePolicy`, `ScalePolicy`, `RepresentationEmbodiment`
- `src/draco/representation/index.ts` — Barrel export

### Modified Files
- `src/draco/index.ts` — Add representation submodule exports

### Tests
- `tests/representation-types.test.ts` — Verify layout-to-family mappings are consistent, `buildDatasetSignature` maps fields correctly, `RepresentationDecision` is constructible

### Acceptance
- `tsc --noEmit` passes; `npm test` passes; no runtime behavior changes

---

## Phase 2: Extract DatasetSignature from Existing AtlasCore Facts

**Goal:** Wire `DatasetSignature` construction into `AtlasCore`. Computed but not yet consumed for representation selection.

### New Files
- `src/draco/representation/SignatureBuilder.ts` — Full implementation of `buildDatasetSignature()` (maps `DracoFacts` + kernel `Facts` → `DatasetSignature`) and `minimalDatasetSignature()` (schema-only fallback). Pure mapping, no analytical computation.

### Modified Files
- `src/atlas/domain/RepresentationState.ts` — Add `activeSignature: DatasetSignature | null`, `toDatasetSignature()` method
- `src/atlas/AtlasCore.ts` — Add `computeDatasetSignature()`, `activeDatasetSignature` getter

### Tests
- `tests/representation-signature.test.ts` — Test signature construction with mock facts (tabular, graph, temporal, geo), minimal fallback, AtlasCore integration

### Acceptance
- `DatasetSignature` available from `AtlasCore`; existing `dracoFacts()` and `arbitrateSpatialStrategy()` unchanged; all tests pass

---

## Phase 3: RepresentationHypothesisEngine (Separate Representation from Layout)

**Goal:** Introduce the reasoning engine that sits above `ConstraintArbiter`. It selects a `RepresentationFamily` via two-stage process (hard eligibility → utility scoring), then delegates to `ConstraintArbiter` for embodiment. Output is a `RepresentationDecision` wrapping `SpatialStrategy`.

### New Files
- `src/draco/representation/RepresentationHypothesisEngine.ts` — Two-stage reasoning engine:
  - **Stage A (Eligibility):** Hard constraints per family (TEMPORAL requires temporal columns; HIERARCHICAL requires hierarchy topology; GRAPH requires edges/graph; FIELD requires vector field; FREQUENCY requires spectral periodicity; TOPOLOGY requires persistent TDA features; CLUSTER requires >1 estimated cluster; POINT/DISTRIBUTION always eligible)
  - **Stage B (Utility):** Evidence-based scoring per family with explicit weights. Each scorer returns `{score, evidence[]}`. Scoring formula: `utility = structural_fit + semantic_fit + analytical_relevance + perceptual_affordance + scalability + interaction_fit - complexity - ambiguity`
  - **Delegation:** Calls `ConstraintArbiter.arbitrate(facts, requirements)` for embodiment → wraps result in `RepresentationDecision.embodiment.spatialStrategy`
  - **Output:** `RepresentationDecision` with evidence[], rejectedAlternatives[], progressiveDisclosurePolicy (primary/secondary/detail families), scalePolicy

### Modified Files
- `src/atlas/domain/RepresentationState.ts` — Add `activeDecision: RepresentationDecision | null`, `arbitrateRepresentation()` method
- `src/atlas/AtlasCore.ts` — Add `arbitrateRepresentation()`, `activeRepresentationDecision` getter
- `src/investigation/InvestigationDigest.ts` — Extend `CanonicalInvestigationInput.representationDecision` to include `representationFamily`

### Tests
- `tests/representation-hypothesis.test.ts` — Temporal dataset → TEMPORAL; graph dataset → GRAPH; tabular explore → POINT/DISTRIBUTION; FREQUENCY rejected when spectralStructure null; decision wraps valid SpatialStrategy; rejectedAlternatives includes ineligible families with reasons; backward compat (ConstraintArbiter standalone still works; arbitrateSpatialStrategy still works)

### Acceptance
- `RepresentationHypothesisEngine` selects families based on `DatasetSignature`; `ConstraintArbiter` called underneath (not replaced); existing paths functional; all tests pass

---

## Phase 4: Integrate RepresentationDecision into DracoTopologyNode

**Goal:** `DracoTopologyNode` optionally consumes a `RepresentationDecision`. When available, uses the decision's embodiment spec; otherwise falls back to `ConstraintEngine.solve()` (backward compatible).

### Modified Files
- `src/draco/DracoTopologyNode.ts` — Add optional `representationDecision` constructor param; in `reSolveAndSynthesize()`, if decision present, build `SolverResult` from decision's embodiment spec (layout/geometry/behavior/interaction) instead of calling solver; add `setRepresentationDecision()` method
- `src/vr/World.ts` — After `DracoTopologyNode` creation, if atlas ready, call `arbitrateRepresentation()` and pass decision to node

### Tests
- `tests/representation-topology-node.test.ts` — Node with decision uses embodiment spec; node without decision falls back to ConstraintEngine; `setRepresentationDecision()` triggers re-solve; artifact spec matches decision embodiment

### Acceptance
- `DracoTopologyNode` optionally consumes decisions; existing behavior unchanged; `VRTopologyTranslator` unmodified; all tests pass

---

## Phase 5: Spectral Analysis in Rust/WASM

**Goal:** Implement FFT-based spectral analysis in the Rust kernel. New `SpectralFacts` struct, `compute_spectral_facts` function, wired through `RuntimeBridge`. Behind new `SPECTRAL_RUST` capability flag (telemetry-only).

### New Files (Rust)
- `wasm/src/data/spectral.rs` — `SpectralFacts` struct (dominant_frequencies, spectral_entropy, power_spectrum_peak, directional_anisotropy, characteristic_scale, has_periodicity, periodicity_confidence). `compute_spectral_facts(dataset, time_column, value_column)` function:
  1. Extract sorted (time, value) pairs from dataset
  2. Resample to uniform spacing
  3. Apply Hann window
  4. Compute FFT via `rustfft` crate
  5. Compute power spectrum = |X[k]|^2
  6. Find dominant frequencies (top-k peaks)
  7. Compute spectral entropy = -sum(p_k * log(p_k))
  8. Detect periodicity (dominant frequency power threshold)
  9. Compute characteristic scale = 1/dominant_frequency
  - Returns `None` for non-temporal columns or insufficient data (<4 points)
  - Rust `#[cfg(test)]` tests: sine wave → periodicity detected; white noise → high entropy, no periodicity; insufficient data → None

### Modified Files (Rust)
- `wasm/Cargo.toml` — Add `rustfft = "6.2"` dependency (pure Rust, wasm32-compatible)
- `wasm/src/data/mod.rs` — Add `pub mod spectral;`
- `wasm/src/lib.rs` — Add `data_compute_spectral_facts` WASM export (JSON params in, JSON out); add `CAP_SPECTRAL_RUST: u32 = 1 << 14` capability flag; add to `capabilities()` return

### Modified Files (TypeScript)
- `src/wasm/RuntimeBridge.ts` — Add `data_compute_spectral_facts` to WASM interface; add `computeSpectralFacts(handle, params)` typed wrapper
- `src/atlas/AtlasCore.ts` — Add `computeSpectralFacts(timeColumn, valueColumn)` method; add `computeSpectralFacts?` to `WasmRuntimeBridgeFull` interface
- `src/draco/representation/SignatureBuilder.ts` — When spectral facts available, populate `DatasetSignature.spectralStructure`

### Tests
- `tests/spectral-analysis.test.ts` — Mock kernel returning canned spectral facts; AtlasCore.computeSpectralFacts returns null when kernel unavailable; spectral facts integrated into DatasetSignature

### Acceptance
- FFT runs entirely in Rust/WASM; no TS FFT; spectral facts available via RuntimeBridge + AtlasCore; `DatasetSignature.spectralStructure` populated when available; capability flag telemetry-only; all tests pass

---

## Phase 6: FrequencyField Representation and Renderer

**Goal:** Add `FREQUENCY` family with `SPECTRAL_VOLUME` layout and renderer. First new representation family with no existing layout equivalent.

### New Files
- `src/draco/layouts/SpectralVolumeLayout.ts` — Layout: x-axis = frequency bins, y-axis = power, z-axis = time window. Uses `SpectralFacts` if available. Renderer layout only (not analytical computation).

### Modified Files
- `src/draco/types.ts` — Add `'SPECTRAL_VOLUME'` to `VRLayout`; add `'SPECTRAL_BAR'`/`'SPECTRAL_SURFACE'` to `VRGeometry`; add `'FREQUENCY_PROBE'` to `VRInteraction`
- `wasm/src/draco/types.rs` — Mirror new variants in Rust
- `src/draco/ConstraintEngine.ts` — Add new channels to `VRChannels` arrays
- `src/draco/VRTopologyTranslator.ts` — Add `_buildSpectralVolume()` method + dispatch case
- `src/draco/representation/RepresentationFamily.ts` — Update `FAMILY_TO_LAYOUTS.FREQUENCY: ['SPECTRAL_VOLUME']`
- `src/draco/layouts/index.ts` — Add `SpectralVolumeLayout` export
- `src/draco/PositionSemantics.ts` — Add `SPECTRAL_VOLUME` case (SEMANTIC, frequency domain)
- `wasm/src/draco/constraints.rs` — Add hard constraint: SPECTRAL_VOLUME requires spectral facts (handled at hypothesis engine level via FREQUENCY eligibility)

### Tests
- `tests/frequency-field.test.ts` — SpectralVolumeLayout produces valid positions; VRTopologyTranslator synthesizes spectral volume artifact; hypothesis engine selects FREQUENCY when spectralStructure.hasPeriodicity=true; FREQUENCY rejected when spectralStructure null; new types accepted by ConstraintEngine; PositionSemantics for SPECTRAL_VOLUME

### Acceptance
- SPECTRAL_VOLUME layout in type system; VRTopologyTranslator can synthesize spectral volume; FREQUENCY selectable when spectral facts indicate periodicity; FFT only for semantically appropriate domains; all existing tests pass (additive changes)

---

## Phase 7: Explanation Traces

**Goal:** Every `RepresentationDecision` emits structured `evidence[]` and `rejectedAlternatives[]`. Wire into investigation digest and VR diagnostic HUD.

### Modified Files
- `src/draco/representation/RepresentationHypothesisEngine.ts` — Enrich all 9 family utility scorers to produce detailed `RepresentationEvidence` objects (fact string, weight, supports boolean, source: 'kernel'|'heuristic'|'user-requirement'). Each evidence entry traces back to a specific DatasetSignature field.
- `src/investigation/InvestigationDigest.ts` — Extend `CanonicalInvestigationInput.representationDecision` to include full evidence and rejection trace arrays
- `src/atlas/domain/InvestigationAggregate.ts` — In `computeDigest()`, include representation decision evidence and rejected alternatives from `activeDecision`

### Tests
- `tests/representation-explanation.test.ts` — Every decision has non-empty evidence for winning family; each evidence entry has all fields; rejectedAlternatives includes all ineligible families with reasons; investigation digest includes representation decision evidence; digest deterministic (same decision → same digest); existing digests without representation decisions still compute correctly

### Acceptance
- Every decision includes evidence and rejected alternatives; traces structured and machine-readable; investigation digest includes representation details; backward compatible; all tests pass

---

## Phase 8: Synthetic Dataset Validation Suite

**Goal:** Known-structure synthetic datasets verify representation selection is correct and deterministic.

### New Files
- `tests/synthetic/representation-fixtures.ts` — 9+ fixtures, each with: name, description, mock `DracoFacts`, mock `Facts`, mock `SpectralFacts`, pre-computed `DatasetSignature`, `RepresentationRequirements`, `expectedFamily`, `expectedConfidenceRange`:
  1. `random-noise` → POINT
  2. `clustered-data` → CLUSTER
  3. `periodic-signal` → FREQUENCY
  4. `multiscale-anisotropic` → CLUSTER
  5. `anomalous-outliers` → DISTRIBUTION
  6. `social-network` → GRAPH
  7. `time-series-trend` → TEMPORAL
  8. `organizational-hierarchy` → HIERARCHICAL
  9. `wind-vector-field` → FIELD

- `tests/representation-synthetic-validation.test.ts` — `describe.each(SYNTHETIC_FIXTURES)`: verifies selected family matches expected, confidence within range, evidence non-empty, rejected alternatives have reasons

### Acceptance
- 9+ synthetic datasets cover all primary representation families; each fixture passes validation; selection is deterministic and explainable; all existing tests pass

---

## Phase Dependency Graph

```
Phase 1 (Types) → Phase 2 (Signature) → Phase 3 (Hypothesis Engine) → Phase 4 (TopologyNode)
                                    ↓                         ↓
                              Phase 5 (Rust Spectral) ←─┘    Phase 7 (Explanation Traces)
                                    ↓                         ↓
                              Phase 6 (FrequencyField)    Phase 8 (Synthetic Validation)
```

Phases 5 and 7 can run in parallel with Phase 4. Phase 8 depends on 3 + 7.

---

## Key Architectural Decisions

1. **RepresentationDecision wraps SpatialStrategy** — not replaces it. `ConstraintArbiter` and `ConstraintEngine` continue to work standalone. The new layer adds conceptual depth above them.
2. **DatasetSignature is a pure mapping** — no analytical computation. It maps kernel `Facts` + `DracoFacts` + `SpectralFacts` into a structured contract. All computation stays in Rust.
3. **RepresentationHypothesisEngine is a pure reasoning engine** — it performs no analytical computation. It reasons over `DatasetSignature` using explicit, versioned, inspectable rules. No opaque AI/ML model.
4. **Spectral analysis is Rust-only** — `rustfft` crate handles FFT. No TypeScript FFT. `SPECTRAL_RUST` capability flag is telemetry-only (per CLAUDE.md rules).
5. **Existing layouts reclassified, not deleted** — Grid3D→Point, ForceDirected3D→Graph, RadialTree→Hierarchical, TimeSeriesRibbon→Temporal, Streamline→Field, GeoSurface→Point(geospatial). New `SPECTRAL_VOLUME` added for Frequency.
6. **Progressive disclosure is type-level first** — `ProgressiveDisclosurePolicy` (primary/secondary/detail families) is defined in Phase 3. Actual multi-LOD rendering is follow-up work.
7. **Backward compatibility throughout** — Every phase preserves existing tests, investigations, and reproducibility. The investigation digest extension is additive.

---

## Verification

After each phase, run the full CI gate:
```bash
tsc --noEmit           # 0 errors
npx eslint . --ext .ts # 0 errors
cargo test --manifest-path wasm/Cargo.toml  # all pass
npm test               # all pass
npm run build          # exit 0
npm run audit:hygiene  # 8/8
```

After Phase 8 (complete migration), verify acceptance criteria:
- Draco selects representation family before layout/geometry
- DatasetSignature exists as explicit analytical contract
- Representation families distinct from layouts in type system
- Rust remains sole analytical authority (including FFT)
- Draco remains pure fact consumer
- Existing layouts, tests, and investigations work unchanged
- Every representation decision is explainable (evidence + rejected alternatives)
- FFT only for semantically appropriate domains (temporal/regular-sampled)
- Synthetic datasets demonstrate correct representation selection
- No opaque AI model in the decision loop

---

## Files Summary

### New TypeScript (7)
| File | Phase |
|---|---|
| `src/draco/representation/RepresentationFamily.ts` | 1 |
| `src/draco/representation/DatasetSignature.ts` | 1 |
| `src/draco/representation/RepresentationDecision.ts` | 1 |
| `src/draco/representation/index.ts` | 1 |
| `src/draco/representation/SignatureBuilder.ts` | 2 |
| `src/draco/representation/RepresentationHypothesisEngine.ts` | 3 |
| `src/draco/layouts/SpectralVolumeLayout.ts` | 6 |

### New Rust (1)
| File | Phase |
|---|---|
| `wasm/src/data/spectral.rs` | 5 |

### New Tests (8)
| File | Phase |
|---|---|
| `tests/representation-types.test.ts` | 1 |
| `tests/representation-signature.test.ts` | 2 |
| `tests/representation-hypothesis.test.ts` | 3 |
| `tests/representation-topology-node.test.ts` | 4 |
| `tests/spectral-analysis.test.ts` | 5 |
| `tests/frequency-field.test.ts` | 6 |
| `tests/representation-explanation.test.ts` | 7 |
| `tests/synthetic/representation-fixtures.ts` + `tests/representation-synthetic-validation.test.ts` | 8 |

### Modified TypeScript (12)
| File | Phases |
|---|---|
| `src/draco/index.ts` | 1 |
| `src/draco/types.ts` | 6 |
| `src/draco/ConstraintEngine.ts` | 6 |
| `src/draco/VRTopologyTranslator.ts` | 6 |
| `src/draco/DracoTopologyNode.ts` | 4 |
| `src/draco/PositionSemantics.ts` | 6 |
| `src/draco/layouts/index.ts` | 6 |
| `src/atlas/AtlasCore.ts` | 2, 3, 5 |
| `src/atlas/domain/RepresentationState.ts` | 2, 3 |
| `src/atlas/domain/InvestigationAggregate.ts` | 7 |
| `src/investigation/InvestigationDigest.ts` | 3, 7 |
| `src/vr/World.ts` | 4 |
| `src/wasm/RuntimeBridge.ts` | 5 |

### Modified Rust (5)
| File | Phases |
|---|---|
| `wasm/Cargo.toml` | 5 |
| `wasm/src/lib.rs` | 5 |
| `wasm/src/data/mod.rs` | 5 |
| `wasm/src/draco/types.rs` | 6 |
| `wasm/src/draco/constraints.rs` | 6 |