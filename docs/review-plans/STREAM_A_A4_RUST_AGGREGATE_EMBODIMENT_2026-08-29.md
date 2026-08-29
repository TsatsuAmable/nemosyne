# Stream A A4 — Rust-owned aggregate embodiment

**Date:** 2026-08-29  
**Stream:** A — Analytical Scale & Representation Authority  
**Checkpoint:** A4 — first production semantic vertical slice  
**Base:** `main@a1f5e73a26005f01ba826b36469cd1b988b82b4b`  
**Status:** IMPLEMENTATION LANDED ON BRANCH / REVIEW ACTIVE

## Purpose

A4 must prove one complete non-observation representation path where the dataset is reduced by the Rust/WASM analytical authority into a bounded semantic payload and Three.js embodies that payload without traversing source rows.

This checkpoint is intentionally limited to `AGGREGATE_VOLUME`. It does not claim that density, distribution, cluster, manifold, multiscale, temporal, graph or hierarchy embodiment has converged.

## Governing invariant

> Three.js must not receive or traverse raw dataset rows to construct `AGGREGATE_VOLUME`. Rust/WASM computes the grouped aggregate from the canonical resident dataset handle, returns a bounded `SemanticEmbodimentEnvelopeV1`, and TypeScript/Three.js performs presentation mapping only.

Observation-level representations may still consume observations. Other non-observation representations remain governed by their current A2 classifications until migrated independently.

## Pre-implementation adversarial contract

### Authority changed

The new authority path is:

`Moneta RepresentationDecision(AGGREGATE_VOLUME)`
→ `LoadDatasetUseCase`
→ `SemanticEmbodimentLoader`
→ asynchronous analytical port
→ resident Worker dataset handle
→ `moneta_build_aggregate_embodiment_v1`
→ Rust columnar aggregate builder
→ `SemanticEmbodimentEnvelopeV1`
→ `VRTopologyTranslator`
→ thin `ScalableTopologyEmbodiment.buildAggregateBars()` adapter.

Rust owns grouping, missingness policy, aggregate function, numeric reduction, group cardinality and resource refusal. JavaScript owns orchestration, stale-result fencing, visual positions, colours, geometry height mapping and interactions.

### Primary failure modes

1. **Decorative authority:** the Rust builder exists but normal production decisions never request it.
2. **Duplicate analytical authority:** TypeScript continues grouping rows, recomputing means/counts, or repairing a Rust payload.
3. **Row leakage:** aggregate synthesis obtains `dataset.rows`/`dataInput.rows`, or sends rows in the semantic execution request.
4. **Stale resurrection:** an old Worker result replaces a newer dataset/version/decision.
5. **Semantic drift:** bootstrap Moneta chooses aggregate geometry while learned Moneta collapses the same candidate back to layout-derived point geometry.
6. **Missingness/zero corruption:** zero is treated as missing, missing measures silently become zero, or missing grouping values disappear.
7. **Unbounded output:** high-cardinality grouping produces O(N) Three.js elements or silently truncates groups.
8. **False availability:** the renderer fabricates row-derived bars while the Rust payload is pending, refused or unavailable.
9. **Evidence laundering:** a family-map reachability assertion is treated as proof of a real group/population production decision.
10. **Scope creep:** A4 becomes a generic semantic mega-renderer or broad ABI migration.

### Falsifying evidence required

A4 must fail if any of the following regresses:

- real WASM cannot build the envelope from an existing dataset handle;
- aggregate semantic execution sends `datasetPayload` or row-shaped parameters when the Worker handle is resident;
- `AGGREGATE_BARS` touches a throwing raw-row sentinel;
- TypeScript aggregate renderer contains row grouping or aggregate arithmetic;
- a stale generation/version/fingerprint result is accepted;
- learned Moneta maps `AGGREGATE_VOLUME` away from aggregate geometry;
- zero/missingness behavior differs from the declared analytical method;
- more than 4,096 groups are truncated or rendered instead of refused;
- invalid grouping/measure parameters fabricate a READY payload;
- a pending/refused payload falls back to row-derived bars.

