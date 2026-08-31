# Nemosyne Roadmap & Implementation Status

> **Canonical implementation-status and execution authority.** Product and research direction remain governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This file is the current operational map: what is active, which stream owns it, what may run in parallel, which integration seams are exclusive, what evidence closes a checkpoint, and what must wait. Detailed programme documents remain the scientific, UX, security, or evidence specification for their own scope; their older status headers do not override this live roadmap.

## Status snapshot - 31 August 2026

**Current integration base for this planning update:** `main@5eb9b7617d4d657569ccb0bdf5fbb374b3405d1f` (#595 merged).

The previous A/B/C convergence wave, Stream M distribution wave, Density Truth R2C, and source-partition Cluster Regions R2D have reached their finite exits. In particular:

- Aggregate Volume is a verified Rust-owned bounded semantic embodiment.
- Distribution Field is a verified bounded empirical-distribution embodiment rather than a density alias.
- Density Field is a verified Rust-owned governed density embodiment.
- Cluster Regions source-partition V1 is `VERIFIED COMPLETE` after C1-C5, including the #595 evidence-trigger fix-forward and fresh-main STOP review.
- Fresh dataset loads are overview-first rather than silently biasing Moneta toward individual observation identity.
- Aggregate, distribution, density and governed cluster structures are first-class semantic interaction targets rather than being registered as raw observations.
- P1-UV baseline evidence, task-first shell/contextual-locus substrate, unified UI primitives and visual-system convergence foundations are landed, but the full visible product treatment is not yet complete.

The next wave is deliberately organized into four independent execution streams. The old A/B/C stream labels in historical review plans remain evidence of that completed wave; they are **not** current ownership labels.

## Current execution wave: Streams A-D

An agent may now be told simply:

```text
Complete Stream A.
Complete Stream B.
Complete Stream C.
Complete Stream D.
```

Each stream has a finite mission, explicit ownership, ordered checkpoints, collision rules, evidence gates and a hard stop. At most one implementation PR per current stream may be open at once unless this roadmap explicitly permits an internal sub-lane.

| Stream | Mission | First checkpoint | Can run beside | Finite exit |
| --- | --- | --- | --- | --- |
| **A - Progressive Disclosure & Semantic Drill-down** | Make dataset-level structure the normal starting point while preserving exact observations as bounded drill-down. | A1 semantic drill-down contract/falsifiers | B, C, D | Structure -> region/group -> bounded observations -> datum/provenance works through the production path without rematerialising the whole dataset. |
| **B - Source-Authoritative Structural Representations** | Add truthful graph/hierarchy/temporal/geospatial/spectral dataset structures without presentation-side inference. | B1 source relationship-graph authority contract | A, C, D | First selected structural family is verified complete; then STOP and explicitly select the next family. |
| **C - Visible Investigator Product Convergence** | Turn the landed substrate and semantic representations into the sparse, task-first Nemosyne experience. | C1 functional epistemic world objects | A, B, D | Canonical journeys visibly converge on desktop and simulator-testable XR; remaining physical questions are handed to P1-U9. |
| **D - Assurance & Private-Preview Readiness** | Build attributable Quest validation operations, close live-path security/privacy residuals and prepare clean production/private-preview qualification. | D1 validation manifest + launcher | A, B, C | Validation/security prerequisites are ready; final physical qualification and P1-W execute only when C and other named prerequisites are satisfied. |

### Dependency shape

```text
                         +--> Stream A: progressive disclosure --------+
                         |                                             |
verified dataset-level --+--> Stream B: structural representations ----+--> converged investigator product
representations           |                                             |
                         +--> Stream C: visible product convergence ----+
                         |
                         +--> Stream D: assurance / preview readiness --------+
                                                                        |
                                      C complete + D readiness ----------+
                                                                        v
                                                             P1-U9 physical qualification
                                                                        v
                                                               P1-W production wiring
                                                                        v
                                                               minimal private preview
```

A is the shared semantic integration spine. B may build representation-specific analytical objects in parallel, but must consume A's generic drill-down/selection contract at integration time rather than inventing a second one. C consumes A/B semantic state and may not manufacture analytical facts. D may validate and harden every stream but may not promote physical or preview claims before the owning product prerequisites are satisfied.

---

# Stream A - Progressive Disclosure & Semantic Drill-down

**Status:** ACTIVE NEXT / PRODUCT CRITICAL PATH  
**Primary programme:** P1-R5 in `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`  
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

- implement the bounded membership/detail query at the canonical Rust/Worker dataset authority;
- return only the requested bounded identity/compact view;
- keep full source rows resident;
- apply resource bounds before output growth;
- prove stale/foreign handles and mismatched semantic targets fail closed;
- preserve exact observation identity where the underlying representation contract can support membership.

**Exit:** the production analytical runtime can answer a bounded semantic-target detail request without whole-dataset JS materialisation.

## A3 - representation transition and selection lineage

- reveal observation-level marks only for the selected/focused bounded subset or an explicit observation-level task;
- preserve the selected semantic structure while entering detail;
- keep semantic IDs separate from transient mesh/instance indexes;
- make reverse navigation explicit: observation -> containing semantic structure -> dataset overview;
- integrate P1-F focus/context and existing representation-surface interaction semantics.

**Exit:** the user can move between structure and observations without losing context or replacing the whole dataset with points.

## A4 - exact datum/provenance inspection

- connect selected observations to exact datum/provenance retrieval;
- make missing/unavailable provenance explicit;
- preserve replay/investigation identity;
- ensure UI panels consume bounded exact-detail requests rather than cached whole datasets.

## A5 - product evidence and independent STOP

Canonical product evidence must include at least Aggregate/Distribution/Density/Cluster paths and prove:

- overview begins at dataset structure;
- selecting a structure can reveal a bounded observation subset;
- source N does not determine the amount of row data transferred for an unopened structure;
- returning to overview restores the semantic representation and selection context;
- explicit observation-level intent can still choose `POINT_SET` legitimately;
- refusal/pending/stale membership cannot silently fall back to all-points rendering.

**Finite exit:** P1-R5 is `VERIFIED COMPLETE` only for the verified families and bounded query semantics. Do not automatically expand into arbitrary cross-filtering or new scientific analyses.

### Stream A ownership and collisions

A temporarily owns the **generic** drill-down/selection integration contract around:

- `src/app/dataset/LoadDatasetUseCase.ts` where generic investigation requirements/detail state enter;
- generic semantic target/detail request types;
- Worker/runtime detail-query dispatch;
- `MonetaTopologyNode` generic semantic selection lifecycle;
- generic `RepresentationSurface` selection/detail transitions.

B must not create a competing graph-specific member-query API. C may present `Reveal observations` or equivalent controls only by dispatching A's governed intent. D may test these paths but does not own them.

---

# Stream B - Source-Authoritative Structural Representations

**Status:** PLANNED / MAY START IMMEDIATELY BESIDE A  
**Primary programme:** P1-R2E in `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`  
**First selected family:** source-provided `RELATIONSHIP_GRAPH`.

## Governing rule

B represents **source-authoritative structure first**. It does not infer structure from visual proximity, color, density, correlation, k-nearest-neighbour search or a force layout unless a later separately governed analytical treatment explicitly authorizes that method.

The first slice is Relationship Graph because source-provided edges create the cleanest authority boundary and exercise a genuinely non-point dataset structure.

## B1 - Relationship Graph scientific/authority contract

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

A's generic selection/drill-down contract is consumed here if it has landed. If A has not yet frozen that contract, B3 pauses at the integration seam while B1/B2 continue independently.

## B4 - product/scale/perceptual evidence and STOP

- prove source graph edges survive the full product path unchanged;
- prove arbitrary layout changes do not change topology;
- measure bounded payload/render behavior;
- prove no invented edges appear when source authority is absent;
- conduct independent review.

**Finite exit:** source-authoritative Relationship Graph V1 reaches `VERIFIED COMPLETE` for its evidence scope, then B STOPS. Selecting hierarchy, temporal, geospatial or spectral as the next B slice requires an explicit fresh-main choice.

### Later B candidates, ordered preference

1. Hierarchy with explicit parent/child authority.
2. Temporal trajectory with explicit entity/time-order authority.
3. Geospatial structure with explicit coordinate/reference-system authority.
4. Spectral/frequency structure only after its exact mathematical object is governed.
5. `MANIFOLD_EMBEDDING` and `MULTISCALE_FIELD` remain implement-or-defer candidates; point-like surrogates under stronger labels are forbidden.

### Stream B collision rule

B owns representation-specific Rust modules, discriminated payloads, family-specific WASM proof and thin adapters. Shared generic files are integration windows, not permanent B ownership. Only one PR at a time may modify any shared semantic transport/translator contract.

---

# Stream C - Visible Investigator Product Convergence

**Status:** IMPLEMENTATION PARTIAL / NEXT VISIBLE-PRODUCT WAVE  
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

**Status:** PLANNED / HIGHLY PARALLEL  
**Primary programmes:** `roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md`, `STREAM_C_SECURITY_ASSURANCE.md` (legacy execution name), issue #314 hardening backlog, and later P1-U9/P1-W gates.

The file `STREAM_C_SECURITY_ASSURANCE.md` retains its historical name because it is evidence from the previous completed A/B/C wave. Under the current wave, all unresolved security/privacy/live-path findings in that document are owned by **Stream D**.

D may operate in two internal sub-lanes because their file surfaces are normally disjoint:

- **D-QV:** Quest validation operations and evidence attribution.
- **D-SA:** security/privacy/supply-chain/WASM assurance.

They still share one Stream D promotion owner and may not create conflicting changes to common CI/governance files.

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

Prioritize isolated, production-path findings that do not collide with A/B/C:

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

This work may be implemented before C completes, but it **must not qualify the old treatment**. Final P1-U9 evidence starts only after C's visible product convergence gate.

## D6 - physical qualification and P1-W/private-preview handoff

After C reaches its product convergence exit and other named prerequisites are satisfied:

1. run P1-U9 physical Quest qualification on the converged treatment;
2. add QV7 clean-production evidence handoff;
3. execute P1-W production wiring only against surfaces that are no longer scheduled for structural replacement;
4. close required security/privacy/production blockers;
5. assemble the minimal private-preview promotion evidence.

**Finite exit:** D has not completed merely because the validation harness exists. The stream exits only when the required assurance gates for the selected private-preview scope are satisfied and clean-production/device evidence is correctly classified.

---

# Parallel execution and integration rules

## Ownership matrix

| Surface | A | B | C | D |
| --- | --- | --- | --- | --- |
| Generic semantic drill-down / selection lineage | **OWNS** | consumes | consumes | tests |
| Representation-specific Rust/payload math | consumes | **OWNS** | no | assurance only |
| Generic semantic Worker/loader/translator seam | **integration owner while A contract active** | short integration window | no scientific changes | tests/security only |
| Product shell/world objects/presentation hierarchy | consumes | no | **OWNS** | validation only |
| Quest validation scripts/manifests/evidence sink | no | no | consumer | **OWNS** |
| Upload/auth/privacy/CSP/fuzz/live-path assurance | no | no | consumer | **OWNS** |
| `docs/ROADMAP.md` status | checkpoint updates | checkpoint updates | checkpoint updates | checkpoint updates |

## Collision-sensitive files

The following are shared integration contracts. Only one open PR may change a given file/contract unless the PRs are explicitly stacked by design:

- `src/app/dataset/LoadDatasetUseCase.ts`;
- `src/app/dataset/SemanticEmbodimentLoader.ts`;
- `src/moneta/MonetaTopologyNode.ts`;
- `src/moneta/VRTopologyTranslator.ts` or its successor;
- generic representation/requirements contracts;
- `src/vr/presentation/representation/RepresentationSurface.ts`;
- shared analytical Worker/WASM bridge dispatch;
- common CI/promotion workflow files.

Representation-specific Rust modules, payload files, thin adapters, UI components and validation/security modules should be preferred so parallel work remains physically separated.

## Integration windows

1. **A1 contract freeze** is the first shared seam. B1/B2 and independent C/D work may proceed while A1 is being finalized.
2. **B3 production cutover** waits if it needs A's still-changing generic semantic-target/detail contract. Do not fork it.
3. **C drill-down presentation** waits for A's intent/API rather than implementing its own membership lookup.
4. **D P1-U9 qualification** waits for C product convergence; D-QV tooling itself does not wait.
5. **P1-W** waits for C plus the required D assurance/device prerequisites.

## Sync discipline

Every checkpoint PR must:

1. fetch live `main` before branch creation;
2. state the exact base SHA;
3. confirm the previous checkpoint in its own stream is merged or abandoned;
4. avoid stacked long-lived checkpoint branches;
5. sync/reconcile any new `main` before final promotion when strict status checks require it;
6. carry pre/post adversarial review for high-risk changes;
7. merge only on exact-head evidence appropriate to the risk surface;
8. fetch fresh `main` before beginning the next checkpoint.

Cross-stream agents should sync frequently because the integration seams are intentionally small but high-leverage.

## One open PR per stream

Default maximum:

```text
1 open Stream A implementation PR
1 open Stream B implementation PR
1 open Stream C implementation PR
1 open Stream D implementation PR
```

D-QV and D-SA may each prepare work in parallel only when their changed-file sets are disjoint; they must not both open conflicting governance/workflow modifications. Documentation-only closure/fix-forward PRs may coexist when they do not claim implementation ownership.

---

# Cross-cutting quality model

Independent adversarial review is **not** a fifth feature stream. It is mandatory process across A-D.

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
- the full major dependency-modernization programme in issue #300 while A/B/C integration seams are moving;
- Node/toolchain/Three.js/Rust major migrations that would create cross-stream churn without a specific blocker.

Safe isolated patch/minor dependency maintenance and narrowly justified CI-action updates may proceed when they do not collide with active streams and retain exact-head evidence.

---

# Completed and subordinate programme authorities

These remain authoritative for their scoped contracts/evidence even when their status headers reflect the checkpoint at which they were written:

- `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` - semantic embodiment architecture and R5/R2E requirements;
- `roadmap/P1_R2C_DENSITY_TRUTH.md` - completed density truth rail;
- `roadmap/P1_R2D_CLUSTER_REGIONS.md` - completed source-partition Cluster Regions V1 rail;
- `review/P1_R2D_C5_STOP_REVIEW_2026-08-31.md` - R2D independent closure evidence;
- `rfcs/0001-source-partition-cluster-authority.md` - durable R2D scientific decision;
- `roadmap/P1_UV_VISIBLE_PRODUCT_CONVERGENCE.md` - visible product convergence specification;
- `roadmap/P1_UV0_BASELINE_INVENTORY.md` - executable visible baseline/inventory;
- `roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md` - Quest validation operations specification;
- `STREAM_C_SECURITY_ASSURANCE.md` - legacy-named security assurance finding set, now owned by current Stream D;
- `STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md` - implementation-quality policy from the prior wave, still useful as process guidance but not the current Stream A mission;
- issue #314 - post-Moneta hardening backlog;
- issue #300 - major dependency modernization, deferred as a broad sprint during this wave.

Historical review plans keep their original stream names for provenance. Do not reinterpret those labels as current ownership.

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

The four streams are an execution topology for reaching that chain faster without creating duplicate authority. They are not permission to weaken scientific, UX, security or evidence gates.