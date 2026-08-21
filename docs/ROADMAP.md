# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product/research direction and architecture are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. The executable migration sequence is `docs/IMPLEMENTATION_PLAN_V3.md`. Older Gate/Sprint numbering is historical and does not imply V3 completion.

## Current Status — 21 August 2026

### V3 implementation underway

- **2026-08-20 — Adversarial Findings Remediation & Cryptographic/Statistical/Lifecycle Hardening (✅, merged from `feat/adversarial-findings-remediation`):**
  - **Prompt TEST (Test Integrity & Zero-Skip Parity Gates):** Removed conditional skips from `tests/wasm-runtime.test.ts`, wired Node/Vitest filesystem WASM loading in `RuntimeBridge.ts` alongside browser `fetch()`, achieving **26/26 WASM parity tests executing and passing with 0 skipped**. Removed `@ts-nocheck` across touched test suites.
  - **Prompt SECURITY (Archive, URL, Digest, & Provenance Security):** Hardened `NemosynePackage.ts` with streaming `fflate` Unzip extraction, bounded budgets (`MAX_ARCHIVE_SIZE = 100MB`, `MAX_TOTAL_UNCOMPRESSED = 250MB`, `MAX_ENTRY_COUNT = 1000`, `MAX_SINGLE_ENTRY = 100MB`), and multi-layer percent-encoded path traversal neutralization (`sanitizeEntryPath`). Hardened `ShareableSessionURL.ts` with protocol allowlist (`http:`, `https:`), UTF-8 base64url encoding, and strict schema whitelist stripping secret credentials (`authToken`). Updated `InvestigationDigest.ts` with real `CapabilityError` inheritance, RFC 8259/8785 compliant canonical array `undefined` -> `null` serialization, `-0` normalization, and cycle detection.
  - **Prompt ATLAS (Atlas Transactions, Investigation DAG, & Monotonic Versions):** Made `AnalyticalState.commitKernelResult` atomic and exception-safe by cloning/preparing JS objects before touching handles. Upgraded `InvestigationGraph.ts` with iterative 3-state DFS cycle detection, outgoing/incoming adjacency index maps, and strict `fromJSON` validation. Made `InvestigationAggregate.restoreState` validate DAG integrity prior to mutating live state. Ensured `AtlasCore.resetAnalysis` monotonically advances `datasetVersion` and attaches reset operation/version nodes.
  - **Prompt RUST (Rust Structure Profile & WASM Parity):** Upgraded `wasm/src/data/profile.rs` with iterative 3-state DFS cycle detection, 64-bit cell count arithmetic in missingness calculations to eliminate wasm32 overflow risk, and verified deterministic silhouette and clustering metrics against reference vectors.
  - **Prompt STUDY (Study Protocol Governance, Crossover Statistics, & Exporter):** Upgraded `StudyStatisticalAnalyzer.ts` with exact zero-variance constant difference handling ($p = 0.0$ for deterministic positive/negative improvements) and log-transform approximation for Student-t tail probabilities. Updated `StudyDataExporter.ts` with whitespace-aware formula injection prevention (`/^\s*[=+\-@\t\r]/` + control characters) and dual CSV export functions (`toSpreadsheetSafeCSV` and `toLosslessCSV`).
  - **Prompt COLLAB & VR (Collaboration Lifecycle, Live Ingestion, & GPU Teardown):** Implemented deep recursive GPU geometry and material disposal in `PeerAvatarManager.ts` on peer disconnect (`removePeer`), `clearAll()`, and `dispose()`, preventing WebGL resource leaks during multi-user sessions.
  - **Gates:** `tsc --noEmit` 0 errors · `eslint` 0 errors (166 warnings, test-scoped) · `cargo test` 89/89 passed · `npm test` 248/248 test files passed (1,643 passed / 0 skipped in parity suite) · `npm run build` exit 0.
- **2026-08-21 — Representation validation suite repair (on `feature/v3-gate0-moneta-authority`):** Fixed the failing Gate 2 AtlasCore integration and synthetic representation validation tests, and closed a FIELD-topology fitness gap in the bootstrap `FitnessModel.scoreStructure` so vector-field/geospatial datasets can select the FIELD family whose `VECTOR_STREAMLINE`/`GEO_SURFACE` layouts are purpose-built for them. Full gate green: `tsc --noEmit` 0 errors · `eslint` 0 errors · `cargo + vitest` 255 files / 1669 tests passed.

