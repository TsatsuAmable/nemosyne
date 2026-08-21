# Nemosyne V3 Implementation Plan

**Status:** Active migration plan  
**Governing specification:** `docs/Nemosyne_Definitive_Vision_and_Roadmap.md`  
**Baseline:** `main` at/after `890071b6568cfb8038806c860648dc229bfc1b88`

## Purpose

This document translates V3 into small, independently verifiable engineering workstreams. It is intentionally correctness-first. Existing features are retained only when they satisfy a V3 responsibility or can be adapted without preserving competing authority.

## Migration rules

1. One canonical owner exists for every kind of truth.
2. New modules expose public contracts and barrel exports; callers do not import internals across module boundaries.
3. Compatibility adapters contain no independent scoring, analytical inference or durable semantic state.
4. Every migration step adds tests proving the new authority path before deleting the old path.
5. Obsolete code is deleted once no live imports, runtime registration, package exports or tests require it.
6. Obsolete documentation is updated when salvageable; otherwise it moves to `docs/archive/` only when historical value justifies retention. Stale active documentation is not kept “just in case”.
7. Research-facing terminology must distinguish heuristic utility from calibrated confidence.
8. No adaptive/learned behaviour enters the stable research path before its provenance, freeze and evaluation contracts exist.

## Module target map

| V3 module | Initial repository target | First responsibility |
|---|---|---|
| Dataset Evidence | `wasm/src/evidence/`, `src/evidence/` contracts/adapters | Typed provenance-bearing analytical facts |
| Representation Ontology | `src/representation/` | Primitive registry + RepresentationGraph contracts |
| Moneta | `src/moneta/` | Sole representation reasoning authority |
| Human Judgement | `src/judgement/` | Structured preference/adjustment/outcome events |
| Fitness Learning | `src/fitness/` | Versioned models, evaluation and registry contracts |
| NIL | `src/nil/` | Modality-independent semantic commands |
| Perception / Gesture | existing `src/perception/`, gesture module | Observation → NIL intent only |
| Investigation / Discovery | `src/investigation/` | DiscoveryEpisode and reasoning/evidence history |
| Atlas | `src/atlas/` | Orchestration only |
| Spatial Runtime | existing VR/runtime code, progressively bounded | RepresentationGraph embodiment |
| Research Harness | existing study code, progressively modularized | Freeze/vary treatment contracts |
| Persistence | `src/session/` initially, later bounded package module | Complete V3 provenance serialization |
| Analyst Cockpit | existing UI | Explain/challenge/refine representation |
| Collaboration | existing network/collab | Semantic transport, no domain authority |
| CI / Testing | `tests/`, `scripts/`, workflows | Architecture + methodological invariants |

Directory names may be refined during implementation, but ownership boundaries are not optional.

## Dependency waves and parallel work

### Wave 0: Authority reconciliation — BLOCKING

**W0-A Moneta/Draco authority**
- enumerate every import/export/runtime call under `src/draco/` and `src/moneta/`;
- classify each Draco file as adapter, renderer/embodiment helper, obsolete solver, or still-needed contract;
- move reusable neutral contracts to `src/representation/`;
- make `src/moneta/` the only representation scoring/ranking authority;
- delete old scoring/arbiter logic after adapter tests prove compatibility;
- add architecture test: no representation scoring implementation outside `src/moneta/`.

**W0-B Analytical authority**
- inventory TypeScript-derived facts consumed by Moneta;
- classify each as presentation-only, compatibility-only or research-relevant;
- research-relevant facts must originate in Rust/WASM or fail explicitly;
- add architecture/parity tests for the authority path.

**W0-C Investigation authority**
- verify representation decisions, overrides, model versions and future NIL/Discovery events are append-only Investigation semantics rather than renderer state;
- add mutation-boundary tests.

Exit: exactly one live authority path for analytical truth, representation reasoning and investigation meaning.

### Wave 1: parallel foundations

These can run concurrently after Wave 0 contracts are fixed.

**W1-A Dataset Evidence**
- define versioned `DatasetEvidence` schema in Rust;
- attach method, parameters, seed, normalisation, missing-data policy, kernel version, uncertainty/limitations and deterministic provenance to derived facts;
- expose a typed WASM boundary;
- add deterministic fixture and replay tests.

**W1-B Representation Language**
- define `RepresentationPrimitive`, semantic mapping, policies and `RepresentationGraph`;
- create a versioned primitive registry;
- define a minimal composition grammar;
- add schema validation and canonical serialization tests;
- do not migrate all renderers yet.

**W1-C Discovery domain**
- define `DiscoveryEpisode`, hypothesis lifecycle and validation states in `src/investigation/`;
- connect existing observations/findings/evidence without duplicating ledgers;
- add headless replay tests.

**W1-D NIL contracts**
- define semantic command envelope, command IDs, provenance, validation and versioning;
- provide initial adapters for existing mouse/controller/gesture actions without changing user-facing behaviour;
- add modality-equivalence and replay tests.

### Wave 2: Moneta correctness and runtime adapters

