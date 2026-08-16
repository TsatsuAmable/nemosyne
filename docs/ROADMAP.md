## Current Status

> **Single source of truth for active product and engineering work.** This file intentionally
> excludes completed and deprecated phase detail. Historical context is in
> [`docs/archive/ROADMAP_HISTORY.md`](archive/ROADMAP_HISTORY.md). Product architecture and
> release governance are in [`PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md`](PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md).

- **Last updated:** 2026-08-16 after reducing the roadmap to active work and archiving historical phases.
- **Repository state:** local `main` contains the Phase 22.3 salvage/gate restoration and the
  Atlas governance documentation changes. Working-tree changes are documented in the current
  session, not represented as committed release state.
- **Last gate result:** `typecheck` clean -> `lint` 0 errors (205 warnings) -> previous Vitest
  `1315 passed / 9 skipped` across 190 files -> build green -> Rust `32 passed / 0 failed`.
- **Current work:** Phase 22.3.1 hardening and accessibility tracks; Phase 21.3 remains at
  infrastructure/readiness and is blocked from command-buffer rollout until the B2 load-test
  staircase produces `logs/loadtest-results.jsonl`.
- **Next:** Enforce inbound shared-state authorization, bound remote annotation payloads,
  complete Compare visual/history behavior, recolor existing artefacts across accessibility
  modes, dispose dashboard chart resources, unify controller/pinch system-toggle gating, then
  complete focused Quest validation and Tier C accessibility.
- **Atlas boundary:** Current Draco is the v1 embodiment pipeline (`Dataset` facts -> visual
  spec -> VR artefact). DatasetSpace, provenance-bearing structures, analytical recommendations,
  and reproducible research sessions are not implemented. Atlas work is governed by the product
  architecture document and must not be inferred from existing Dataset, TDA, session, telemetry,
  or benchmark utilities.
- **Resume pointers:** validation -> `docs/PHASE_22_3_VALIDATION_REPORT.md`; UX trace ->
  `scripts/analyze-ux-trace.mjs` and `src/vr/trace/UXTraceRecorder.ts`; audit ->
  `docs/AUDIT_PHASES_1_20.md`; product governance ->
  `docs/PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md`; method governance ->
  `docs/STATISTICAL_METHOD_REGISTER.md`; study package -> `docs/study/README.md`.

## Active Work

### Phase 21.3 - Rust/WASM readiness and measured scene migration

**Status:** In progress, command-buffer rollout blocked on load-test evidence.

- Run the B2 Quest load-test staircase and capture transition metrics in
  `logs/loadtest-results.jsonl`.
- Decide whether command buffers address a measured bottleneck. Do not enable
  `COMMAND_BUFFER` before `SCENE_RUST` or without evidence.
- Reconcile the provisional ABI, capability flags, memory-growth handling, and JS/Rust parity
  before production rollout.
- Keep TypeScript session state, provenance, permissions, and renderer integration outside Rust.
- Treat layout migration as incremental and independently testable; do not make Atlas dependent
  on scene-graph migration.

**Exit evidence:** load-test report, capability decision, ABI decision, and fresh Rust/JS
conformance results.

### Phase 22.3.1 - Adversarial hardening and last-mile closure

**Status:** Planned next implementation slice.

- Enforce authorization on inbound shared-state deltas and bind claimed senders to RTC peers.
- Validate annotation, bookmark, tour, and dataset delta schemas with payload size, count, and
  rate bounds.
- Complete Compare rendering, history restore, chart remapping, and edge-case coverage.
- Recolor existing Draco artefacts when colorblind mode changes and verify chart palettes.
- Dispose dashboard chart textures, materials, geometry, and canvas resources on rebuild/teardown.
- Unify dwell, cooldown, panel-targeting, release, and re-arming semantics for pinch and
  controller system toggles.
- Add adversarial regression tests for all of the above.

**Exit evidence:** targeted tests plus focused Quest/manual evidence for security, comparison,
accessibility, and lifecycle behaviour.

### Phase 22.4 - Spatial ergonomics and rendering truth

**Status:** Deferred until 22.3.1 and hardware evidence.

- Implement the central-focus, peripheral, and wrist-HUD zonation model.
- Complete reduced-motion, tracking-loss, context-loss, and declutter paths.
- Reconcile the documented four-tier instancing model with the actual two-tier implementation.
  Default to correcting documentation unless load-test evidence requires a new renderer tier.
