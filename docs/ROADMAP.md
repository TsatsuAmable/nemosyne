# Nemosyne Roadmap & Implementation Status

> **Canonical implementation-status and execution authority.** Product and research direction remain governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This file is the current operational map: what is active, which programme owns it, which integration seams are exclusive, what evidence closes a checkpoint, and what must wait. Detailed programme documents remain the scientific, UX, security, or evidence specification for their own scope; their older status headers do not override this live roadmap.

## Status snapshot - 31 August 2026

**Current integration base for this planning update:** `main@1ea2920` (#606 merged). Stream A is fully closed; Stream B B1 promotion is being finalized in #607 and B2 is the next forward checkpoint after that merge.

The previous A/B/C convergence wave, Stream M distribution wave, Density Truth R2C, source-partition Cluster Regions R2D, and the current Progressive Disclosure Stream A have reached their finite implementation exits. In particular:

- A1 semantic drill-down contract/falsifiers is `VERIFIED COMPLETE` after establishing SemanticDrillDown.ts and drill_down.rs WASM validation boundary.
- A2 resident bounded semantic membership/query capability is `VERIFIED COMPLETE` through the canonical Worker/Rust authority.
- A3 semantic selection lineage, bounded observation reveal, and explicit return-to-structure are `VERIFIED COMPLETE` for the generic production path.
- A4 exact datum/provenance inspection is `VERIFIED COMPLETE` after #605, using a second bounded authority query rather than a whole-dataset UI cache.
- A5 cross-family product evidence and the independent STOP review establish the finite P1-R5 closure for Aggregate, Distribution, Density and source-partition Cluster, with #606 merged and all exact-head gates green.
- Stream B B1 source relationship-graph authority contract has landed via #598 and passed independent adversarial review. #607 closes the promotion/fix-forward tranche; B1 becomes final only after #607's unchanged exact head passes the required gates and merges. `RELATIONSHIP_GRAPH` remains unavailable as a governed production representation until B2/B3 land.
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
| **B - Source-Authoritative Structural Representations** | Add truthful graph/hierarchy/temporal/geospatial/spectral dataset structures without presentation-side inference. | B1 promotion #607; B2 next | **ACTIVE** | First selected structural family is verified complete; then STOP and explicitly select the next family. |
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

**Status:** ACTIVE — B1 PROMOTION #607; B2 NEXT AFTER MERGE  
**Primary programme:** P1-R2E in `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`  
**First selected family:** source-provided `RELATIONSHIP_GRAPH`.

## Governing rule

B represents **source-authoritative structure first**. It does not infer structure from visual proximity, color, density, correlation, k-nearest-neighbour search or a force layout unless a later separately governed analytical treatment explicitly authorizes that method.

The first slice is Relationship Graph because source-provided edges create the cleanest authority boundary and exercise a genuinely non-point dataset structure.

## B1 - Relationship Graph scientific/authority contract

**Status:** VERIFIED COMPLETE ON #607 HEAD / PROMOTION PENDING FINAL EXACT-HEAD GATES + MERGE

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
- prove deterministic ordering, source identity and resource limits across real WASM;
- enforce the 2 MiB payload ceiling at Rust/WASM authority;
- preserve strict graph-authority validation when the production graph requirements surface is wired;
- extend #607's `Dataset -> buildDatasetSignature -> arbitrate` source-binding evidence through the actual Atlas/Worker/resident Rust path.

## B3 - production cutover and thin graph adapter

- carry the governed graph payload through Worker/WASM using existing generation/fingerprint/decision fences;
- intercept the governed graph representation before row-derived or proximity-derived layout logic can create topology;
- keep presentation layout purely presentational and visibly distinguish it from edge authority;
- bind selection to stable semantic node/edge IDs;
- fail closed on pending/refused/stale/invalid payloads;
- prove pre-existing edge-drop paths are either fail-closed or unreachable for governed graph payloads.

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

C owns product shell, world objects, UI hierarchy and interaction presentation. It must not alter scientific semantics owned by Moneta/Rust. If C needs new analytical meaning, that becomes a separately governed analytical tranche rather than a UI convenience.

---

# Stream D - Assurance & Private-Preview Readiness

**Status:** QUEUED AFTER C  

D begins only after B's selected structural family and C's visible-product convergence have reached their finite exits. It owns physical qualification, attributable validation operations, live-path security/privacy residuals and preview-readiness evidence. It must not promote physical or preview claims early.

## D1 - validation manifest + launcher

- define attributable device/build/session/evidence identity;
- make validation launch reproducible;
- require evidence provenance for physical claims;
- keep simulator-only claims separate from device-qualified claims.

## D2 - security/privacy residual closure

- re-audit live production paths after C convergence;
- close transport/storage/privacy defects relevant to preview deployment;
- verify no development evidence instrumentation or debug-only surface is in production builds.

## D3 - physical qualification

- run Quest/device evidence only for claims that require hardware;
- qualify locomotion, comfort, controller/hand/direct-touch behavior, performance and spatial readability;
- keep device evidence tied to exact build/artifact identity.

## D4 - private-preview readiness

- verify production wiring and deployment prerequisites;
- establish rollback/recovery and incident-handling basics;
- prove the preview path exposes the intended product rather than development/diagnostic surfaces.

**Finite exit:** D reaches the handoff into P1-W only when validation, security/privacy and physical qualification prerequisites are genuinely evidenced.