### Production reachability boundary

Fresh dataset load currently uses `individual-inspection` requirements. That correctly forbids an identity-losing aggregate representation. A4 must **not** weaken that rule or force aggregate at startup.

Production reachability therefore means: when an existing group/population-level analytical requirement makes `AGGREGATE_VOLUME` a valid Moneta winner, the normal `LoadDatasetUseCase → RepresentationSurface` path requests and embodies the Rust semantic payload. Family-map reachability alone is insufficient evidence.

## Implementation on branch

- Added Rust `aggregate_embodiment` builder over the canonical `ColumnarDataset` handle.
- Added explicit categorical grouping and `COUNT | SUM | MEAN | MIN | MAX` contract.
- Added missing grouping policy `group-as-null`.
- Added missing measure policy `exclude-from-measure-retain-group-count`.
- Preserves finite zero values.
- Added hard V1 group bound of 4,096 with explicit `RESOURCE_LIMIT` refusal.
- Added WASM ABI call `moneta_build_aggregate_embodiment_v1`.
- Added a dedicated TypeScript semantic bridge without a second semantic validator.
- Added `semanticEmbodiment` Worker operation against the Worker-local resident handle.
- Added generation/version/fingerprint fencing around async semantic results.
- Added `AGGREGATE` Moneta family and candidate-aware learned-runtime geometry.
- `VRTopologyTranslator` now resolves rows lazily; aggregate geometry receives only the semantic envelope.
- `buildAggregateBars()` no longer groups rows or computes aggregates.
- Pending/refused aggregate payloads render no fabricated row-derived aggregate.
- Aggregate meshes are tagged as aggregate groups rather than observations.
- A2 raw-row gate promotes only `AGGREGATE_VOLUME` to `DATASET_LEVEL_VALID`; other A2 findings remain explicit.

## Post-implementation adversarial review

**High-risk change.** This checkpoint changes a scientific/data-reduction authority boundary and the production representation path.

1. **Production authority or decorative?** REVIEW ACTIVE. The Worker/WASM/renderer chain is production-wired. Final review must still prove a group/population Moneta decision can exercise it without weakening individual-inspection semantics.
2. **Second authority?** No aggregate grouping/reduction remains in the A4 renderer. TypeScript selects declared fields/function, carries the request and maps bounded output to visuals.
3. **Replacement god class?** No. The builder, transport loader, bridge and renderer adapter are narrow. The V1 contract remains discriminated rather than becoming a bag of optional representations.
4. **Production-path regression?** Pending/refused aggregate does not fall back to rows. Non-aggregate paths retain their previous behavior and A2 classifications.
5. **Failures/refusals explicit?** Rust returns explicit semantic refusals for invalid parameters/resource limits. Transport absence/staleness resolves to unavailable rather than fabricated results.
6. **Resource/lifecycle clear?** Worker execution reuses resident handles, ABI buffers use the existing allocation lifecycle, semantic promises are invalidated on node replacement, and payload output is bounded by group count.
7. **Outside Stream A boundary?** No `World.ts`, `bootstrap.ts`, Quest-validation, signalling, collaboration or canonical roadmap changes are part of A4.
8. **Claim <= evidence?** A4 may claim one Rust-owned aggregate vertical slice only. It cannot close RF-001/RF-002 globally, PERF-04, Quest qualification, P1-U9, P1-W, or any remaining A2 semantic overclaim.

## Residual work before disposition

- Run exact-head Rust, wasm32, TypeScript, Vitest, browser smoke, architecture and CodeQL gates.
- Prove the real production group/population decision path can select `AGGREGATE_VOLUME` without modifying the fresh-load individual-inspection policy.
- Record deterministic source-row versus semantic-output element/serialized-size evidence for the aggregate path.
- Re-read the exact PR diff for accidental row access, duplicate computation, broad abstraction growth and stale async resurrection.

## Exit disposition

Pending exact-head evidence. If all required falsifiers pass, A4 is the final checkpoint of the current Stream A programme and Stream A must STOP rather than automatically implementing further semantic builders.
