# P1-UV C4 Visible Product Journeys — Pre-Implementation Adversarial Review

**Date:** 2026-09-01  
**Base:** `main@a7b706a8d9b6cbd8519fc34d89aa4a49dce8afe4` (#615 C3 merged)  
**Risk:** HIGH  
**Status:** IMPLEMENTATION ACTIVE

## Purpose

C4 is the convergence proof for the visible investigator product. It must demonstrate complete, meaningful journeys through production controls and governed simulator seams, not accumulate screenshots of disconnected components.

The canonical journeys are:

1. **First insight:** launch → orient → load/select dataset → understand representation → inspect meaningful structure → record observation.
2. **Skeptical investigation:** inspect → challenge → inspect counterevidence/constraints → compare a representation alternative → preview/accept/reject/revert as applicable → record conclusion.
3. **Memory Palace reasoning:** observation → question/hypothesis → test → support/refute/inconclusive → inspect evidence/counterevidence → branch.
4. **Archive/replay/recovery:** freeze/save → continue → return/compare → export `.nemosyne` → replay verified package → reject tampered package without mutating source investigation.

C4 may reach `IMPLEMENTATION LANDED / REVIEW ACTIVE` with production-browser and governed IWER evidence. It cannot claim final physical Quest/controller/direct-touch qualification; that remains P1-U9 / Stream D.

## Baseline audit findings

### C4-PRE-01 — C3 semantic parity is real but visual hierarchy remains unconverged

The retained C3 screenshots show the new selected-object rail is compact and legible, while the central world still contains multiple bright panels/objects competing with the dataset and TechnoCore. C4 owns the whole-product salience/hierarchy judgement rather than laundering C3 semantic success into a visual-convergence claim.

### C4-PRE-02 — Journey D has a real product path

`tests/smoke/analyst-journey.spec.ts` already drives the desktop shell through dataset change, representation refusal, analysis, observation, `.nemosyne` export, verified replay and tampered replay with source investigation unchanged. C1 also proved the real archive/freeze writer through the product owner. C4 should compose and strengthen these paths rather than replace them with helper calls.

### C4-PRE-03 — Journey B foundations exist but must be proved as one walkable path

`RecommendationPanel` exposes Guidance, Alternatives, Constraints and Remediation. `World` now has fenced remediation preview → exact commit → cancel semantics and restore-authoritative-representation support. C4 must prove these are discoverable from ordinary investigator actions and that preview state is visibly distinct from committed state. A data-group `Compare` action alone is not evidence of representation comparison.

### C4-PRE-04 — Journey C is materially incomplete in the normal product path

The durable `DiscoveryEpisode` domain already preserves notice → question/hypothesis → analytical tests → SUPPORTS/REFUTES/INCONCLUSIVE → conclusion with provenance, and `.nemosyne` persistence includes discovery episodes. However:

- `ResearchContext` researchQuestion/hypothesis values are immutable construction-time metadata, not an investigator authoring surface;
- `MemoryPalaceWorldView` is intentionally read-only and currently projects static research context, InvestigationGraph nodes/edges, observations and findings;
- `InvestigationGraph` can represent explicit branch edges and typed question/test/finding/conclusion nodes but has no normal investigator-facing authoring path for the complete reasoning lifecycle;
- the dormant `MemoryPalaceController` can manufacture epistemic objects but remains explicitly unsafe/offline and MUST NOT be activated merely to make C4 evidence pass.

C4 therefore needs a small governed reasoning-authoring seam that records explicit human claims into existing investigation/discovery authority and lets the Memory Palace project those durable records. The UI may collect researcher text and explicit validation choices; it may not infer support/refutation or analytical truth.

## Authority map

| Concern | Authority | C4 may do | C4 must not do |
| --- | --- | --- | --- |
| dataset/statistics/topology | Rust/WASM + Atlas | invoke existing analysis intents, present results | calculate substitute analytical facts in UI |
| representation decision/alternatives | Moneta/Atlas representation state | display, preview fenced remediation, commit/cancel existing action | invent alternative scores/constraints |
| observation/finding evidence | Atlas evidence ledger | record explicit human observation/conclusion through existing owners | promote visual salience to evidence |
| discovery lifecycle | `DiscoveryEpisodeStore` validated `DiscoveryEpisode` | collect explicit researcher notice/question/hypothesis/conclusion; cite existing evidence IDs; record exact test outcome selected from authoritative analysis evidence | auto-label support/refute from geometry, rank, color or mere co-occurrence |
| Memory Palace | presentation projection over explicit Atlas/Investigation/Discovery records | visualize durable objects/explicit relations | activate dormant unsafe authoring controller or create hidden parallel state |
| branch lineage | `InvestigationGraph` explicit `branches_from` | add a bounded explicit investigator branch node/edge through one governed action | infer branch origin or fork analytical state silently |
| archive/replay | Vault archive store + `.nemosyne` session/replay authority | invoke real freeze/export/replay and compare state | fabricate archive/replay success |
| XR mechanics | production InputRouter + governed IWER simulator | exercise simulator-testable semantic input/cancel/reference-frame behavior | claim physical Quest optics, comfort, haptics or tracking quality |

## Falsifiers

C4 fails if any of the following is true:

1. A journey is marked complete because a component exists while the normal investigator path cannot reach it.
2. Browser diagnostics directly insert InvestigationGraph/DiscoveryEpisode state instead of driving a production action.
3. Support/refute/inconclusive is inferred from visual appearance, heuristic rank, Moneta choice, proximity or co-occurrence rather than an explicit validated record.
4. The dormant `MemoryPalaceController` is activated or wired into production to manufacture reasoning objects.
5. Representation preview mutates the committed decision/requirements/ledger before explicit commit, or cancel leaves preview state behind.
6. Representation comparison is represented by a data-group compare operation with no representation alternative/constraint context.
7. A stale selection, stale preview or stale branch target remains actionable after dataset/representation replacement.
8. Archive/replay evidence invokes storage/replay helpers directly while bypassing the visible product control path.
9. Tampered replay mutates the source investigation or reports success.
10. C4 evidence claims physical Quest/controller/direct-touch fitness from Chromium, jsdom, Three mocks or IWER.
11. The Memory Palace draws support/refute/branch relationships that are not explicit in the authoritative source record.
12. Persistent UI grows into another telemetry/dashboard wall or the forward data cone becomes chrome-dominated.
13. C4 creates a new broad `World` dependency from a feature/evidence module instead of using narrow structural ports.
14. New investigator controls use subsystem vocabulary (`Atlas`, `Moneta`, `TDA`, `Ops`) as the primary novice task language.
15. Reduced-motion/accessibility meaning depends on animation alone.

## Required evidence

### Production browser

Retain exact-head production-build evidence with source/checkout SHA, production-bundle hash and WASM hash. Drive the four canonical journeys through real visible controls wherever production controls exist. Diagnostics-gated seams may only select hard-to-raycast rendered objects or read/assert state; they may not manufacture journey state.

Required assertions include:

- current dataset and representation context are visible;
- selected-object task vocabulary is reachable and dispatches product owners;
- observation/conclusion/discovery counts change only after explicit actions;
- constraints/alternatives and PREVIEW vs COMMITTED representation state are visible;
- Memory Palace contains durable explicit reasoning objects/relationships created through the product authoring path;
- branch origin is explicit;
- archive count changes after real freeze, restore returns to the frozen state, export/replay is verified, tamper fails closed;
- surface budget and selected screenshots are retained for independent visual review.

### IWER / desktop simulator

Use the existing dev/test-only IWER substrate through the real WebXR/InputRouter path for simulator-testable parts of the same task language: selection, contextual task activation, cancel/retreat, pointer/controller modality handoff and reference-frame state where applicable. Emit bounded `XREvaluationEpisode` evidence with `environment.mode='desktop-simulator'` and no physical-device claim.

### Independent visual review

Review retained screenshots for discoverability, purpose, information hierarchy, data salience, panel/object collisions, selected/focused legibility, preview/commit differentiation, and whether every persistent object earns its spatial cost. Visual review can carry defects forward; green state assertions do not overrule obvious hierarchy failures.

## Implementation constraints

- Prefer new small domain/application services over changes that enlarge `World.ts`.
- C4 reasoning authoring must use `DiscoveryEpisode` and `InvestigationGraph` as durable authorities, not a second store.
- IDs used for human-authored reasoning must be unique and replay-stable once written; randomness may generate identity but must never encode scientific meaning.
- All test outcomes must cite existing evidence IDs. If no evidence is available, the UI must refuse terminal SUPPORTED/REFUTED/INCONCLUSIVE capture rather than invent evidence.
- A human conclusion remains explicitly human judgement; it must not be presented as an analytical result.
- Product and evidence hooks must dispose subscriptions/listeners.
- No new npm dependency is justified for this tranche.

## Initial implementation order

1. Add a governed discovery/reasoning application service with strict validation and graph projection of explicit human reasoning.
2. Add a compact investigator-facing reasoning surface in the existing desktop shell and a matching contextual/`More` path for immersive semantics without a second behavior tree.
3. Extend the read-only Memory Palace projection to validated discovery episodes and explicit relationships.
4. Prove Journey C in focused tests before adding broader evidence.
5. Compose Journey A/B/D production-browser paths, fixing any real discoverability/preview/archive defects they expose.
6. Add the IWER simulator portion only for mechanics the simulator can truthfully exercise.
7. Perform post-implementation visual/adversarial review, then exact-head promotion.

## Exit condition

C4 is eligible for bounded closure only when all four canonical journeys are visibly walkable at the evidence tier appropriate to each step, no journey depends on fabricated diagnostics state, C4-specific production-browser/IWER evidence is retained and independently reviewed, and every physical-device dependency is explicitly deferred rather than implied.