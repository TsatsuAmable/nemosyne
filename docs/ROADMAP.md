# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product/research direction and architecture are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. The executable migration sequence is `docs/IMPLEMENTATION_PLAN_V3.md`. Older Gate/Sprint numbering is historical and does not imply V3 completion.

## Current Status — 22 August 2026

### V3 implementation underway

Nemosyne has moved beyond the original Gate 0 Moneta authority repair into evidence-governed learning/runtime slices. Infrastructure presence is not empirical validity: learned Moneta remains explicit, pinned, reversible and falsifiable until held-out human outcome evidence supports stronger claims.

Recent merged sequence:

- **#249 — learned-model promotion gate:** separates evidence eligibility from registry activation.
- **#250/#251 — frozen feature and judgement evidence:** captures exact Moneta candidate features and joins them transactionally to pairwise human judgements.
- **#252 — gated learned runtime re-ranker:** learned weights may only reorder candidates already admitted by bootstrap hard constraints.
- **#254 — exact runtime artifact pin:** reproducible learned execution must match the exact active registry artifact hash.
- **#253 — study/runtime fitness provenance:** frozen studies distinguish bootstrap from exact pinned-learned model version + artifact hash and fail on drift.
- **#255 — explicit learned-runtime composition opt-in:** live representation composition can use a pinned learned model, while bootstrap remains the default and owns candidate generation, hard constraints and canonical raw features.
- **#256 — group-balanced holdout evaluation:** independent dataset+researcher groups contribute equally to the promotion comparison.
- **#257 — distributed group-win evidence:** promotion requires candidate gains to be distributed across independent groups via an exact sign test.
- **#258 — CI fast lane:** superseded runs cancel, production artifacts are reused, and PR correctness tests are separated from scheduled/main coverage assurance.
- **#259 — robust holdout effect:** promotion now requires leave-one-group-out effect robustness.
- **#260/#262 — row identity foundations:** durable observation identity is being moved toward Rust ownership without contaminating scientific variables.
- **#261/#264 — statistical foundations and measurement semantics:** typed measurement, geometry, evidence and semantic provenance contracts now gate analytical claims.

**Active implementation: `feature/moneta-scalability-contract`.** Establish the large-dataset performance boundary: all work materially proportional to dataset size remains Rust/WASM-owned; evidence-backed Moneta operates over compact summaries with bounded candidate and sensitivity budgets independent of row count.

Baseline V3 governing merge: `13dd7459555d35ac718710a50f357e022c456731` (`docs: adopt V3 discovery-centric vision and modular implementation plan (#225)`).

### Governing V3 gates

| Gate | Status | Current evidence / next exit work |
|---|---|---|
| 0 — Authority reconciliation | **IN PROGRESS** | Legacy Draco is adapter-only and live Moneta authority has been consolidated. Complete import/call-site inventory, remove obsolete compatibility consumers, and prove research-relevant analytical facts originate in Rust/WASM or fail explicitly. |
| 1 — Dataset Evidence | **PARTIAL** | Typed evidence-backed Moneta boundaries exist. Continue authoritative Rust/WASM evidence coverage, compact-transfer guarantees and provenance/replay tests. |
| 2 — Representation Language | **PARTIAL** | Representation ontology, graph contracts and runtime adapters exist. Composition grammar and broader canonical graph coverage remain incomplete. |
| 3 — Moneta correctness | **IN PROGRESS** | Versioned bootstrap FitnessModel, scoring dimensions, hard constraints, abstention/status/margin, sensitivity analysis and bounded compute contracts are live. Metamorphic validation, staged candidate pruning, epistemic pattern-fragility signals, and downstream confidence-terminology cleanup remain. |
| 4 — NIL | **IN PROGRESS / PARTIAL** | Semantic interaction language and replay foundations exist; continue modality-independent provenance and parity work. |
| 5 — Discovery | **PARTIAL** | DiscoveryEpisode lifecycle/store infrastructure exists. Continue end-to-end hypothesis validation, falsification prompts, outcome evidence and headless replay integration. |
| 6 — Human refinement | **IN PROGRESS** | Pairwise judgement and exact feature-snapshot evidence are captured transactionally. Outcome-event coverage and stronger curation policy remain. |
| 7 — Learning infrastructure | **IN PROGRESS** | Registry, immutable artifacts, promotion gate, feature snapshots, judgement joins, rollback history, pinned runtime adapter, explicit opt-in, group-balanced evaluation, distributed group-win evidence and robust holdout effect evidence exist. Outcome-linked validation remains. |
| 8 — Learned Moneta | **EARLY OPT-IN, NOT EMPIRICALLY VALIDATED** | Learned ranking is available only as an exact pinned opt-in. Bootstrap remains default. No superiority claim is permitted without robust held-out comparison and discovery-outcome evidence. |
| 9 — Compositional Moneta | **DEFERRED** | Depends on mature RepresentationGraph/grammar, bounded search and validated Moneta correctness. Do not introduce learned composition search yet. |
| 10 — Adaptive Nemosyne | **DEFERRED** | Depends on validated learning, freeze controls, monitoring, rollback and study evidence. |