- Keep foveation and gaze-weighted LOD evidence-gated.

### Phase 22.5 - Observer and collaboration qualification

**Status:** Deferred; only the Stable Alpha observer subset is in scope.

- Add explicit participant/observer roles and authorization before enabling observational use.
- Wire observer view, timestamped notes, permitted prompts, and event correlation for study trials.
- Defer shared analytical editing, voice, avatars, and general collaboration until a product
  decision promotes them.

### Phase 22.6 - Data, Draco, and architecture correctness

**Status:** Planned Atlas prerequisite slice.

- Fix pairwise-complete correlation with missing values and add regression coverage.
- Make statistical facts confidence-bearing rather than binary heuristics.
- Introduce stable `datumId` values and remove renderer dependence on row object identity.
- Document mutable live-source versus immutable derived-dataset semantics.
- Reduce `World` to a composition root and formalize dependency direction.
- Remove Three.js imports from `src/data/` and resolve known capability/type/version drift.
- Correct or remove built-but-unwired components only after confirming intended scope.

**Exit evidence:** architecture tests, data-operation immutability tests, stable-ID fixtures,
and updated engineering documentation.

### Atlas migration

**Status:** Proposed; not a Stable Alpha blocker except for boundary and provenance decisions.

1. **Atlas 0:** freeze Draco v1 visual-rule expansion and document its embodiment contract.
2. **Atlas 1:** add content-sensitive dataset identity, stable datum IDs, and renderer-independent
   DatasetSpace.
3. **Atlas 2:** convert one named analytical provider into reproducible structures with method
   registration, diagnostics, and provenance.
4. **Atlas 3:** add deterministic, inspectable, rejectable, and overrideable Atlas guidance.
5. **Atlas 4:** map analytical targets to semantic Draco embodiment commands.
6. **Atlas 5:** persist analysis records, research context, recommendation decisions, observations,
   and replay bundles.
7. **Atlas 6:** bind the controlled study harness to the same analytical substrate and 2D
   precision handoff.

**First Atlas exit criterion:** one reference dataset can be computed, embodied, inspected,
saved, and replayed without WebXR or network access, with JS/Rust outputs within declared
tolerances.

## Stable Alpha Release Gates

Stable Alpha is the smallest reliable research instrument for the defined 2D-versus-VR study.
It does not claim Atlas maturity or prove the research hypothesis.

1. **Runtime and analytical integrity:** no known P0/P1 crash, corruption, lifecycle, or resource
   defect in supported workflows.
2. **Security and role integrity:** participant/observer identity, authorization, and payload
   validation are enforced.
3. **One analyst journey:** the defined task supports Explore, Inspect, Compare, Annotate,
   precision handoff, accessibility, recovery, and save/resume.
4. **Observation and trial recording:** participant actions, observations, interventions,
   outcomes, deviations, and roles are correlated without observer state mutation.
5. **Canonical 2D control and study harness:** both conditions share task/data semantics and the
   study package defines counterbalancing, outcomes, exclusions, and data governance.
6. **Quest qualification:** hardware-specific frame, transition, resource, comfort, tracking,
   and accessibility evidence exists.
7. **Full rehearsal and freeze:** the frozen experiment package runs end to end and the release
   evidence matrix is complete.

## Deferred Work

The following is not active roadmap work unless explicitly promoted:

- Direct SQL, warehouse, Excel, or Parquet connectors.
- General-purpose collaboration, voice, avatars, and multi-analyst editing.
- LLM or learned analytical guidance.
- Advanced TDA, broad topology support, or a generalized statistical catalogue.
- Command-buffer/scene-ECS migration without measured performance need.
- Claims of user benefit, recall improvement, or VR superiority before valid study evidence.

## Documentation Rules

- Completed work belongs in [`docs/archive/ROADMAP_HISTORY.md`](archive/ROADMAP_HISTORY.md), not
  in this file.
- Implementation status belongs here; architecture direction belongs in the product governance
  document; study methods belong in `docs/study/`.
- Every new roadmap item must have an owner, status, exit evidence, and a release-track rationale.
- When a planned item is completed or permanently rejected, move its historical detail to the
  archive and leave only a short decision reference here.

## Legend

- `Current work` = actively being implemented or validated.
- `Planned` = approved next work with a defined exit condition.
- `Deferred` = intentionally not active; promotion requires a decision.
- `Proposed` = architecture direction without implementation commitment.
