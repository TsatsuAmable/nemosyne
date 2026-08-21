# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product/research direction and architecture are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. The executable migration sequence is `docs/IMPLEMENTATION_PLAN_V3.md`. Older Gate/Sprint numbering is historical and does not imply V3 completion.

## Current Status — 21 August 2026

### V3 alignment initiated

Baseline `main`: `890071b6568cfb8038806c860648dc229bfc1b88` (`fix(moneta): enforce deterministic hard constraints (#224)`).

The repository has strong foundations in Rust/WASM analytical authority, Investigation semantics, deterministic/replay infrastructure, Moneta's dataset-aware migration, study controls, VR interaction and package integrity. V3 deliberately reopens architectural completion claims where the old roadmap measured presence of infrastructure rather than the new discovery-centric exit criteria.

### Governing V3 gates

| Gate | Status | Current evidence / next exit work |
|---|---|---|
| 0 — Authority reconciliation | **IN PROGRESS** | Moneta exists, but `src/draco/` compatibility/legacy paths must be proven adapter-only and duplicate representation reasoning deleted. Rust and Investigation authority require boundary tests. |
| 1 — Dataset Evidence | **PARTIAL** | Rust structure/spectral/profile capabilities exist. They must become a typed `DatasetEvidence` contract with complete method/parameter/seed/normalisation/missing-data/version/limitations provenance. |
| 2 — Representation Language | **NOT COMPLETE** | Existing representation families/candidates are bootstrap inputs. Need primitive registry, versioned ontology, `RepresentationGraph` and composition grammar. |
| 3 — Moneta correctness | **IN PROGRESS** | Deterministic hard constraints improved in #224. Need explicit `FitnessModel`, complete requirement coverage, utility terminology, abstention, sensitivity and metamorphic tests. |
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
- [ ] Ensure all live representation scoring/ranking/selection authority resides in `src/moneta/`.
- [ ] Delete obsolete Draco solver/arbiter logic after compatibility tests prove no live dependency.
- [ ] Add architecture test forbidding representation scoring outside Moneta.
- [ ] Verify research-relevant analytical facts consumed by Moneta originate in Rust/WASM or fail explicitly.
- [ ] Verify representation decisions and future model/NIL/discovery provenance persist through Investigation rather than renderer/session state.

### P0 — Moneta falsifiability/correctness

- [ ] Rename uncalibrated `confidence` / `confidenceScore` representation utility to `utilityScore` / `fitnessScore` in active APIs and UI.
- [ ] Introduce explicit versioned `FitnessModel`.
- [ ] Enforce finite non-negative active weights and `sum(activeWeights) == 1` within defined tolerance.
- [ ] Ensure every declared requirement has a constraint/scoring/evidence/test effect or remove it from the public ontology until implemented.
- [ ] Add `DECISIVE | AMBIGUOUS | INFEASIBLE | UNDERDETERMINED` decision states.
- [ ] Add winner/runner-up/margin and deterministic sensitivity analysis.
- [ ] Rename developer-authored “empirical” metadata/priors to heuristic/configured terminology until measured evidence exists.
- [ ] Add metamorphic tests: row shuffle invariance; column rename invariance absent semantic change; duplication affects scale/density according to policy.

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

Start with the first unchecked P0 item. Do not implement learning or compositional search ahead of the evidence/representation/NIL contracts merely because those later features are more sophisticated. V3's sequence is designed to make the eventual intelligence falsifiable, reproducible and scientifically interpretable.