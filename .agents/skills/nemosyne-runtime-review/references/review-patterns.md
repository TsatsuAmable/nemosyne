# Boundary-specific falsifiers

Paths below are search anchors, not permanent ownership declarations. Follow renames and actual callers before drawing conclusions.

## Worker residency and mutation

Start with `src/atlas/ports/WorkerAnalyticalPort.ts`, `analytical.worker.ts`, and `src/atlas/AtlasCore.ts`.

Compare the main-thread residency set against the Worker handle map after registration, mutation, supersession, recycling, and rejected result adoption. Determine when input handles are destroyed relative to outstanding queries.

Falsifier: register A; queue a mutation A→B and a query for A; deliver results in permitted orders. Observe actual Worker ownership, promise settlement, current authoritative state, and failure callbacks. Repeat when the main thread rejects B and must resume A.

A transport-only probe reporting A and B resident proves bookkeeping behaviour only. Establish that the Worker actually evicts A and that production callers can enter the relevant sequence before claiming a user-visible failure.

Fix choices include explicit residency deltas, request-scoped handle leases, or serialised mutations with explicit invalidation. Clearing a set alone does not protect work already queued. Avoid unlimited handle retention as a workaround.

## Retained semantic authority

Start with `src/wasm/runtime/SemanticEmbodimentBridge.ts`, `DatasetHandleBridge.ts`, runtime initialisation/invalidation, and Worker teardown.

Inventory each map's key, value, insertion, removal, and owner. A bounded rendered scene does not bound metadata retained elsewhere. Distinguish entries needed for active drill-down from abandoned decision metadata.

Falsifier: repeatedly load, embody, query detail, replace, and destroy datasets. Track retained entries and bytes; verify cleanup after success, refusal, cancellation, and runtime replacement. Try numeric handle reuse across runtimes with explicit identities.

Demonstrate downstream validation bypass before calling stale retention an authority-corruption bug. Otherwise report the established lifecycle leak separately. Prefer deterministic ownership assertions to noisy heap snapshots; use heap measurements to quantify impact.

## Two-call WASM exports

Start with `invokeEmbodimentBuilder` and the corresponding Rust exports under `wasm/src/moneta/`.

For size-probe → allocate → read APIs, determine whether each call re-parses requests, scans columns, sorts values, constructs envelopes, fingerprints, or serialises. Also inspect retry paths and detail queries.

The two-call ABI alone is not a defect: an implementation may reuse a prepared result or obtain its size cheaply. Establish repeated computation in the current implementation.

Falsifier: instrument analytical build counts and allocation volume for one real request. Compare output/provenance with a compute-once implementation. Benchmark across representative shapes using repository scripts; separate cold/warm and kernel/materialisation timings.

Possible fixes: owned result handles or bounded prepared-result storage. Specify disposal on every exit, identity binding, capacity limits, and memory-growth/view lifetime. Do not introduce an unbounded cache to remove recomputation. No whole-application speedup follows automatically from eliminating one duplicate build.

## Dataset-copy amplification

Start with `LoadDatasetUseCase`, `AtlasCore` setters, `AnalyticalState`, `Dataset.clone`, and registration payload construction.

Count clones, row sanitisation passes, JSON materialisations, kernel loads, fingerprints, and transfer copies for one production action. Distinguish total allocations from simultaneously live retained memory. Identify intermediate state immediately replaced by a later setter.

Falsifier: exercise the actual load entry point with counters, then measure first-use latency, peak heap, and main-thread long tasks on representative datasets. Check baseline/current isolation, undo/redo, graph edges, nulls, identity, replay, and failure atomicity.

Prefer an atomic ownership-aware load and resident typed data paths where supported. Do not mechanically transfer buffers still needed for recovery or claim operation parity between row-backed and typed paths without evidence.

## Replay success assertions

Start with portable export/import journey tests and the real restoration/verification entry point.

Inspect positive assertions for success-or-failure alternations and assertions that only prove eventual completion. A matching status message alone may not prove restored meaning.

Falsifier: make valid package restoration fail and verify the positive test fails. Separately reject a tampered package while preserving pre-import state. Assert semantic digest/identity and relevant restored investigation content.

Keep positive success, negative rejection, and failed-import atomicity as distinct obligations. Run the real browser path for shipped round-trip claims.
