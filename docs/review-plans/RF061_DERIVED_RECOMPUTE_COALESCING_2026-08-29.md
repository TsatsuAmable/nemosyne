# RF-061 — Version-coalesced derived recomputation

**Status:** PRE-IMPLEMENTATION ADVERSARIAL CONTRACT / ACTIVE

## Trigger

Post-RF-060 Q3D evidence reduced the 32k compact-sort controller envelope from ~3.238 s to ~2.196 s, but still measured synchronous post-operation structure discovery/recommendation at roughly 313 ms. Source review found a stronger defect than a slow callback:

1. `World` invokes `tdaRecompute()` after an operation;
2. the async TDA summary independently starts persistence, Mapper and Betti-0 Worker requests;
3. `World._discoverStructuresAndRecommend()` then recomputes Mapper/Persistence through the synchronous Atlas path for non-cluster operations;
4. cluster-family mutations rerun clustering to recover structure assignments even though the authoritative mutation output already contains `_cluster` assignments;
5. rapidly superseded dataset versions can therefore launch redundant derived work before stale-result guards discard the outputs.

The implementation must remove duplicate analytical work rather than merely hide it behind a timer.

## Invariant

For one governed dataset version, automatic post-mutation derived analysis may execute at most one coalesced recomputation generation. Derived work must consume authoritative Rust/WASM operation/TDA results, must never recompute an already-produced analytical result in TypeScript, and may publish structures/recommendations/UI state only if the dataset version and fingerprint are still current.

The committed mutation and its immediate visual/state acknowledgement must not synchronously wait for automatic derived discovery/recommendation.

## Authority / production path

```text
DataOperationController.applyAsync
  -> AtlasCore.applyAnalysisAsync
  -> authoritative dataset commit
  -> OPERATION_APPLIED
  -> immediate presentation/log/history/autosave acknowledgement
  -> version-coalesced derived scheduler (next task)
       -> one Worker residency fence
       -> authoritative TDA bundle OR authoritative cluster assignments already in output
       -> record StructureSet(s) without analytical recomputation
       -> generate recommendation
       -> publish handles/panel dirtiness only if source version/fingerprint remains current
```

Rust/WASM remains the sole analytical authority. TypeScript owns scheduling, stale-result fencing, presentation and mapping already-authoritative results into durable structure entities.

## Primary failure modes

- moving the same expensive synchronous recomputation behind `setTimeout` and merely shifting the frame hitch;
- TDA summary and structure discovery issuing duplicate persistence/Mapper kernels;
- three concurrent TDA calls each racing Worker registration for the same dataset;
- cluster structure discovery rerunning clustering instead of consuming `_cluster` from the authoritative mutation output;
- a stale derived result publishing after a newer dataset version commits;
- coalescing accidentally dropping the newest requested version;
- recommendation/structure handles being generated from a different dataset identity than the structures they describe;
- reset/history/dataset replacement retaining a scheduled stale generation;
- making automatic background work durable as if investigator-requested evidence when it was never current.

## Falsifying evidence required

1. scheduler tests: multiple schedules for one version coalesce; a newer version supersedes an older pending/running request; `whenIdle()` resolves only after the newest accepted generation settles; disposal suppresses publication;
2. Atlas tests: a TDA bundle performs one Worker registration fence before the three authoritative TDA operations; stale identity returns no bundle;
3. structure tests: precomputed Mapper/Persistence results record structures without rerunning the analytical kernels; cluster structures consume authoritative `_cluster` assignments without another cluster call;
4. production-path Q3E: identical deterministic 1k/8k/32k compact `sort` path, with authoritative source/output fingerprints and exactly one dataset-version increment, must show the controller no longer contains derived discovery/recommendation while derived work still settles successfully afterward;
5. Q3E must record eventual derived settlement, source dataset version/fingerprint, number of Worker registrations and stale/coalesced counts so latency cannot be improved merely by dropping the work.

## Decision rule

Promote RF-061 only if correctness evidence and Q3E agree that automatic derived work is preserved, version-correct and materially removed from the blocking mutation envelope. If derived work still creates a later > frame-budget main-thread cliff, that stage becomes the next bounded finding rather than being hidden by the controller metric.

## Non-goals

This tranche does not redesign TDA mathematics, representation-ranking semantics, Worker transport protocol, row-view materialisation, physical Quest qualification, or explicit investigator-triggered recomputation. It does not claim generic large-N support.