## Immediate work queue

### P0 — Large-dataset performance architecture

- [x] Define a bounded Moneta compute contract for candidate and sensitivity work.
- [x] Enforce the compute contract at the canonical evidence-backed Moneta boundary.
- [x] Add regression coverage showing Moneta candidate/sensitivity work remains constant from 10K through 10M source rows.
- [x] Prevent MASSIVE default requirements from treating source row count as the Quest visible-element budget.
- [x] Add architecture checks preventing canonical Moneta reasoning modules from importing `Dataset` or traversing raw rows.
- [ ] Instrument Rust/WASM boundary bytes, dataset materialisations and JS row-object reconstruction.
- [ ] Establish deterministic benchmark tiers for 10K, 100K, 1M and 10M rows covering ingest, evidence generation, transfer volume, Moneta latency, peak memory and visual reduction.
- [ ] Finish Rust-owned columnar storage for numeric/temporal data, then categorical encodings, without a mirrored authoritative JS row store.
- [ ] Make `DatasetEvidence` the canonical compact Rust→Moneta boundary and audit every research-relevant Moneta input for Rust origin.
- [ ] Add staged family/candidate pruning and explicit composition budgets before Gate 9 search.
- [ ] Add Rust-side aggregation/LOD and GPU-ready visual buffers so source cardinality is decoupled from rendered primitive count.

### P0 — Finish authority and correctness boundaries

- [ ] Complete inventory of `src/draco/` / `src/moneta/` imports, exports and runtime call sites.
- [ ] Classify remaining compatibility code as adapter, neutral representation contract, renderer helper or obsolete authority.
- [x] Mechanically restrict legacy `src/draco/` to Moneta compatibility re-exports and enforce with architecture tests.
- [ ] Delete obsolete compatibility files once the import inventory proves they have no live consumers.
- [ ] Verify all research-relevant analytical facts consumed by Moneta originate in Rust/WASM or fail explicitly.
- [ ] Verify representation/model/NIL/discovery provenance persists through Investigation rather than renderer/session-only state.
- [ ] Remove or rename remaining downstream `confidence` compatibility fields where they still describe uncalibrated utility.
- [ ] Add metamorphic tests: row-shuffle invariance; column-rename invariance absent semantic change; duplication changes scale/density according to declared policy.

### P0 — Complete safe learned-runtime adoption and evidence hardening

