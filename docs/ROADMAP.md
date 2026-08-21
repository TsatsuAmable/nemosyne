# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product/research direction and architecture are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. The executable migration sequence is `docs/IMPLEMENTATION_PLAN_V3.md`. Older Gate/Sprint numbering is historical and does not imply V3 completion.

## Current Status — 22 August 2026

### V3 implementation underway

Nemosyne has moved beyond the original Gate 0 Moneta authority repair into the first evidence-governed learning/runtime slices. The important constraint remains unchanged: infrastructure presence is not evidence of empirical validity. Learned Moneta must remain explicit, pinned, reversible and falsifiable until held-out human outcome evidence justifies stronger claims.

Recent merged sequence:

- **#249 — learned-model promotion gate:** requires supported model kind, expected held-out metric, minimum judgement/group counts and a configured improvement over bootstrap before a model is promotion-eligible.
- **#250/#251 — frozen feature and judgement evidence:** capture exact Moneta candidate feature snapshots and atomically join them to pairwise human judgements without training or activation side effects.
- **#252 — gated learned runtime re-ranker:** reuses bootstrap raw candidate features and can only re-rank candidates already admitted by Moneta hard constraints.
- **#254 — exact runtime artifact pin:** reproducible learned execution must match the exact registry-active artifact hash; registry drift fails closed.
- **#253 — study/runtime fitness provenance:** `RuntimeFitnessMode` and `StudyRuntimeVersions` distinguish bootstrap from exact pinned-learned model version + artifact hash; `StudyFreezeGuard` treats artifact drift as runtime drift.

**Active implementation PR: #255 — `feature/learned-fitness-runtime-opt-in`.** This slice wires pinned learned ranking into the live representation composition boundary as an explicit opt-in while preserving bootstrap as the default and authoritative source of candidate generation, hard constraints and canonical raw features.

Baseline V3 governing merge: `13dd7459555d35ac718710a50f357e022c456731` (`docs: adopt V3 discovery-centric vision and modular implementation plan (#225)`).

### Governing V3 gates

| Gate | Status | Current evidence / next exit work |
|---|---|---|
| 0 — Authority reconciliation | **IN PROGRESS** | Legacy Draco is adapter-only and live Moneta authority has been consolidated. Remaining work: complete import/call-site inventory, remove obsolete compatibility consumers, and prove research-relevant analytical facts originate in Rust/WASM or fail explicitly. |
| 1 — Dataset Evidence | **PARTIAL** | Typed `DatasetEvidence` and evidence-backed Moneta boundaries exist. Continue expanding authoritative evidence coverage and provenance/replay tests, especially unsupported topology/structure cases. |
| 2 — Representation Language | **PARTIAL** | Representation ontology, graph contracts and runtime adapters exist. Composition grammar and broader canonical graph coverage remain incomplete. |
| 3 — Moneta correctness | **IN PROGRESS** | Versioned bootstrap FitnessModel, complete declared scoring dimensions, hard constraints, abstention/status/margin and sensitivity analysis are live. Remaining work includes metamorphic validation and downstream confidence-terminology cleanup. |
| 4 — NIL | **IN PROGRESS / PARTIAL** | Semantic interaction language and replay foundations exist; continue modality-independent provenance and parity work. |
| 5 — Discovery | **PARTIAL** | DiscoveryEpisode lifecycle/store infrastructure exists. Continue end-to-end hypothesis validation and headless replay integration. |
| 6 — Human refinement | **IN PROGRESS** | Pairwise judgement and exact feature-snapshot evidence are now captured transactionally. Outcome-event coverage and stronger curation policy remain. |
| 7 — Learning infrastructure | **IN PROGRESS** | Registry, immutable artifacts, promotion gate, feature snapshots, judgement joins, rollback history and pinned runtime adapter exist. Holdout discipline and operational curation/monitoring still require evidence and review. |
| 8 — Learned Moneta | **EARLY OPT-IN, NOT EMPIRICALLY VALIDATED** | #252/#254 provide a gated pinned re-ranker; #255 wires explicit composition-root adoption. Bootstrap remains default. No empirical superiority claim is permitted without held-out comparison against bootstrap. |
| 9 — Compositional Moneta | **DEFERRED** | Depends on mature RepresentationGraph/grammar and validated Moneta correctness. Do not introduce learned composition search yet. |
| 10 — Adaptive Nemosyne | **DEFERRED** | Depends on validated learning, freeze controls, monitoring, rollback and study evidence. |