Baseline V3 governing merge: `13dd7459555d35ac718710a50f357e022c456731` (`docs: adopt V3 discovery-centric vision and modular implementation plan (#225)`).

Active implementation PR: **#226 — `feature/v3-gate0-moneta-authority`**.

The repository retains strong foundations in Rust/WASM analytical authority, Investigation semantics, deterministic/replay infrastructure, Moneta's dataset-aware migration, study controls, VR interaction and package integrity. V3 deliberately reopens architectural completion claims where the old roadmap measured presence of infrastructure rather than the new discovery-centric exit criteria.

PR #226 begins the correctness-first migration by making the legacy Draco namespace mechanically adapter-only, introducing a versioned bootstrap FitnessModel, routing the live Moneta hypothesis engine through that model, and representing ambiguity/abstention explicitly instead of presenting heuristic utility as confidence. Final completion claims remain contingent on CI and the remaining gate criteria below.

### Governing V3 gates

| Gate | Status | Current evidence / next exit work |
|---|---|---|
| 0 — Authority reconciliation | **IN PROGRESS** | PR #226 adds a recursive architecture test requiring `src/draco/` to contain Moneta re-export adapters only. Rust and Investigation authority still need broader boundary tests and import/call-site inventory. |
| 1 — Dataset Evidence | **PARTIAL** | Rust structure/spectral/profile capabilities exist. They must become a typed `DatasetEvidence` contract with complete method/parameter/seed/normalisation/missing-data/version/limitations provenance. |
| 2 — Representation Language | **NOT COMPLETE** | Existing representation families/candidates are bootstrap inputs. Need primitive registry, versioned ontology, `RepresentationGraph` and composition grammar. |
| 3 — Moneta correctness | **IN PROGRESS** | PR #226 adds explicit `BootstrapFitnessModel`, active weight normalization, density handling, configured-prior terminology, complete public requirement coverage, utility semantics and decision status/margin, deterministic weight-sensitivity analysis, and FIELD-topology fitness alignment. Metamorphic validation and downstream confidence-terminology cleanup remain. |
| 4 — NIL | **NOT STARTED AS FIRST-CLASS MODULE** | Existing interaction actions/modes are inputs. Need modality-independent semantic command schema, provenance and replay. |
| 5 — Discovery | **PARTIAL** | Observation/Finding/Evidence infrastructure exists. Need first-class `DiscoveryEpisode`, hypothesis lifecycle and validation states. |
| 6 — Human refinement | **PARTIAL / EXPERIMENTAL INPUTS EXIST** | Existing empirical tuning/study outcomes are not yet the V3 judgement pipeline. Need pairwise preference, weight adjustment and discovery-outcome events with provenance. |
| 7 — Learning infrastructure | **DEFERRED UNTIL EVIDENCE CONTRACTS** | Need curated judgement store, holdout discipline and model registry before training. |
| 8 — Learned Moneta | **DEFERRED** | No claim of empirical validity until held-out comparison against bootstrap heuristics. |
| 9 — Compositional Moneta | **DEFERRED** | Depends on Gate 2 RepresentationGraph and Gate 3 correctness. |
| 10 — Adaptive Nemosyne | **DEFERRED** | Depends on validated learning, freeze controls, monitoring and rollback. |

## Immediate work queue

### P0 — Gate 0 authority reconciliation

- [ ] Inventory all `src/draco/` and `src/moneta/` imports, exports and runtime call sites.
- [ ] Classify Draco code as compatibility adapter, neutral representation contract, renderer helper or obsolete reasoning authority.
- [ ] Move neutral contracts into `src/representation/` where appropriate.
- [x] Ensure legacy `src/draco/` is mechanically restricted to Moneta compatibility re-exports.
- [x] Add an architecture test that fails if implementation/scoring authority is added under `src/draco/`.
- [ ] Verify all live representation scoring/ranking/selection authority resides in `src/moneta/`, including non-Draco call sites.
- [ ] Delete obsolete compatibility files once import inventory proves they have no live consumers.
- [ ] Verify research-relevant analytical facts consumed by Moneta originate in Rust/WASM or fail explicitly.
- [ ] Verify representation decisions and future model/NIL/discovery provenance persist through Investigation rather than renderer/session state.

