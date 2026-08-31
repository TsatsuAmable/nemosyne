# Nemosyne Roadmap & Implementation Status

> **Canonical implementation-status and execution authority.** Product and research direction remain governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This file is the current operational map: what is active, which programme owns it, which integration seams are exclusive, what evidence closes a checkpoint, and what must wait. Detailed programme documents remain the scientific, UX, security, or evidence specification for their own scope; their older status headers do not override this live roadmap.

## Status snapshot - 31 August 2026

**Current integration base for this planning update:** `main@1ea2920` (#606 merged). Stream A is fully closed; Stream B B1 is promoted and B2 is the active forward checkpoint.

The previous A/B/C convergence wave, Stream M distribution wave, Density Truth R2C, source-partition Cluster Regions R2D, and the current Progressive Disclosure Stream A have reached their finite implementation exits. In particular:

- A1 semantic drill-down contract/falsifiers is `VERIFIED COMPLETE` after establishing SemanticDrillDown.ts and drill_down.rs WASM validation boundary.
- A2 resident bounded semantic membership/query capability is `VERIFIED COMPLETE` through the canonical Worker/Rust authority.
- A3 semantic selection lineage, bounded observation reveal, and explicit return-to-structure are `VERIFIED COMPLETE` for the generic production path.
- A4 exact datum/provenance inspection is `VERIFIED COMPLETE` after #605, using a second bounded authority query rather than a whole-dataset UI cache.
- A5 cross-family product evidence and the independent STOP review establish the finite P1-R5 closure for Aggregate, Distribution, Density and source-partition Cluster, with #606 merged and all exact-head gates green.
- Stream B B1 source relationship-graph authority contract is `VERIFIED COMPLETE` after #598, independent adversarial review closure (`review/P1_R2E_B1_POST_REVIEW_2026-08-31.md`) and promotion at `main@1ea2920`. `RELATIONSHIP_GRAPH` remains disqualified in production until B2/B3 land; four DEFER findings are recorded as B2/B3 obligations in `roadmap/P1_R2E_RELATIONSHIP_GRAPH.md`.
- Aggregate Volume is a verified Rust-owned bounded semantic embodiment.
- Distribution Field is a verified bounded empirical-distribution embodiment rather than a density alias.
- Density Field is a verified Rust-owned governed density embodiment.
- Cluster Regions source-partition V1 is `VERIFIED COMPLETE` after C1-C5, including the #595 evidence-trigger fix-forward and fresh-main STOP review.
- Fresh dataset loads are overview-first rather than silently biasing Moneta toward individual observation identity.
- Aggregate, distribution, density and governed cluster structures are first-class semantic interaction targets rather than being registered as raw observations.
- Explicit individual-inspection intent can still select `POINT_SET`; progressive disclosure removes point universality, not legitimate observation-level representation.
- P1-UV baseline evidence, task-first shell/contextual-locus substrate, unified UI primitives and visual-system convergence foundations are landed, but the full visible product treatment is not yet complete.

## Sequential execution model

The roadmap retains the A/B/C/D programme names because they encode bounded ownership and finite exits, but **they are no longer parallel execution streams**. From 31 August 2026 onward, implementation proceeds as one forward stream with adversarial review/fix-forward integrated into each tranche.

Current order:

```text
Stream A STOP
  -> Stream B first selected structural family
    -> Stream C visible investigator product convergence
      -> Stream D assurance / physical qualification / preview readiness
        -> P1-W production wiring
          -> minimal private preview
```

Only one forward implementation PR should be active at a time unless the user explicitly changes this execution policy. Before each tranche, fetch fresh `main`; after implementation, perform the bounded adversarial review, run the relevant exact-head evidence, fix forward, merge, then fetch fresh `main` again.

| Programme | Mission | Current checkpoint | Sequential position | Finite exit |
| --- | --- | --- | --- | --- |
| **A - Progressive Disclosure & Semantic Drill-down** | Make dataset-level structure the normal starting point while preserving exact observations as bounded drill-down. | A5 STOP / #606 | **VERIFIED COMPLETE / STOP** | Structure -> region/group -> bounded observations -> datum/provenance works through the production path without rematerialising the whole dataset. |
| **B - Source-Authoritative Structural Representations** | Add truthful graph/hierarchy/temporal/geospatial/spectral dataset structures without presentation-side inference. | B2 resident Rust/WASM graph payload | **ACTIVE** | First selected structural family is verified complete; then STOP and explicitly select the next family. |
| **C - Visible Investigator Product Convergence** | Turn the landed substrate and semantic representations into the sparse, task-first Nemosyne experience. | C1 functional epistemic world objects | **QUEUED AFTER B** | Canonical journeys visibly converge on desktop and simulator-testable XR; remaining physical questions are handed to P1-U9. |
| **D - Assurance & Private-Preview Readiness** | Build attributable Quest validation operations, close live-path security/privacy residuals and prepare clean production/private-preview qualification. | D1 validation manifest + launcher | **QUEUED AFTER C** | Validation/security prerequisites are ready; final physical qualification and P1-W execute only when C and other named prerequisites are satisfied. |

A is the shared semantic integration spine and is now frozen at its finite P1-R5 boundary. B must consume A's generic drill-down/selection contract rather than inventing a second one. C consumes A/B semantic state and may not manufacture analytical facts. D validates and hardens the converged product but may not promote physical or preview claims before the owning product prerequisites are satisfied.

---

# Stream A - Progressive Disclosure & Semantic Drill-down

**Status:** VERIFIED COMPLETE / STOP — #606 merged, all exact-head gates green  
**Primary programme:** P1-R5 in `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`  
**Closure review:** `review/P1_R5_A5_STOP_REVIEW_2026-08-31.md`  
**Mission:** make observations an explicit detail capability rather than the universal geometry substrate.

Canonical detail hierarchy:

```text
investigation
  -> dataset representation
    -> semantic structure / region / group
      -> bounded observation subset
        -> exact datum / provenance
```

## A1 - semantic drill-down contract and falsifiers

**Status:** VERIFIED COMPLETE  

Freeze the generic contract before implementation fans out.

Required decisions/evidence:

- define a representation-independent semantic target identity for a selected region/group/structure;
- define the bounded request for member observation identities or compact observation views;
- state maximum returned observation IDs/records and explicit pagination/refusal behavior;
- preserve dataset fingerprint, semantic object ID, representation decision identity and investigation context;
- distinguish navigation/detail state from scientific mutation;
- make Moneta observation-level requirements explicitly decide when `POINT_SET` is primary versus deferred;
- define stale-generation, deleted-target, changed-dataset and unsupported-membership failure semantics;
- falsify any implementation that scans/rematerialises the full dataset in UI/renderer code.

**Exit:** one cross-representation contract exists and can be consumed by Aggregate, Distribution, Density, Cluster and later B-family structures without family-specific UI APIs.

## A2 - resident membership/query capability

**Status:** VERIFIED COMPLETE  

- implement the bounded membership/detail query at the canonical Rust/Worker dataset authority;
- return only the requested bounded identity/compact view;
- keep full source rows resident;
- apply resource bounds before output growth;
- prove stale/foreign handles and mismatched semantic targets fail closed;
- preserve exact observation identity where the underlying representation contract can support membership.

**Exit:** the production analytical runtime can answer a bounded semantic-target detail request without whole-dataset JS materialisation.

## A3 - representation transition and selection lineage

**Status:** VERIFIED COMPLETE  

- reveal observation-level marks only for the selected/focused bounded subset or an explicit observation-level task;
- preserve the selected semantic structure while entering detail;
- keep semantic IDs separate from transient mesh/instance indexes;
- make reverse navigation explicit: observation -> containing semantic structure -> dataset overview;
- integrate P1-F focus/context and existing representation-surface interaction semantics.

**Exit:** the user can move between structure and observations without losing context or replacing the whole dataset with points.

## A4 - exact datum/provenance inspection

**Status:** VERIFIED COMPLETE  

- connect selected observations to exact datum/provenance retrieval;
- make missing/unavailable provenance explicit;
- preserve replay/investigation identity;
- ensure UI panels consume bounded exact-detail requests rather than cached whole datasets.

## A5 - product evidence and independent STOP

**Status:** VERIFIED COMPLETE / STOP — #606 merged, all exact-head gates green  

Canonical product evidence includes Aggregate/Distribution/Density/Cluster paths and proves:

- overview begins at dataset structure;
- selecting a structure can reveal a bounded observation subset through the shared generic drill-down path;
- source N does not determine the amount of row data transferred for an unopened structure;
- returning to overview restores the semantic representation and selection context;
- explicit observation-level intent can still choose `POINT_SET` legitimately;
- refusal/pending/stale membership cannot silently fall back to all-points rendering.

The exact A5 production-browser run uses one pinned bundle for all four verified families. The closure review deliberately distinguishes family overview evidence from the generic A3/A4 drill-down tests rather than claiming a separate end-to-end gesture run for every family.

**Finite exit:** P1-R5 is `VERIFIED COMPLETE` only for the verified families and bounded query semantics. Do not automatically expand into arbitrary cross-filtering or new scientific analyses.

### Stream A closure boundary

The generic drill-down/selection integration contract around these surfaces is now a **frozen shared contract**, not an active implementation stream:

- `src/app/dataset/LoadDatasetUseCase.ts` where generic investigation requirements/detail state enter;
- generic semantic target/detail request types;
- Worker/runtime detail-query dispatch;
- `MonetaTopologyNode` generic semantic selection lifecycle;
- generic `RepresentationSurface` selection/detail transitions.

B must not create a competing graph-specific member-query API. C may present `Reveal observations` or equivalent controls only by dispatching A's governed intent. D may test or harden these paths but does not own their analytical meaning.

---

# Stream B - Source-Authoritative Structural Representations

**Status:** ACTIVE — SEQUENTIAL FORWARD PROGRAMME; B1 COMPLETE, B2 IN FLIGHT  
**Primary programme:** P1-R2E in `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`  
**First selected family:** source-provided `RELATIONSHIP_GRAPH`.

## Governing rule

B represents **source-authoritative structure first**. It does not infer structure from visual proximity, color, density, correlation, k-nearest-neighbour search or a force layout unless a later separately governed analytical treatment explicitly authorizes that method.

The first slice is Relationship Graph because source-provided edges create the cleanest authority boundary and exercise a genuinely non-point dataset structure.

## B1 - Relationship Graph scientific/authority contract

**Status:** VERIFIED COMPLETE — #598 landed, independent adversarial review closed (`review/P1_R2E_B1_POST_REVIEW_2026-08-31.md`), promoted at `main@1ea2920`.

- define accepted source edge authority and provenance;
- define node identity, edge identity, directionality, multiplicity/self-loop policy, missing endpoint behavior and edge attributes included in V1;
- define hard node/edge/payload bounds and refusal semantics;
- distinguish source graph topology from presentation layout coordinates;
- narrow Moneta candidate claims to exactly what the payload preserves;
- require a new fitness/treatment identity if admissibility/information semantics change ranking;
- add falsifiers proving no k-NN/correlation/layout-derived edge fallback exists.

**Exit:** contract is deterministic, bounded, scientifically reviewable and adds no production graph capability yet.

## B2 - resident Rust/WASM graph payload

- consume source-authoritative nodes/edges from the canonical resident dataset/graph capability;
- emit bounded stable semantic node/edge IDs and authoritative adjacency;
- keep topology independent of Three.js layout;
- preserve missing/dropped/refused counts explicitly;
- prove deterministic ordering, source identity and resource limits across real WASM.

## B3 - production cutover and thin graph adapter

- carry the governed graph payload through Worker/WASM using existing generation/fingerprint/decision fences;
- intercept the governed graph representation before row-derived or proximity-derived layout logic can create topology;
- keep presentation layout purely presentational and visibly distinguish it from edge authority;
- bind selection to stable semantic node/edge IDs;
- fail closed on pending/refused/stale/invalid payloads.

A's generic selection/drill-down contract is now frozen and must be consumed here. B3 may extend only the family-specific authority/payload/adaptation needed to satisfy that shared contract; it may not fork the generic semantic-detail API.

## B4 - product/scale/perceptual evidence and STOP

- prove source graph edges survive the full product path unchanged;
- prove arbitrary layout changes do not change topology;
- measure bounded payload/render behavior;
- prove no invented edges appear when source authority is absent;
- conduct independent review.

**Finite exit:** source-authoritative Relationship Graph V1 reaches `VERIFIED COMPLETE` for its evidence scope, then B STOPS. Selecting hierarchy, temporal, geospatial or spectral as the next structural slice requires an explicit fresh-main choice.

### Later B candidates, ordered preference

1. Hierarchy with explicit parent/child authority.
2. Temporal trajectory with explicit entity/time-order authority.
3. Geospatial structure with explicit coordinate/reference-system authority.
4. Spectral/frequency structure only after its exact mathematical object is governed.
5. `MANIFOLD_EMBEDDING` and `MULTISCALE_FIELD` remain implement-or-defer candidates; point-like surrogates under stronger labels are forbidden.

### Stream B collision rule

B owns representation-specific Rust modules, discriminated payloads, family-specific WASM proof and thin adapters. Shared generic files are integration windows, not permanent B ownership. Because execution is sequential, shared-contract changes must still be kept narrow and must preserve Stream A's verified invariants.

---

# Stream C - Visible Investigator Product Convergence

**Status:** QUEUED AFTER B / IMPLEMENTATION PARTIAL FOUNDATION LANDED  
**Primary programme:** `roadmap/P1_UV_VISIBLE_PRODUCT_CONVERGENCE.md`  
**Baseline authority:** `roadmap/P1_UV0_BASELINE_INVENTORY.md`.

The substrate is substantially better than the original baseline, including the task-first shell, contextual locus, shared design-system components and unified analyst/developer mode. C must now make the *normal product experience* visibly converge rather than reopen the UI architecture.

C consumes analytical/semantic truth from A/B/Moneta/Atlas. No C implementation may calculate new scientific facts from visual appearance.

## C1 - functional epistemic world objects

Re-audit every persistent world object against the rule: **persistent objects earn their volume**.

### TechnoCore

- make representation decision state, why/alternatives/constraints/remediation visibly inspectable;
- distinguish `DECISIVE`, `INFEASIBLE`, `UNDERDETERMINED` and `AMBIGUOUS` without pretending statistical confidence;
- make preview/revert of representation changes legible.

### Vault and portals

- prove archive/freeze/recovery is production-usable or demote/remove the persistent Vault object;
- expose portal destination/return semantics before traversal;
- reserve portals for semantic travel, not ordinary mutation.

### Memory Palace

- embody observations, questions, hypotheses, tests, findings, contradictions and branch points as restrained epistemic objects;
- reveal reasoning links contextually rather than as permanent graph clutter;
- bind evidence/counterevidence to the relevant epistemic object;
- preserve semantic identity across valid representation changes/replay.

**Exit:** every persistent normal-mode world object has a production-path investigator function and visible state contract.

## C2 - investigation-state legibility

Make the world answer without log reading:

- what changed;
- what is selected/focused;
- what analytical work is pending/ready/refused;
- what evidence supports the current interpretation;
- whether a change is preview or committed;
- whether the user can undo/recover;
- where the current branch/state came from.

Transitions must preserve spatial continuity where semantic identity survives and respect reduced-motion/accessibility settings.

## C3 - desktop/XR parity

- keep one task vocabulary and semantic intent across desktop, pointer, controller, ray and direct touch;
- preserve platform-appropriate mechanics without creating two products;
- ensure essential tasks are discoverable without a hidden gesture;
- keep diagnostics out of normal analyst hierarchy;
- preserve the normal surface budget.

## C4 - visible-product evidence

For materially visible C changes:

- capture production-build before/after evidence against the canonical UV baseline;
- exercise complete product journeys in Playwright;
- run IWER where spatial/input behavior is simulator-testable;
- assert semantic-intent outcomes, not component existence;
- independently review discoverability, usefulness, information hierarchy and visual salience.

Canonical journeys remain:

1. first insight;
2. skeptical investigation / representation challenge;
3. Memory Palace reasoning;
4. archive/replay/recovery.

**Finite exit:** C reaches `IMPLEMENTATION LANDED / REVIEW ACTIVE` when the canonical journeys visibly converge on desktop and simulator-testable XR. `VERIFIED COMPLETE` still requires the P1-U9 physical evidence owned by the later D qualification phase.

### Stream C collision rule

C owns product shell/world-object/presentation state and affordances. It consumes A/B semantic contracts. C must not modify Rust analytical reduction, candidate scientific meaning or source membership merely to support a visual treatment.

---

# Stream D - Assurance & Private-Preview Readiness

**Status:** QUEUED AFTER C  
**Primary programmes:** `roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md`, `STREAM_C_SECURITY_ASSURANCE.md` (legacy execution name), issue #314 hardening backlog, and later P1-U9/P1-W gates.

The file `STREAM_C_SECURITY_ASSURANCE.md` retains its historical name because it is evidence from the previous completed A/B/C wave. Under the current wave, all unresolved security/privacy/live-path findings in that document are owned by **Stream D**.

D retains two conceptual sub-lanes because their file surfaces and evidence contracts are distinct, but they are **not executed in parallel under the current operating model**:

- **D-QV:** Quest validation operations and evidence attribution.
- **D-SA:** security/privacy/supply-chain/WASM assurance.

The forward implementation stream selects and completes one bounded D tranche at a time, with the same adversarial review/fix-forward and exact-head promotion discipline.

## D1 - validation manifest and launcher

Implement P1-QV QV0/QV1:

- one versioned validation manifest;
- exact source/build identity and clean/dirty state;
- explicit evidence class separate from result;
- governed run modes/launcher without changing ordinary dev behavior;
- session ID/evidence directory/runtime class/gate/profile attribution;
- no automatic roadmap mutation.

## D2 - evidence sink and adjudication

Implement QV2-QV4:

- local declared Quest model/firmware metadata with measured/declarative distinction;
- per-session bounded evidence directories;
- analyzer validity separate from gate disposition;
- `PASS | FAIL | PARTIAL | INVALID_RUN | BLOCKED` outcomes;
- explicit prevention of current 10M boundary evidence being relabelled as final device qualification.

## D3 - live-path security quick wins

Prioritize isolated, production-path findings that do not collide with the earlier completed programmes:

- RF-039 upload policy consolidation at the real `FileLoader -> Atlas -> Rust -> Dataset` path;
- RF-041 remove unnecessary `unpkg` trust/import-map/CSP widening if production proof confirms it is unused;
- RF-042 terminal control-sequence sanitization in the dev UX trace path.

Each remains high-risk or production-path evidence-bearing according to `AGENTS.md`; helper-only tests are insufficient.

## D4 - deeper privacy/WASM assurance

- RF-040 telemetry consent/lifecycle truthfulness across actual stores/exports;
- RF-043 parser/WASM ABI fuzz/property campaigns with deterministic regressions for discovered defects;
- post-Moneta trap containment/recovery, stale-handle invalidation and state rehydration where the architecture can prove it safely;
- audit relevant Rust `unsafe` invariants and hostile pointer/length boundaries.

## D5 - guided physical UX validation readiness

Implement QV5/QV6 after C's current treatment is stable enough to test:

- controller/direct-touch semantic tasks;
- capture/cancel/tracking-loss recovery;
- precision escape and panel manipulation;
- representation transition semantics;
- accessibility modes;
- bounded comfort/task outcome records;
- dev-only validation dashboard excluded from production artifacts.

Final P1-U9 evidence starts only after C's visible product convergence gate.

## D6 - physical qualification and P1-W/private-preview handoff

After C reaches its product convergence exit and other named prerequisites are satisfied:

1. run P1-U9 physical Quest qualification on the converged treatment;
2. add QV7 clean-production evidence handoff;
3. execute P1-W production wiring only against surfaces that are no longer scheduled for structural replacement;
4. close required security/privacy/production blockers;
5. assemble the minimal private-preview promotion evidence.

**Finite exit:** D has not completed merely because the validation harness exists. The stream exits only when the required assurance gates for the selected private-preview scope are satisfied and clean-production/device evidence is correctly classified.

---

# Sequential execution and integration rules

## Ownership matrix

| Surface | A | B | C | D |
| --- | --- | --- | --- | --- |
| Generic semantic drill-down / selection lineage | **frozen authority** | consumes | consumes | tests |
| Representation-specific Rust/payload math | consumes | **OWNS while active** | no | assurance only |
| Generic semantic Worker/loader/translator seam | **frozen contract** | narrow integration window | no scientific changes | tests/security only |
| Product shell/world objects/presentation hierarchy | consumes | no | **OWNS when active** | validation only |
| Quest validation scripts/manifests/evidence sink | no | no | consumer | **OWNS when active** |
| Upload/auth/privacy/CSP/fuzz/live-path assurance | no | no | consumer | **OWNS when active** |
| `docs/ROADMAP.md` status | checkpoint updates | checkpoint updates | checkpoint updates | checkpoint updates |

## Collision-sensitive files

The following are shared integration contracts and should change only in the active sequential tranche when that change is necessary:

- `src/app/dataset/LoadDatasetUseCase.ts`;
- `src/app/dataset/SemanticEmbodimentLoader.ts`;
- `src/moneta/MonetaTopologyNode.ts`;
- `src/moneta/VRTopologyTranslator.ts` or its successor;
- generic representation/requirements contracts;
- `src/vr/presentation/representation/RepresentationSurface.ts`;
- shared analytical Worker/WASM bridge dispatch;
- common CI/promotion workflow files.

Representation-specific Rust modules, payload files, thin adapters, UI components and validation/security modules should be preferred so each tranche remains bounded and reviewable.

## Integration order

1. **A is frozen complete** at the generic progressive-disclosure contract and its four verified families.
2. **B** consumes A's semantic-target/detail contract while adding one governed structural family at a time.
3. **C** consumes the completed A/B semantic contracts to converge the investigator experience; it does not implement membership lookup or analytical facts.
4. **D** follows C for final physical qualification and private-preview assurance; its internal assurance work is still executed as bounded sequential tranches.
5. **P1-W** waits for C plus the required D assurance/device prerequisites.

## Sync discipline

Every checkpoint PR must:

1. fetch live `main` before branch creation;
2. state the exact base SHA;
3. confirm the previous checkpoint is merged or abandoned;
4. avoid stacked long-lived checkpoint branches;
5. sync/reconcile any new `main` before final promotion when strict status checks require it;
6. carry pre/post adversarial review for high-risk changes;
7. merge only on exact-head evidence appropriate to the risk surface;
8. fetch fresh `main` before beginning the next checkpoint.

The single forward implementation stream should sync frequently with remote `main`, especially before touching the small but high-leverage shared contracts.

## One forward implementation PR

Default maximum:

```text
1 open forward implementation PR
```

Do not parallelize A/B/C/D implementation. Documentation-only closure/fix-forward commits should normally remain on the owning active PR rather than creating overlapping work. A different execution model requires an explicit user decision.

---

# Cross-cutting quality model

Independent adversarial review is not a separate feature stream. It is mandatory process inside the single forward implementation stream.

For high-risk work, use:

```text
pre-implementation adversarial contract
  -> bounded implementation
  -> focused falsifiers
  -> production-path evidence
  -> post-implementation adversarial review
  -> exact-head promotion gates
  -> merge
  -> fresh-main re-fence where the programme requires a STOP review
```

Green CI is necessary, not sufficient. `VERIFIED COMPLETE` requires the evidence claimed by the owning programme plus an independent review disposition.

Status vocabulary:

- **PLANNED:** work is specified but no implementation claim exists.
- **IMPLEMENTATION PARTIAL:** some checkpoints landed but the stream exit is unsatisfied.
- **IMPLEMENTATION LANDED / REVIEW ACTIVE:** implementation path exists and required independent/physical evidence remains.
- **VERIFIED COMPLETE:** finite scope is implemented, exact evidence is satisfied and independent review found no unresolved blocker.
- **BLOCKED:** a named unmet prerequisite or falsified invariant prevents promotion.
- **DEFERRED:** intentionally outside the current wave; no implementation should begin without explicit reactivation.

---

# Work explicitly deferred from this wave

Do **not** start these merely because capacity exists:

- inferred clustering (`k`-means, DBSCAN/HDBSCAN, mixtures, spectral clustering, etc.) under the R2D source-partition identity;
- inferred relationship topology such as k-NN/correlation/similarity edges without a separate governed treatment;
- P2 RepresentationGraph/compositional representation search;
- generative geometry as a substitute for governed semantic payloads;
- broad automatic learned-representation expansion;
- the full major dependency-modernization programme in issue #300 while the current structural/product/assurance programmes are moving;
- Node/toolchain/Three.js/Rust major migrations that would create cross-programme churn without a specific blocker.

Safe isolated patch/minor dependency maintenance and narrowly justified CI-action updates may proceed only when selected as the current bounded forward tranche and when they retain exact-head evidence.

---

# Completed and subordinate programme authorities

These remain authoritative for their scoped contracts/evidence even when their status headers reflect the checkpoint at which they were written:

- `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` - semantic embodiment architecture and R5/R2E requirements;
- `roadmap/P1_R2C_DENSITY_TRUTH.md` - completed density truth rail;
- `roadmap/P1_R2D_CLUSTER_REGIONS.md` - completed source-partition Cluster Regions V1 rail;
- `review/P1_R2D_C5_STOP_REVIEW_2026-08-31.md` - R2D independent closure evidence;
- `review/P1_R5_A5_STOP_REVIEW_2026-08-31.md` - P1-R5 progressive-disclosure closure evidence;
- `rfcs/0001-source-partition-cluster-authority.md` - durable R2D scientific decision;
- `roadmap/P1_UV_VISIBLE_PRODUCT_CONVERGENCE.md` - visible product convergence specification;
- `roadmap/P1_UV0_BASELINE_INVENTORY.md` - executable visible baseline/inventory;
- `roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md` - Quest validation operations specification;
- `STREAM_C_SECURITY_ASSURANCE.md` - legacy-named security assurance finding set, now owned by current Stream D;
- `STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md` - implementation-quality policy from the prior wave, still useful as process guidance but not the current Stream A mission;
- issue #314 - post-Moneta hardening backlog;
- issue #300 - major dependency modernization, deferred as a broad sprint during this wave.

Historical review plans keep their original stream names for provenance. Do not reinterpret those labels as current concurrent ownership.

---

# Private-preview dependency chain

The high-level dependency remains:

```text
preserved source data
  -> truthful analytical evidence
  -> reproducible identity/replay
  -> bounded dataset-level representations
  -> progressive disclosure and structural breadth
  -> coherent investigator UX
  -> simulator-testable XR proof
  -> governed physical Quest proof
  -> production wiring and security/privacy assurance
  -> minimal private preview
```

A/B/C/D are now ordered programme boundaries for reaching that chain without duplicate authority. They are not permission to weaken scientific, UX, security or evidence gates, and they are not to be implemented in parallel under the current operating model.