## Immediate work queue

### P0 — Finish authority and correctness boundaries

- [ ] Complete inventory of `src/draco/` / `src/moneta/` imports, exports and runtime call sites.
- [ ] Classify remaining compatibility code as adapter, neutral representation contract, renderer helper or obsolete authority.
- [x] Mechanically restrict legacy `src/draco/` to Moneta compatibility re-exports and enforce with architecture tests.
- [ ] Delete obsolete compatibility files once the import inventory proves they have no live consumers.
- [ ] Verify all research-relevant analytical facts consumed by Moneta originate in Rust/WASM or fail explicitly.
- [ ] Verify representation/model/NIL/discovery provenance persists through Investigation rather than renderer/session-only state.
- [ ] Remove or rename remaining downstream `confidence` compatibility fields where they still describe uncalibrated utility.
- [ ] Add metamorphic tests: row-shuffle invariance; column-rename invariance absent semantic change; duplication changes scale/density according to declared policy.

### P0 — Complete safe learned-runtime adoption

- [x] Immutable FitnessModel registry with explicit activation/rollback history.
- [x] Held-out promotion eligibility gate separated from activation.
- [x] Exact candidate feature snapshots and transactional judgement joins.
- [x] Post-bootstrap learned re-ranking that preserves hard disqualifications.
- [x] Exact learned artifact pinning and fail-closed registry drift detection.
- [x] Study/runtime provenance for exact model version + artifact hash.
- [ ] Merge #255 after full CI: explicit representation composition-root opt-in, exact decision artifact provenance and no silent fallback.
- [ ] Add operational monitoring/rollback evidence before any default-runtime discussion.
- [ ] Validate learned ranking against held-out human discovery outcomes before claiming improvement over bootstrap.

### P1 — Parallel foundation modules

1. **Dataset Evidence:** expand typed Rust/WASM evidence coverage, provenance and replay parity.
2. **Representation Ontology:** mature primitive registry, `RepresentationGraph`, grammar and canonical serialization.
3. **Investigation/Discovery:** strengthen hypothesis lifecycle, validation, outcome evidence and headless replay.
4. **NIL:** complete semantic command provenance, modality adapters and replay parity.

Persistence and CI evolve continuously across all four.

### P2 — Integration wave

- Moneta consumes authoritative `DatasetEvidence` and Representation Ontology contracts.
- Existing single-family decisions are represented as simple `RepresentationGraph`s before composition search is introduced.
- Spatial Runtime remains the graph embodiment adapter and does not reinterpret Moneta semantics.
- Research Harness freezes exact Rust/Moneta/Fitness/Ontology/NIL/perception versions.
- 2D and VR treatments consume equivalent semantic representation contracts.
- Learned execution remains pinned and opt-in until held-out evidence plus monitoring/rollback justify a governance change.

## Design boundaries

- **Bootstrap is the safe default.** An explicit learned-runtime request must never silently degrade to another learned artifact or silently fall back to bootstrap.
- **Hard constraints precede learned ranking.** Learned models may reorder feasible candidates; they may not resurrect a bootstrap-disqualified candidate.
- **Registry activation is not provenance.** Reproducible execution pins an immutable artifact hash and model version in the decision/study runtime state.
- **Promotion eligibility is not empirical truth.** Passing the promotion gate means the artifact satisfies the declared evidence policy, not that Moneta is universally better.
- **Learning does not own analytical facts.** Raw research-relevant facts remain Rust/WASM-authoritative; learned ranking consumes frozen Moneta feature evidence.
- **No compositional/adaptive leapfrogging.** Gate 9/10 sophistication does not substitute for Gate 1–8 falsifiability and validation.

## Documentation cleanup policy

Every PR touching an architectural area must update active documentation. Superseded active prose is rewritten to V3 terminology or moved to `docs/archive/` when it has historical value. Obsolete docs without enduring value should be deleted. The repository must not maintain two live descriptions of representation authority, research goals or implementation gates.

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

## Pickup instruction

Finish #255 correctness-first. If it is CI-clean, merge the explicit pinned learned-runtime opt-in without changing bootstrap default behavior. The next work should strengthen end-to-end provenance, held-out validation, monitoring/rollback and remaining Gate 0/3 correctness gaps rather than adding more sophisticated learning or compositional search.