### P0 — Moneta falsifiability/correctness

- [x] Introduce explicit versioned bootstrap `FitnessModel` and route the live `MonetaHypothesisEngine` through it.
- [x] Enforce finite non-negative active weights and `sum(activeWeights) == 1` within defined tolerance.
- [x] Implement the declared density-handling fitness dimension rather than leaving `w_density` dead.
- [x] Give every declared `StructureRequirementType` a defined task-scoring effect in the bootstrap model.
- [x] Add `DECISIVE | AMBIGUOUS | INFEASIBLE | UNDERDETERMINED` decision states with winner/runner-up/margin.
- [x] Rename the active preference contribution from “empirical prior” to `configuredPrior`; it is explicitly not an empirical probability.
- [x] Stop emitting `confidence` / `confidenceScore` from live `RepresentationDecision`; persist utility/status/margin/FitnessModel version through Investigation digest instead.
- [ ] Remove or rename remaining downstream compatibility fields that still use confidence terminology, including legacy `SpatialStrategy` contracts and study/export consumers where semantically appropriate.
- [x] Add deterministic weight sensitivity analysis.
- [ ] Add metamorphic tests: row shuffle invariance; column rename invariance absent semantic change; duplication affects scale/density according to policy.
- [ ] Validate the representation ontology and bootstrap scores against human outcome evidence before making empirical claims.

### P1 — Parallel foundation modules after Gate 0 contracts

The following are intended to proceed in parallel once authority boundaries are stable:

1. **Dataset Evidence:** typed Rust schema + WASM boundary + provenance/replay tests.
2. **Representation Ontology:** primitive registry + `RepresentationGraph` + grammar + canonical serialization.
3. **Investigation/Discovery:** `DiscoveryEpisode`, hypothesis lifecycle, validation and headless replay.
4. **NIL:** semantic command envelope, provenance, modality adapters and replay.

Persistence and CI evolve continuously across all four.

### P2 — Integration wave

- Moneta consumes `DatasetEvidence` and Representation Ontology contracts.
- Existing single-family decisions are represented as simple `RepresentationGraph`s before composition search is introduced.
- Spatial Runtime becomes the graph embodiment adapter and does not reinterpret Moneta semantics.
- Research Harness freezes exact Rust/Moneta/Fitness/Ontology/NIL/perception versions.
- 2D and VR treatments consume equivalent semantic representation contracts.

## Documentation cleanup policy

Every PR touching an architectural area must update active documentation. Superseded active prose is either rewritten to V3 terminology or moved to `docs/archive/` when it has historical value. Obsolete docs without enduring value should be deleted. The repository must not maintain two live descriptions of representation authority, research goals or implementation gates.

## Verification baseline

Every implementation PR should run, as applicable:

```text
tsc --noEmit
eslint
npm test
cargo test
npm run wasm:dev
npm run build
npm run audit:hygiene
```

Focused correctness/parity tests are mandatory for claimed functionality. A skipped test is not evidence for a claimed gate.

## Recently completed foundations retained from the pre-V3 roadmap

These remain useful inputs to V3, but their old gate labels are historical:

- deterministic Rust/WASM analytical kernel and explicit unavailable/degraded states;
- Investigation aggregate, DAG, evidence ledger, canonical digest and replay/package hardening;
- Moneta dataset-aware representation migration and deterministic hard constraints;
- representation/embodiment separation work;
- study treatment controls and statistical/export hardening;
- VR interaction state machine, gesture ownership, spatial grounding and panel-role governance;
- collaboration authentication/security and lifecycle hardening;
- CI Rust/WASM/browser parity and hygiene gates.

Detailed historical sprint narratives belong in `docs/archive/ROADMAP_HISTORY.md` rather than this current-status file.

## Pickup instruction

Continue PR #226 until Gate 0 authority tests and the first Moneta correctness slice are CI-clean. Then begin the P1 foundation modules as separate branches where their public contracts no longer depend on unresolved Gate 0 ownership. Do not implement learning or compositional search ahead of the evidence/representation/NIL contracts merely because those later features are more sophisticated. V3's sequence is designed to make the eventual intelligence falsifiable, reproducible and scientifically interpretable.
