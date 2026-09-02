# Nemosyne Roadmap & Implementation Status

> **Canonical implementation-status and execution authority.** Product and research direction remain governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This file is the current operational map: what is active, which programme owns it, which integration seams are exclusive, what evidence closes a checkpoint, and what must wait. Detailed programme documents remain the scientific, UX, security, or evidence specification for their own scope; their older status headers do not override this live roadmap.

## Status snapshot - 2 September 2026

**Current integration base for this planning update:** `main@c408577361d102d5b078bc17f7064dafa15d7fff` (#624, RFC 0003 accepted). Stream A is fully closed. Stream B's first selected structural family, source-authoritative Relationship Graph V1, is `VERIFIED COMPLETE / STOP` through B1-B4. Stream C's bounded C1-C4 implementation/evidence wave has landed through #616; canonical desktop and simulator-testable journeys are now present, while physical XR fitness remains an explicit later evidence boundary rather than inferred completion. The rolling P1 product-transition programme is the forward execution frame: PT0 through PT2 are complete, RFC 0003 is accepted, and PT3B executable governance contracts are under implementation and adversarial review.

The previous A/B/C convergence wave, Stream M distribution wave, Density Truth R2C, source-partition Cluster Regions R2D, Progressive Disclosure Stream A, the first selected Stream B structural family, and the bounded C1-C4 visible-product wave have reached their stated implementation exits. In particular:

- A1 semantic drill-down contract/falsifiers is `VERIFIED COMPLETE` after establishing SemanticDrillDown.ts and drill_down.rs WASM validation boundary.
- A2 resident bounded semantic membership/query capability is `VERIFIED COMPLETE` through the canonical Worker/Rust authority.
- A3 semantic selection lineage, bounded observation reveal, and explicit return-to-structure are `VERIFIED COMPLETE` for the generic production path.
- A4 exact datum/provenance inspection is `VERIFIED COMPLETE` after #605, using a second bounded authority query rather than a whole-dataset UI cache.
- A5 cross-family product evidence and the independent STOP review establish the finite P1-R5 closure for Aggregate, Distribution, Density and source-partition Cluster, with #606 merged and all exact-head gates green.
- Stream B Relationship Graph V1 is `VERIFIED COMPLETE / STOP`: B1 source authority contract merged via #607; B2 resident Rust/WASM bounded topology payload merged via #610; B3 production cutover + thin graph adapter merged via #611; and B4 product/scale/perceptual evidence + independent STOP review merged via #612 at `main@232d952`.
- C1 on #613 is `VERIFIED COMPLETE`: TechnoCore, Evidence Vault, Farcaster portals and a bounded Memory Palace projection are investigator-functional without creating a second analytical/epistemic authority. Its post-review is `review/P1_UV_C1_FUNCTIONAL_WORLD_OBJECTS_POST_REVIEW_2026-09-01.md`.
- C2 on #614 landed investigation-state legibility in the existing Status Strip, including the post-review fix for stale visible origin after undo and historical graph-root compatibility.
- C3 on #615 landed one canonical `Inspect | Compare | Challenge | Record | Navigate | More` selected-object task vocabulary across desktop and XR presentation, with production-browser evidence and no second selection/analytical authority.
- C4 on #616 landed the four canonical visible investigator journeys, including governed investigator-authored reasoning projected through the existing Memory Palace path. Browser/IWER evidence remains non-physical evidence; C4 does not close P1-U9.
- QV0/QV1 validation manifest/launcher and the governed evidence sink are landed; #617 replaced error-prone governed manual Quest firmware/model attribution with fail-closed ADB machine capture. QV4 automatic gate adjudication remains open.
- #619 completed PT0/E0: removed unused `unpkg` Three.js runtime trust, tightened CSP, refreshed feature truth, made architecture policy an every-PR check, and installed one-way TypeScript hygiene ratchets.
- #621 and #622 completed PT1's bounded CI-feedback work while preserving exact-head evidence. The concrete rolling clean exact-head objective recorded by execution epic #620 is p50 <= 270 seconds and p95 <= 360 seconds; it remains an operational SLO to monitor rather than an indefinitely open implementation tranche.
- `TsatsuAmable/nemosyne-data#3` completed PT2 at `nemosyne-data@8e6b2dfc74ea1c60283790668cc93030c61423f8`: catalogue schema 2.2 / corpus v0.4.0, five known-answer families, ten direct metamorphic variants and one explicitly production-pending NIL fixture are governed and independently validated outside Nemosyne production code.
- Aggregate Volume is a verified Rust-owned bounded semantic embodiment.
- Distribution Field is a verified bounded empirical-distribution embodiment rather than a density alias.
- Density Field is a verified Rust-owned governed density embodiment.
- Cluster Regions source-partition V1 is `VERIFIED COMPLETE` after C1-C5, including the #595 evidence-trigger fix-forward and fresh-main STOP review.
- Fresh dataset loads are overview-first rather than silently biasing Moneta toward individual observation identity.
- Aggregate, distribution, density, governed cluster and source-authoritative relationship-graph structures are first-class semantic interaction targets rather than being registered as raw observations.
- Explicit individual-inspection intent can still select `POINT_SET`; progressive disclosure removes point universality, not legitimate observation-level representation.

## Sequential execution model

The roadmap retains the A/B/C/D programme names because they encode bounded ownership and finite exits, but **they are no longer parallel execution streams**. From 31 August 2026 onward, implementation proceeds as one forward stream with adversarial review/fix-forward integrated into each tranche. From #619 onward, `roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md` and issue #620 provide the rolling product-transition tranche sequence while this file remains the canonical status authority.

Current order:

```text
Stream A STOP
  -> Stream B Relationship Graph V1 STOP
    -> Stream C bounded C1-C4 implementation/evidence LANDED
      -> P1-PT product transition (PT0-PT2 complete -> PT3A RFC accepted -> PT3B contracts...)
        -> assurance / selected-platform physical qualification / preview readiness
          -> P1-W production wiring where still applicable
            -> minimal private preview
```

Only one forward implementation PR should be active at a time unless the user explicitly changes this execution policy. Before each tranche, fetch fresh `main`; after implementation, perform the bounded adversarial review, run the relevant exact-head evidence, fix forward, merge, then fetch fresh `main` again.

| Programme | Mission | Current checkpoint | Sequential position | Finite exit |
| --- | --- | --- | --- | --- |
| **A - Progressive Disclosure & Semantic Drill-down** | Make dataset-level structure the normal starting point while preserving exact observations as bounded drill-down. | A5 STOP / #606 | **VERIFIED COMPLETE / STOP** | Structure -> region/group -> bounded observations -> datum/provenance works through the production path without rematerialising the whole dataset. |
| **B - Source-Authoritative Structural Representations** | Add truthful graph/hierarchy/temporal/geospatial/spectral dataset structures without presentation-side inference. | Relationship Graph B4 STOP / #612 | **VERIFIED COMPLETE / STOP FOR FIRST SELECTED FAMILY** | Source-authoritative Relationship Graph V1 is verified complete; selecting another B family requires an explicit fresh-main choice. |
| **C - Visible Investigator Product Convergence** | Turn the landed substrate and semantic representations into the sparse, task-first Nemosyne experience. | C4 visible journeys / #616 | **IMPLEMENTATION LANDED / REVIEW ACTIVE** | Canonical journeys visibly converge on desktop and simulator-testable XR; physical-input/comfort fitness remains later device evidence. |
| **P1-PT - Product Transition & Evolutionary Improvement** | Turn the research system into a usable, maintainable, operable product while improving learning velocity without weakening scientific authority. | PT3B executable governance contracts | **ACTIVE** | PT0-PT10 are completed or explicitly re-scoped with product, production, data, learning and private-preview evidence correctly classified. |
| **D / assurance legacy boundary** | Preserve attributable validation, live-path security/privacy assurance and clean-production/device qualification contracts needed by the selected preview scope. | QV2 attribution landed; QV4/QV5/QV7 and security residuals open | **CONSUMED BY P1-PT / ACTIVE WHEN SELECTED** | Required assurance gates for the selected private-preview scope are satisfied; no browser/simulator evidence is promoted into physical proof. |

A is the shared semantic integration spine and is frozen at its finite P1-R5 boundary. B's first structural family is frozen at its Relationship Graph V1 boundary. C consumes A/B semantic state and may not manufacture analytical facts. P1-PT now sequences product, UX, CI, data, production and learning work. Quest remains a useful reference/qualification platform, not a strategic ceiling or master blocker for unrelated product development.

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

**Status:** VERIFIED COMPLETE / STOP FOR RELATIONSHIP GRAPH V1 — B1 #607, B2 #610, B3 #611, B4 #612 merged  
**Primary programme:** P1-R2E in `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`  
**First selected family:** source-provided `RELATIONSHIP_GRAPH`.  
**Closure review:** `review/P1_R2E_B4_STOP_REVIEW_2026-09-01.md`.

## Governing rule

B represents **source-authoritative structure first**. It does not infer structure from visual proximity, color, density, correlation, k-nearest-neighbour search or a force layout unless a later separately governed analytical treatment explicitly authorizes that method.

The first slice is Relationship Graph because source-provided edges create the cleanest authority boundary and exercise a genuinely non-point dataset structure.

## B1 - Relationship Graph scientific/authority contract

**Status:** VERIFIED COMPLETE / #607 MERGED

- define accepted source edge authority and provenance;
- define node identity, edge identity, directionality, multiplicity/self-loop policy, missing endpoint behavior and edge attributes included in V1;
- define hard node/edge/payload bounds and refusal semantics;
- distinguish source graph topology from presentation layout coordinates;
- narrow Moneta candidate claims to exactly what the payload preserves;
- require a new fitness/treatment identity if admissibility/information semantics change ranking;
- add falsifiers proving no k-NN/correlation/layout-derived edge fallback exists.

**Exit:** contract is deterministic, bounded and scientifically reviewable.

## B2 - resident Rust/WASM graph payload

**Status:** VERIFIED COMPLETE / #610 MERGED

- consume source-authoritative nodes/edges from the canonical resident dataset/graph capability;
- emit bounded stable semantic node/edge IDs and authoritative adjacency;
- keep topology independent of Three.js layout;
- preserve missing/dropped/refused counts explicitly;
- prove deterministic ordering, source identity and resource limits across real WASM.

## B3 - production cutover and thin graph adapter

**Status:** VERIFIED COMPLETE / #611 MERGED

- carry the governed graph payload through Worker/WASM using existing generation/fingerprint/decision fences;
- intercept the governed graph representation before row-derived or proximity-derived layout logic can create topology;
- keep presentation layout purely presentational and visibly distinguish it from edge authority;
- bind selection to stable semantic node/edge IDs;
- fail closed on pending/refused/stale/invalid payloads.

A's generic selection/drill-down contract is frozen and consumed here. B3 extends only the family-specific authority/payload/adaptation required by the shared contract and does not fork the generic semantic-detail API.

## B4 - product/scale/perceptual evidence and STOP

**Status:** VERIFIED COMPLETE / STOP — #612 MERGED AT `main@232d952`

B4 proved:

- source graph edges survive the full product path unchanged;
- arbitrary presentation-layout seed changes do not change topology;
- bounded payload/render behavior, including the 4,000-node near-bound fixture;
- no invented graph appears when source authority is absent, even with graph-like proximity/correlation bait;
- mutation/prefix eviction fences stale graph surfaces;
- independent review closed with no unresolved Relationship Graph V1 blocker.

**Finite exit:** source-authoritative Relationship Graph V1 is `VERIFIED COMPLETE` for its evidence scope and B STOPS. Selecting hierarchy, temporal, geospatial or spectral as the next structural slice requires an explicit fresh-main choice rather than automatic continuation.

### Later B candidates, ordered preference

1. Hierarchy with explicit parent/child authority.
2. Temporal trajectory with explicit entity/time-order authority.
3. Geospatial structure with explicit coordinate/reference-system authority.
4. Spectral/frequency structure only after its exact mathematical object is governed.
5. `MANIFOLD_EMBEDDING` and `MULTISCALE_FIELD` remain implement-or-defer candidates; point-like surrogates under stronger labels are forbidden.

### Stream B collision rule

B's Relationship Graph V1 integration contract is frozen. Future B-family work, if explicitly selected, owns representation-specific Rust modules, discriminated payloads, family-specific WASM proof and thin adapters. Shared generic files remain integration windows rather than permanent B ownership and must preserve Stream A's verified invariants.

---

# Stream C - Visible Investigator Product Convergence

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE — C1 #613, C2 #614, C3 #615 and C4 #616 merged; physical P1-U9 evidence remains open  
**Primary programme:** `roadmap/P1_UV_VISIBLE_PRODUCT_CONVERGENCE.md`  
**Baseline authority:** `roadmap/P1_UV0_BASELINE_INVENTORY.md`.

The bounded C1-C4 product-convergence implementation has landed. C consumes analytical/semantic truth from A/B/Moneta/Atlas and may not calculate new scientific facts from visual appearance. Browser and simulator evidence prove production wiring and simulator-testable semantics, not physical controller/direct-touch/comfort fitness.

## C1 - functional epistemic world objects

**Status:** VERIFIED COMPLETE — #613 MERGED AT `main@5c593b57`  
**Pre-review:** `review-plans/P1_UV_C1_FUNCTIONAL_WORLD_OBJECTS_PRE_REVIEW_2026-09-01.md`  
**Post-review:** `review/P1_UV_C1_FUNCTIONAL_WORLD_OBJECTS_POST_REVIEW_2026-09-01.md`

Re-audit every persistent world object against the rule: **persistent objects earn their volume**.

### TechnoCore

- representation decision state, why/alternatives/constraints/remediation is inspectable through the existing governed RecommendationPanel;
- `DECISIVE`, `INFEASIBLE`, `UNDERDETERMINED` and `AMBIGUOUS` are projected categorically without pretending statistical confidence;
- preview/committed decision identity is legible from the existing Moneta decision state;
- production TechnoCore selection opens guidance rather than hiding a statistical/anomaly-lens mutation inside the landmark.

### Vault and portals

- archive/freeze/recovery state is projected from the real Vault archive path rather than decorative state;
- portal destination/availability semantics are exposed before traversal;
- portals remain semantic navigation/recovery instruments rather than ordinary analysis mutation controls.

### Memory Palace

- explicit ResearchContext, Atlas observations/findings and supported InvestigationGraph nodes are embodied as restrained epistemic objects;
- object count is bounded at 48 and contextual relationship lines at 24;
- reasoning links appear only for explicit source edges incident to the selected object rather than as permanent graph clutter;
- selection uses durable source identity rather than transient mesh indexes;
- the dormant Memory Palace authoring controller remains offline until its placeholder provenance/random identity/incomplete lifecycle is separately made production-safe.

**C1 evidence boundary:** production-browser evidence proves TechnoCore guidance without analytical mutation, real observation projection, real archive freeze -> Vault state transition, saved-portal availability, and the bounded Memory Palace envelope. Retained screenshots also show that legacy scale/salience and overall scene hierarchy still require convergence; C1 does not claim final visual hierarchy, XR parity or physical Quest fitness.

**Exit:** SATISFIED for the bounded C1 product-function contract. #613 merged after exact-head CI, CodeQL, architecture, dedicated C1 browser evidence and bounded adversarial review.

## C2 - investigation-state legibility

**Status:** LANDED / #614 MERGED; bounded post-review closed  
**Pre-review:** `review-plans/P1_UV_C2_INVESTIGATION_STATE_LEGIBILITY_PRE_REVIEW_2026-09-01.md`  
**Post-review:** `review/P1_UV_C2_INVESTIGATION_STATE_LEGIBILITY_POST_REVIEW_2026-09-01.md`

C2 makes the normal Status Strip answer without log reading:

- what changed;
- what is selected/focused;
- what analytical work is pending/ready/refused;
- what evidence supports/refutes the current explicit epistemic state;
- whether a representation change is preview or committed;
- whether the user can undo/redo or recover from a real archive;
- where the current state came from.

Implementation/review invariants:

- the existing Status Strip is reused; no second persistent status panel is added;
- Status Strip placement is governed by `PANEL_LAYOUT.statusStrip`, constructed directly under `analystAnchor`, and pinned to `panel-layout/4+intent-wheel/1+frames/torso-locked`;
- analytical and decision categories are projected from existing authorities without reclassification;
- evidence counts use only explicit incident `supports`/`refutes` edges;
- undo/redo and archive state are read from real Atlas/Vault owners;
- state origin is reconciled against the current analytical fingerprint rather than blindly projecting the graph insertion cursor;
- historical parentless canonical `:vN` load roots remain eligible for exact-fingerprint origin reconciliation because older graph construction normalized their omitted kind to `operation`;
- arbitrary parentless operations are rejected and ambiguous origin matches fail closed;
- no physical Quest claim is made by C2 browser evidence.

**Exit:** bounded desktop/production-browser legibility implementation and review landed through #614. Physical XR fitness remains outside C2's claim.

## C3 - desktop/XR parity

**Status:** LANDED / #615 MERGED  
**Post-review:** `review/P1_UV_C3_DESKTOP_XR_PARITY_POST_REVIEW_2026-09-01.md`

- one canonical selected-object task vocabulary: `Inspect | Compare | Challenge | Record | Navigate | More`;
- desktop and XR dispatch through the same contextual task resolver and owning callbacks;
- task availability/disabled reasons are shared across modalities;
- no second analytical authority, selection store or modality-specific semantic command tree was added;
- production-browser evidence proved real selected-object dispatch and dataset-replacement invalidation;
- no physical controller/direct-touch/Quest fitness claim is made.

## C4 - visible-product evidence

**Status:** LANDED / #616 MERGED; canonical browser journeys present; physical evidence still open  
**Pre-review:** `review-plans/P1_UV_C4_VISIBLE_PRODUCT_JOURNEYS_PRE_REVIEW_2026-09-01.md`

C4 exercised the canonical journeys:

1. first insight;
2. skeptical investigation / representation challenge;
3. Memory Palace reasoning;
4. archive/replay/recovery.

It also added governed investigator-authored question/hypothesis/conclusion/branch lineage over existing investigation/evidence authorities. Supported/refuted/inconclusive terminal reasoning requires existing analytical evidence rather than being inferred from geometry or visual appearance. The dormant `MemoryPalaceController` remains offline.

**Finite exit:** C is `IMPLEMENTATION LANDED / REVIEW ACTIVE`. Canonical journeys visibly converge on desktop and simulator-testable surfaces, but `VERIFIED COMPLETE` still requires the physical-input/comfort evidence owned by later qualification work for whichever target platform is selected.

### Stream C collision rule

C owns product shell/world-object/presentation state and affordances. It consumes A/B semantic contracts. C must not modify Rust analytical reduction, candidate scientific meaning or source membership merely to support a visual treatment.

---

# Stream D - Assurance & Private-Preview Readiness

**Status:** PARTIALLY LANDED / NOW CONSUMED AS BOUNDED ASSURANCE TRANCHES WITHIN P1-PT  
**Primary programmes:** `roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md`, `STREAM_C_SECURITY_ASSURANCE.md` (legacy execution name), issue #314 hardening backlog, and later P1-U9/P1-W gates.

The file `STREAM_C_SECURITY_ASSURANCE.md` retains its historical name because it is evidence from the previous completed A/B/C wave. Under the current product-transition programme, unresolved security/privacy/live-path findings are selected as bounded forward tranches rather than executed as a parallel stream.

Quest is a concrete reference platform for standalone-XR performance, interaction and comfort evidence. It is not a strategic ceiling and its unfinished qualification work does not block unrelated product-transition work.

## D1 - validation manifest and launcher

**Status:** LANDED through QV0/QV1 (#531) and governed evidence-sink work (#535)

- one versioned validation manifest;
- exact source/build identity and clean/dirty state;
- explicit evidence class separate from result;
- governed run modes/launcher without changing ordinary dev behavior;
- session ID/evidence directory/runtime class/gate/profile attribution;
- no automatic roadmap mutation.

## D2 - evidence attribution, sink and adjudication

**Status:** QV2 attribution + QV3 sink LANDED; QV4 ADJUDICATION OPEN

- #617 makes host-side ADB machine capture the governed Quest model/build attribution path;
- required machine facts include model, build incremental and build fingerprint, with optional manufacturer/display/security-patch facts;
- raw ADB serial and serial-derived stable identifiers are not persisted;
- missing, unauthorized or ambiguous ADB attribution fails closed for governed runs;
- manually typed model/firmware metadata cannot upgrade an unattributed governed run;
- per-session bounded evidence directories and fail-closed session routing are landed;
- analyzer validity remains separate from gate disposition;
- QV4 must emit `PASS | FAIL | PARTIAL | INVALID_RUN | BLOCKED` from owned evidence/threshold contracts rather than manufacturing a verdict;
- current 10M boundary evidence may not be relabelled as final device qualification.

## D3 - live-path security quick wins

Current status:

- RF-041 unused `unpkg` trust/import-map/CSP widening: **FIXED by #619**, with a production hygiene ratchet;
- RF-039 upload policy consolidation at the real `FileLoader -> Atlas -> Rust -> Dataset` path: **OPEN**;
- RF-042 terminal control-sequence sanitization in the dev UX trace path: **OPEN**.

Each remaining item stays high-risk or production-path evidence-bearing according to `AGENTS.md`; helper-only tests are insufficient.

## D4 - deeper privacy/WASM assurance

- RF-040 telemetry consent/lifecycle truthfulness across actual stores/exports;
- RF-043 parser/WASM ABI fuzz/property campaigns with deterministic regressions for discovered defects;
- post-Moneta trap containment/recovery, stale-handle invalidation and state rehydration where the architecture can prove it safely;
- audit relevant Rust `unsafe` invariants and hostile pointer/length boundaries.

## D5 - guided physical UX validation readiness

Implement QV5/QV6 when a selected product treatment/platform is stable enough to test:

- controller/direct-touch semantic tasks;
- capture/cancel/tracking-loss recovery;
- precision escape and panel manipulation;
- representation transition semantics;
- accessibility modes;
- bounded comfort/task outcome records;
- dev-only validation dashboard excluded from production artifacts.

IWER/browser evidence may exercise simulator-testable wiring but cannot backfill physical input, comfort or sustained-device claims.

## D6 - physical qualification and P1-W/private-preview handoff

For the selected private-preview platform/scope:

1. collect attributable physical-device evidence where the owning gate requires it;
2. add QV7-equivalent clean-production evidence handoff for the target runtime;
3. execute remaining P1-W production wiring only against surfaces that are no longer scheduled for structural replacement;
4. close required security/privacy/production blockers;
5. assemble the minimal private-preview promotion evidence.

**Finite exit:** assurance has not completed merely because a validation harness exists. The required assurance gates for the selected private-preview scope must be satisfied and evidence classes must remain correctly classified.

---

# P1-PT - Product Transition & Evolutionary Improvement

**Status:** ACTIVE  
**Primary plan:** `roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md`  
**Execution epic:** #620

Current sequential status:

- **PT0: COMPLETE** via #619 at `main@fd53ae22`.
- **PT1: COMPLETE** via #621 and #622; its exact cache miss/hit proof and final green coverage/promotion gates are recorded in the PT1B review, while the p50/p95 objective remains a monitored operational SLO.
- **PT2: COMPLETE** via `TsatsuAmable/nemosyne-data#3` and its PRs #4-#6, ending at `nemosyne-data@8e6b2dfc` with post-merge validation green.
- **PT3A: COMPLETE / RFC ACCEPTED** - RFC 0003 fixes the production identity, purpose-scoped authorization, lifecycle, governed event-envelope, runtime-provenance and Product/Research Mode boundary for implementation.
- **PT3B: IMPLEMENTATION IN PROGRESS** - the first closed TypeScript schema/validator tranche and independent adversarial review are complete on a feature branch; merge/CI evidence remains required. No producer is wired and no production-path enforcement is claimed.
- **Later PT3 implementation and PT4-PT10:** remain planned in the primary product-transition plan and issue #620; they are not completion claims.

P1-PT may select bounded UX, security, reliability, maintainability, CI, documentation and operations ratchets between larger product slices. It must preserve the five product/research authority boundaries and the Notice -> Question -> Hypothesis -> Investigation -> Understanding -> Validation -> Discovery lifecycle.

---

# Sequential execution and integration rules

## Ownership matrix

| Surface | A | B | C | Assurance / P1-PT |
| --- | --- | --- | --- | --- |
| Generic semantic drill-down / selection lineage | **frozen authority** | consumes | consumes | tests/consumes |
| Representation-specific Rust/payload math | consumes | **OWNS while explicitly reactivated** | no | assurance only |
| Generic semantic Worker/loader/translator seam | **frozen contract** | narrow integration window | no scientific changes | tests/security/product integration only |
| Product shell/world objects/presentation hierarchy | consumes | no | **landed C authority** | evolves through bounded product tranches |
| Quest validation scripts/manifests/evidence sink | no | no | consumer | **assurance authority** |
| Upload/auth/privacy/CSP/fuzz/live-path assurance | no | no | consumer | **P1-PT/assurance authority when selected** |
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
2. **B's Relationship Graph V1 is frozen complete**; a new B family requires explicit reactivation rather than automatic continuation.
3. **C1-C4 are landed**; further UX/product refinement proceeds through P1-PT without inventing analytical authority.
4. **P1-PT** is the active sequential programme and selects one bounded forward tranche at a time.
5. **Assurance/device qualification** is invoked where the selected product/private-preview scope requires it; Quest evidence is not a master blocker for unrelated work.
6. **P1-W/private-preview wiring** proceeds only against sufficiently stable surfaces and required assurance contracts.

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

Do not parallelize product-transition implementation. Documentation-only closure/fix-forward commits should normally remain on the owning active PR rather than creating overlapping work. A different execution model requires an explicit user decision.

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
- the full major dependency-modernization programme in issue #300 while the current product-transition programme is moving;
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
- `review/P1_R2E_B4_STOP_REVIEW_2026-09-01.md` - Relationship Graph V1 finite STOP evidence;
- `review/P1_UV_C1_FUNCTIONAL_WORLD_OBJECTS_POST_REVIEW_2026-09-01.md` - C1 functional world-object closure review;
- `review/P1_UV_C2_INVESTIGATION_STATE_LEGIBILITY_POST_REVIEW_2026-09-01.md` - C2 investigation-state legibility closure review;
- `review/P1_UV_C3_DESKTOP_XR_PARITY_POST_REVIEW_2026-09-01.md` - C3 desktop/XR task-semantics review;
- #616 - C4 visible investigator journey implementation/evidence record;
- `rfcs/0001-source-partition-cluster-authority.md` - durable R2D scientific decision;
- `roadmap/P1_UV_VISIBLE_PRODUCT_CONVERGENCE.md` - visible product convergence specification;
- `roadmap/P1_UV0_BASELINE_INVENTORY.md` - executable visible baseline/inventory;
- `roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md` - Quest validation operations specification;
- `roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md` - active product-transition tranche specification;
- `STREAM_C_SECURITY_ASSURANCE.md` - legacy-named security assurance finding set, now consumed by bounded P1-PT assurance tranches;
- `STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md` - implementation-quality policy from the prior wave, still useful as process guidance but not the current Stream A mission;
- issue #620 - active product-transition execution epic;
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
  -> simulator-testable XR proof where relevant
  -> governed physical target-platform proof where required
  -> production wiring and security/privacy assurance
  -> minimal private preview
```

A/B/C and the legacy D labels remain useful programme/evidence boundaries, but P1-PT is now the active sequential execution frame. Quest supplies valuable reference evidence for standalone XR; it is not permission to weaken the product thesis, and it is not a blocker for unrelated product-transition work. No programme label permits weakening scientific, UX, security or evidence gates.
