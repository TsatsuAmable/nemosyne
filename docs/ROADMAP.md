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

**Active implementation: `feature/holdout-effect-robustness`.** Add a deterministic leave-one-group-out improvement floor so a learned artifact cannot pass promotion merely because one influential holdout group lifts the point estimate above threshold.

Baseline V3 governing merge: `13dd7459555d35ac718710a50f357e022c456731` (`docs: adopt V3 discovery-centric vision and modular implementation plan (#225)`).

### Governing V3 gates

| Gate | Status | Current evidence / next exit work |
|---|---|---|
| 0 — Authority reconciliation | **IN PROGRESS** | Legacy Draco is adapter-only and live Moneta authority has been consolidated. Complete import/call-site inventory, remove obsolete compatibility consumers, and prove research-relevant analytical facts originate in Rust/WASM or fail explicitly. |
| 1 — Dataset Evidence | **PARTIAL** | Typed evidence-backed Moneta boundaries exist. Continue authoritative Rust/WASM evidence coverage and provenance/replay tests. |
| 2 — Representation Language | **PARTIAL** | Representation ontology, graph contracts and runtime adapters exist. Composition grammar and broader canonical graph coverage remain incomplete. |
| 3 — Moneta correctness | **IN PROGRESS** | Versioned bootstrap FitnessModel, scoring dimensions, hard constraints, abstention/status/margin and sensitivity analysis are live. Metamorphic validation, epistemic pattern-fragility signals, and downstream confidence-terminology cleanup remain. |
| 4 — NIL | **IN PROGRESS / PARTIAL** | Semantic interaction language and replay foundations exist; continue modality-independent provenance and parity work. |
| 5 — Discovery | **PARTIAL** | DiscoveryEpisode lifecycle/store infrastructure exists. Continue end-to-end hypothesis validation, falsification prompts, outcome evidence and headless replay integration. |
| 6 — Human refinement | **IN PROGRESS** | Pairwise judgement and exact feature-snapshot evidence are captured transactionally. Outcome-event coverage and stronger curation policy remain. |
| 7 — Learning infrastructure | **IN PROGRESS** | Registry, immutable artifacts, promotion gate, feature snapshots, judgement joins, rollback history, pinned runtime adapter, explicit opt-in, group-balanced evaluation and distributed group-win evidence exist. Effect robustness and outcome-linked validation remain. |
| 8 — Learned Moneta | **EARLY OPT-IN, NOT EMPIRICALLY VALIDATED** | Learned ranking is available only as an exact pinned opt-in. Bootstrap remains default. No superiority claim is permitted without robust held-out comparison and discovery-outcome evidence. |
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
- [ ] Require a deterministic leave-one-group-out improvement floor so promotion does not depend on one influential group.
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

Finish deterministic holdout effect robustness correctness-first. Then connect learned-model evaluation to held-out discovery outcomes. In parallel, specify the pattern-fragility/apophenia-pressure evidence contract and falsification operations, but do not let that advisory signal influence Moneta ranking until controlled evidence shows that it improves investigator calibration or discovery quality.