- [x] Immutable FitnessModel registry with append-only activation/rollback history.
- [x] Held-out promotion eligibility gate separated from activation.
- [x] Exact candidate feature snapshots and transactional judgement joins.
- [x] Post-bootstrap learned re-ranking that preserves hard disqualifications.
- [x] Exact learned artifact pinning and fail-closed registry drift detection.
- [x] Study/runtime provenance for exact model version + artifact hash.
- [x] Explicit live composition-root opt-in with bootstrap remaining the default (#255).
- [x] Group-balanced holdout comparison so independent partition groups contribute equally (#256).
- [x] Distributed candidate wins across independent groups with exact sign-test evidence (#257).
- [x] Require a deterministic leave-one-group-out improvement floor so promotion does not depend on one influential group (#259).
- [ ] Validate learned ranking against held-out human discovery outcomes before claiming improvement over bootstrap.
- [ ] Add operational monitoring/rollback evidence before any default-runtime discussion.

### P0 — Epistemic skepticism / apophenia-pressure planning

Treat apophenia as a property of an evidential situation, representation or inference, never as a psychological score assigned to an investigator.

- [ ] Define a versioned **pattern-fragility / apophenia-pressure evidence contract** with inspectable dimensions rather than an opaque percentage.
- [ ] Candidate dimensions: representation dependence, analytical degrees of freedom, multiple-comparison/selection opportunity, perturbation instability, subgroup sparsity, null-model plausibility, and independent corroboration.
- [ ] Connect each elevated dimension to an actionable falsification operation: alternate representation family, label/row shuffle where scientifically valid, influential-point removal, null-model comparison, held-out slice, blind reproduction, or independent investigator replication.
- [ ] Persist the evidence and falsification actions in Investigation/Discovery provenance so the signal is reproducible and auditable.
- [ ] Keep Moneta's role narrow: it may report how representation choice contributes to pattern fragility, but must not diagnose investigators, suppress findings, or convert heuristic pressure into calibrated probability without empirical validation.
- [ ] Evaluate whether the signal improves investigator calibration and discovery quality in held-out studies before allowing it to affect ranking or recommendations.

### P0.5 — Dependency and platform modernization sprint

Run after the current Moneta scalability/authority P0 slice and before Gate 9 compositional Moneta. The executable sprint backlog is `docs/DEPENDENCY_MODERNIZATION_BACKLOG.md` and is tracked by #300.

- [ ] Complete Wave 0 baseline/triage and preserve rollback evidence before breaking migrations.
- [ ] Finish low-risk npm maintenance, then modernize GitHub Actions/CI one subsystem at a time.
- [ ] Upgrade Rust scientific/data foundations with numerical, determinism, provenance, WASM and performance parity evidence.
- [ ] Audit hand-rolled statistics, graph, array, hashing/RNG, parsing, CI/build, and spatial/WebXR helpers; replace only where maintained libraries improve fitness without weakening Nemosyne-specific semantics or authority boundaries.
- [ ] Migrate ESLint/TypeScript majors deliberately, preserving public type/build contracts and test throughput.
- [ ] Treat the Three.js/WebXR upgrade as a dedicated rendering/runtime migration with headset, frame-time, memory, draw-call and interaction validation.
- [ ] Do not begin Gate 9 composition search until high-value major upgrades are either merged, explicitly deferred with rationale, or rejected and the replacement audit is complete.

### P1 — Parallel foundation modules

1. **Dataset Evidence:** expand typed Rust/WASM evidence coverage, provenance and replay parity.
2. **Representation Ontology:** mature primitive registry, `RepresentationGraph`, grammar and canonical serialization.
3. **Investigation/Discovery:** strengthen hypothesis lifecycle, falsification operations, validation, outcome evidence and headless replay.
4. **NIL:** complete semantic command provenance, modality adapters and replay parity.

Persistence and CI evolve continuously across all four.

### P2 — Integration wave

- Moneta consumes authoritative `DatasetEvidence` and Representation Ontology contracts.
- Existing single-family decisions are represented as simple `RepresentationGraph`s before composition search is introduced.
- Spatial Runtime remains the graph embodiment adapter and does not reinterpret Moneta semantics.
- Research Harness freezes exact Rust/Moneta/Fitness/Ontology/NIL/perception versions.
- 2D and VR treatments consume equivalent semantic representation contracts.
- Learned execution remains pinned and opt-in until held-out evidence plus monitoring/rollback justify a governance change.
- Pattern-fragility evidence remains advisory and explainable until controlled outcome evidence justifies any stronger role.

## Design boundaries

- **Rust owns N-dependent work.** Parsing, storage, filtering, statistics, clustering, topology, spectral analysis, evidence construction, large-data reduction and other work materially proportional to dataset size remain Rust/WASM responsibilities.
- **Moneta is a bounded control plane.** Canonical representation reasoning consumes compact Rust-derived evidence and investigator semantics; it must not require raw-row traversal or full-dataset JS materialisation.
- **Source rows are not visible elements.** Headset render budgets constrain reduced/LOD primitives, not the number of observations stored in the analytical dataset.
- **Bootstrap is the safe default.** An explicit learned-runtime request must never silently switch artifact or silently fall back to bootstrap.
- **Hard constraints precede learned ranking.** Learned models may reorder feasible candidates; they may not resurrect a bootstrap-disqualified candidate.
- **Registry activation is not provenance.** Reproducible execution pins an immutable artifact hash and model version in decision/study state.
- **Promotion eligibility is not empirical truth.** Passing the gate means the artifact satisfies the declared evidence policy, not that Moneta is universally better.
- **Holdout groups, not judgement volume, define the comparison unit.** Repeated judgements within one dataset+researcher group must not outweigh another independent group in the headline promotion metric.
- **Mean improvement, win consistency and effect robustness are distinct.** Promotion requires worthwhile average improvement, distributed wins and resistance to a single influential group.
- **Skepticism targets claims, not people.** Pattern-fragility/apophenia-pressure signals describe evidence and analytical conditions, never investigator psychology.
- **Explain before scoring.** Any skepticism signal must expose contributing evidence and concrete falsification actions; a single unexplained number is insufficient.
- **Learning does not own analytical facts.** Research-relevant facts remain Rust/WASM-authoritative; learned ranking consumes frozen Moneta feature evidence.
- **No compositional/adaptive leapfrogging.** Gate 9/10 sophistication does not substitute for Gate 1–8 falsifiability and validation.

## Documentation cleanup policy

Every PR touching an architectural area must update active documentation. Superseded active prose is rewritten to V3 terminology or moved to `docs/archive/` when it has historical value. The repository must not maintain competing live descriptions of representation authority, research goals or implementation gates.

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

Focused correctness/parity tests are mandatory for claimed functionality. A skipped test is not evidence for a claimed gate. Coverage assurance runs separately on `main`/schedule so PR feedback remains fast without abandoning centralized coverage thresholds.

## Pickup instruction

Complete the Moneta scalability contract and benchmark rails first. Then instrument Rust/WASM transfer/materialisation costs and continue the Rust-owned columnar Dataset migration. In parallel, continue authoritative DatasetEvidence coverage and held-out discovery-outcome validation; do not let pattern-fragility signals influence ranking until controlled evidence shows investigator benefit. After the current P0 scalability/authority slice is stable, execute the dependency/platform modernization sprint before Gate 9 compositional Moneta.
