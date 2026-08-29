# RF-061 — Version-coalesced derived recomputation

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE / Q3E FIX-FORWARD

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

A kernel resource refusal is a governed terminal outcome, not a successful analytical result and not a generic pipeline failure. At an unsupported scale the pipeline must preserve the typed `UnsupportedAtScaleError`/durable refusal evidence, publish no fabricated structure result, and report the generation as `refused`. Any unclassified execution exception remains `failed` and fails Q3E.

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
       -> completed: record StructureSet(s) without analytical recomputation
          OR refused: preserve authoritative resource-refusal evidence and publish no structures
       -> generate recommendation only from current authoritative evidence
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
- making automatic background work durable as if investigator-requested evidence when it was never current;
- preserving TDA values while dropping or mis-pairing their authoritative kernel provenance;
- treating a governed `UNSUPPORTED_AT_SCALE` refusal as a generic failure, or allowing a genuine generic failure to satisfy the measurement gate.

## Falsifying evidence required

1. scheduler tests: multiple schedules for one version coalesce; a newer version supersedes an older pending/running request; `whenIdle()` resolves only after the newest accepted generation settles; disposal suppresses publication; a caller-classified governed refusal increments `refused` rather than `failed`;
2. Atlas tests: a TDA bundle performs one Worker registration fence before the three authoritative TDA operations; stale identity returns no bundle and each value remains paired with its own response provenance;
3. structure tests: precomputed Mapper/Persistence results record structures without rerunning the analytical kernels; cluster structures consume authoritative `_cluster` assignments without another cluster call;
4. production-path Q3E: identical deterministic 1k/8k/32k compact `sort` path, with authoritative source/output fingerprints and exactly one dataset-version increment, must show the controller no longer contains derived discovery/recommendation while exactly one derived generation settles afterward;
5. deterministic Q3E settlement must have `failed = 0` and stale settlement `= 0`; the one requested generation must either `completed = 1` with authoritative structures published or `refused = 1` through the typed Rust/WASM resource-envelope path with no fabricated structures;
6. Q3E must record eventual derived settlement, source dataset version/fingerprint, number of Worker registrations and stale/coalesced/refused/failed counts so latency cannot be improved merely by dropping work or relabelling failure.

## Live implementation checkpoint

The production `WorldTopics.OPERATION_APPLIED` subscriber now schedules the derived pipeline instead of synchronously calling both TDA recomputation and `_discoverStructuresAndRecommend`. History-seek keeps its previous panel-only TDA refresh semantics. `DerivedAnalysisPipeline` is disposed before renderer teardown so stale work cannot publish into a dismantled world. Atlas's async TDA API now exposes value + provenance envelopes; TDA presentation and structure mapping consume those exact response pairs rather than relying on mutable `lastProvenance` state.

The self-cleaning wiring commits used repository workflows only as a transport for bounded text surgery. Those helper scripts/workflow mutations are absent from the candidate diff. The zero-job `action_required` suites emitted for the bot-authored intermediate head are explicitly non-evidence.

## Q3E post-merge finding — 29 August 2026

The governed Q3E artifact from the green #514 candidate head `db0fc53f52adcb6c01da1a8b6a942903e8a3ad8f` falsified the original settlement assertion:

- **1k compact sort:** one derived generation requested, one completed, zero failed/stale, one Worker registration, and two durable structure records;
- **8k compact sort:** one derived generation requested, zero completed, one reported `failed`, zero stale, one Worker registration, and zero structure records;
- **32k compact sort:** the same terminal shape as 8k: zero completed, one reported `failed`, zero stale, and zero structure records;
- at 8k/32k the only derived TDA execution reached persistence and returned `resultKind = none` without entering expensive kernel work. Source tracing confirms the Worker translates Rust's kernel-inline TDA resource refusal into a typed `UnsupportedAtScaleError` and records refusal evidence at the Atlas boundary.

The Rust resource envelope is intentionally conservative. Its static work/memory guards are kernel safety limits, not Quest qualification and not a generic large-N support promise. Therefore increasing those limits merely to make Q3E complete would be an invalid fix.

**Finding:** the scheduler evidence vocabulary collapsed an authoritative resource refusal into the same `failed` counter used for programming/runtime defects, while the Q3E assertion allowed any `failed` terminal state to satisfy the one-generation settlement check. This could make an apparent latency improvement pass even when derived analysis broke for an unrelated reason.

**Fix-forward:** keep the generic scheduler domain-agnostic but let its owning pipeline classify known typed refusal outcomes; add a distinct `refused` counter; require Q3E generic `failed = 0`; require deterministic stale settlement `= 0`; accept either one authoritative completed generation or one explicit governed refusal; retain the existing one-registration/coalescing/fingerprint/version evidence.

## Decision rule

Promote RF-061 only if exact-head correctness evidence and a fresh Q3E run agree that automatic derived work is preserved, version-correct and materially removed from the blocking mutation envelope. A supported computation must complete and publish the expected authoritative evidence. An unsupported computation may terminate only through the explicit governed refusal path. Any generic failure, silent dropped work, stale deterministic settlement, duplicate generation or fabricated evidence rejects promotion.

If derived work still creates a later > frame-budget main-thread cliff, that stage becomes the next bounded finding rather than being hidden by the controller metric.

## Non-goals

This tranche does not redesign TDA mathematics, representation-ranking semantics, Worker transport protocol, row-view materialisation, physical Quest qualification, or explicit investigator-triggered recomputation. It does not claim generic large-N support and does not relax the kernel resource envelope to manufacture a successful benchmark result.