**W2-A Explicit FitnessModel**
- move weights/dimensions into a versioned model object;
- enforce finite non-negative active weights and `sum(activeWeights) == 1`;
- implement every public requirement or remove it from the public ontology until implemented;
- rename heuristic `confidence*` to `utility*`/`fitness*` throughout active APIs, persistence and UI copy;
- distinguish configured/heuristic priors from empirical priors.

**W2-B Abstention and uncertainty**
- add `DECISIVE | AMBIGUOUS | INFEASIBLE | UNDERDETERMINED`;
- expose top candidates, runner-up, margin and rejection reasons;
- add deterministic sensitivity analysis under bounded weight perturbation;
- ensure explanation never represents utility as probability.

**W2-C Spatial Runtime adapter**
- introduce RepresentationGraph → embodiment adapter;
- initially map existing single-family Moneta results into one-node/simple graphs;
- migrate renderer consumers incrementally;
- keep Three.js/WebXR types out of Moneta and Representation Ontology contracts.

**W2-D Research Harness freeze controls**
- freeze exact Moneta/FitnessModel/Ontology/NIL versions;
- make adaptive behaviour opt-in and protocol-visible;
- ensure 2D/VR treatments can consume the same semantic RepresentationGraph.

### Wave 3: Human refinement

- introduce `RepresentationJudgement` events;
- pairwise preference capture;
- absolute rating where useful;
- weight adjustment events;
- alternative/rejection events;
- discovery-outcome linkage;
- provenance and export schema;
- Analyst Cockpit controls for explanation, alternatives and adjustments.

No learning yet. This wave creates trustworthy evidence.

### Wave 4: Learning infrastructure

- curated judgement dataset builder;
- quality checks and exclusion reasons;
- dataset/researcher grouping metadata;
- explicit train/validation/holdout partitions;
- baseline pairwise/ranking model;
- model artifact hashing and registry;
- offline evaluation against bootstrap heuristics;
- rollback.

### Wave 5: Compositional Moneta

- search over RepresentationGraph compositions;
- feasibility pruning;
- multiscale policies;
- hybrid representations;
- complexity budgets;
- explanation of composition choices;
- renderer support expanded primitive-by-primitive.

### Wave 6: Validated adaptation

Only after empirical evidence demonstrates benefit:
- contextual fitness model;
- controlled exploration/exploitation;
- explicit adaptive mode;
- drift/quality monitoring;
- rollback;
- historical investigations remain pinned to exact model versions.

## Moneta adversarial correctness checklist

Before Gate 3 is considered complete:

- [ ] every active weight contributes to the score;
- [ ] active weights normalise to exactly 1 within defined numerical tolerance;
- [ ] maximum achievable utility is 1.0 for a fully satisfied synthetic candidate;
- [ ] distribution requirement has defined constraint/score/evidence/tests;
- [ ] density requirement has defined constraint/score/evidence/tests;
- [ ] periodicity requirement has defined constraint/score/evidence/tests;
- [ ] manifold requirement has defined constraint/score/evidence/tests;
- [ ] connectivity requirement has defined constraint/score/evidence/tests;
- [ ] group-comparison requirement has defined constraint/score/evidence/tests;
- [ ] `confidence` is absent from uncalibrated representation utility APIs;
- [ ] heuristic scalability/metadata are named as heuristic/configured values;
- [ ] hard feasibility is separated from semantic preference;
- [ ] close candidates can return `AMBIGUOUS`;
- [ ] no feasible candidate returns `INFEASIBLE`, never a fallback winner;
- [ ] weak evidence can return `UNDERDETERMINED`;
- [ ] sensitivity result is deterministic and persisted;
- [ ] row shuffling leaves representation decision unchanged;
- [ ] column renaming leaves decision unchanged unless semantic metadata changes;
- [ ] duplicated observations affect scale/density according to declared policy;
- [ ] analytical provenance changes when algorithm/version/parameters change;
- [ ] legacy Draco cannot independently select a representation.

## CI gates for every module PR

Minimum checks:

```text
tsc --noEmit
eslint
npm test
cargo test
npm run wasm:dev
npm run build
npm run audit:hygiene
```

Add focused module tests and architecture-boundary tests. Zero skipped correctness/parity tests are allowed for code paths claimed by the PR.

## Documentation discipline

Every implementation PR must update:
- `docs/ROADMAP.md` current status;
- the relevant technical reference when contracts change;
- this implementation plan when sequencing/dependencies change;
- migration notes when a public contract changes.

Completed historical sprint prose should be moved to the archive when it obscures current status. Active docs must describe the current architecture, not preserve superseded terminology for narrative continuity.

## Definition of done for the V3 migration

V3 migration is not complete because directories exist. It is complete when the full reproducible loop works through public contracts:

```text
Dataset
→ DatasetEvidence
→ RepresentationGraph hypothesis
→ 2D/VR embodiment
→ NIL interaction
→ DiscoveryEpisode
→ analytical verification
→ evidence / judgement
→ reproducible package
```

and every adaptive/learned component is versioned, freezeable, explainable and evaluable against held-out evidence.