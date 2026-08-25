# P1-B First Pass — Asynchronous Analytical Runtime (Design & Test Plan)

**Status:** Design-first pass. Implementation delegated; this document is the binding specification.
**Governing docs:** `docs/P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md` §P1-B; Cardinal Rule 3 (no JS analytical fallback — worker failure must surface as `KernelUnavailable`, never as local compute).
**Prerequisite:** P1-A final exit (columnar TDA) — the handle contract this design fences is defined there. P1-B must not relax it.

---

## 1. What the map established (verified against `main` @ `b17f340`)

- **The injection point already exists.** `AnalyticalKernelPort` (`src/atlas/adapters/AnalyticalKernelPort.ts:19-53`) is the complete analytical method surface; `RustAnalyticalEvidenceAdapter` depends only on it (`_kernel: AnalyticalKernelPort`, hot-swappable via `setKernel`, adapter line 47); `World` injects the bridge module at `World._initWasmRuntime` (`World.ts:2186/2206`) and nulls it at `_onKernelUnavailable` (`World.ts:2161`). **Zero consumer changes** are needed if the worker sits behind this port.
- **Module workers are unblocked today.** COOP/COEP are set in dev (`vite.config.ts:26-29`) and production (`netlify.toml:20-22`); CSP already allows `worker-src 'self' blob:`; `RuntimeState.initializeRuntime`'s browser branch (`RuntimeState.ts:189-217`) works unchanged inside a `type: 'module'` worker. No build/header work is a prerequisite.
- **The fencing triple already exists**: `(kernel generation, datasetVersion, datasetFingerprint)` — generation embedded in handle high bits (`HANDLE_SEQUENCE_BITS = 20`), `_datasetVersion` in `AnalyticalState.ts:25` (exposed as `AtlasCore.datasetVersion`, already consumed as a fence by `DataOperations.ts:336-349`), and canonical fingerprint from `DatasetSpace`/`kernel.datasetFingerprint`. Proven in-repo patterns to mirror: `RuntimeState.ready()` generation checks (`RuntimeState.ts:116,135`) and `WorldLifecycleOwner.isCurrentKernelAttempt` (`WorldLifecycleOwner.ts:67-69`).
- **Everything expensive is currently synchronous on the main thread**: `AtlasCore.applyAnalysis` (serialize-in/op/serialize-out every operation, `AtlasCore.ts:357-409`), `previewOperation` (line 484), the TDA triple (659-675), `computeCluster` (928), `MonetaTopologyNode.solveWithRust` (119-155) and Rust layout computes from `VRTopologyTranslator.synthesizeArtifact`. TDA recompute fires inline after data ops (`TDAPlanes` via `WorldRendererLifecycle.attachTDASummary`, re-triggered at `World.ts:1282, 1626-1627, 1756, 2058`).
- **The constraint:** handles are WASM-instance-local — a worker owns its own kernel instance and its own handle space. Dataset identity across threads therefore travels by **fingerprint + re-registration**, not by passing handles.
- **Recovery semantics to preserve:** `invalidateRuntime` bumps `runtimeGeneration` and fails closed (`RuntimeState.ts:72-80`); `WorldLifecycleOwner` generations fence kernel attempts; `AtlasCore.setKernel(null, 0)` invalidates the durable handle (`AnalyticalState.invalidateHandle`, 153-158).

---

## 2. Design

### 2.1 `AnalyticalExecutionPort` contract

New file `src/atlas/ports/AnalyticalExecutionPort.ts` (types only):

```ts
export interface AnalyticalExecutionRequest {
  readonly requestId: string;            // monotonic per session: `areq-${sessionSeq}`
  readonly operation: AnalyticalOperationKind; // 'tda.persistence' | 'tda.mapper' | 'tda.betti0' | 'operation' | 'statistics' | 'spectralFacts' | 'cluster'
  readonly dataset: {
    readonly fingerprint: string;        // canonical identity across threads
    readonly version: number;            // AnalyticalState._datasetVersion at dispatch
  };
  readonly generation: number;           // kernel/runtime generation at dispatch
  readonly params: Record<string, unknown>;  // already JSON-shaped today
}

export interface AnalyticalExecutionResult<T> {
  readonly requestId: string;
  readonly generation: number;
  readonly datasetVersion: number;
  readonly datasetFingerprint: string;
  readonly value: T | null;              // null = kernel fail-closed, NOT fallback
  readonly provenance?: ProvenanceEnvelope;  // kernel-supplied, passthrough
}

export interface AnalyticalExecutionPort {
  execute<T>(req: AnalyticalExecutionRequest): Promise<AnalyticalExecutionResult<T>>;
  /** Supersede all in-flight requests for a dataset version/generation older than `fence`. */
  supersede(fence: { generation?: number; datasetVersion?: number }): void;
  /** True when the port is backed by a worker; false for the synchronous adapter (bootstrap/fallback transport). */
  readonly isAsync: boolean;
}
```

Supersession is cooperative: `supersede` marks request ids stale; results still arrive but are discarded at the fence (§2.3). True `postMessage` cancellation is out of scope — WASM is single-threaded and cannot be interrupted mid-compute; supersede-on-completion is the honest semantic.

### 2.2 `WorkerAnalyticalPort` — the transport

`src/atlas/ports/WorkerAnalyticalPort.ts` implementing `AnalyticalKernelPort`-shaped methods over a dedicated module worker:

- `new Worker(new URL('./analytical.worker.ts', import.meta.url), { type: 'module' })` — Vite-native, no config change; confirm the production CSP covers the emitted worker asset (it does: `worker-src 'self' blob:`).
- The worker runs `RuntimeState.initializeRuntime` (browser branch, unchanged — it dynamic-imports `/wasm/pkg/...`). Kernel state (`wasmInstance`, `runtimeGeneration`) lives **only** in the worker.
- **Dataset migration:** the port carries a `registerDataset` request kind: on first use of a fingerprint the main thread sends the dataset payload **once** keyed by fingerprint. Use the P1-A `NTC1` typed-column payload where the source was typed-columnar (preferred — avoids row rematerialisation and matches the P1-A exit), `DatasetJSON` otherwise. The worker registers it via `data_load_typed_columns` / `data_load_dataset_json` and caches `fingerprint → workerHandle`. **No second authoritative dataset store on the UI thread** — the worker's registry is the analytical authority; Atlas keeps only identity (fingerprint + version) and, where it already exists, the JS presentation `Dataset`.
- **Results:** compact JSON today (result structs are already JSON-shaped); transferable `ArrayBuffer` return for bulk outputs is a measured optimization, not a first-pass requirement (per programme: "introduce SharedArrayBuffer/SIMD only where profiling demonstrates value").
- **Synchronous transport (`InlineAnalyticalPort`):** a same-thread implementation of the same port for tests/bootstrap where `Worker` is unavailable (jsdom Node lane). It must never be selected as an analytical fallback for worker *failure* — on worker crash/error the port fails closed by propagating `KernelUnavailableError` and calling the existing `_onKernelFailure` funnel (`RustAnalyticalEvidenceAdapter._notifyFailure`, lines 333-351 → `World.markKernelUnavailable`). Selection of inline vs worker is a startup capability decision, not a runtime failure response.

### 2.3 Async seam placement and fencing

- The seam is cut at `RustAnalyticalEvidenceAdapter` (it already injects the kernel through the port and owns failure funnelling). Its `compute*ForHandle`/`runOperation` callers are synchronous today, so `AtlasCore` gains **async variants** rather than breaking existing signatures:
  - `AtlasCore.computePersistenceIntervalsAsync(params, opts?)`, `computeMapperGraphAsync`, `computeBetti0CurveAsync`, `applyAnalysisAsync(op)`, `previewAnalysisAsync(op)`.
  - Existing synchronous methods remain for replay paths (`InvestigationReplayRunner` determinism) and the compatibility surface; the async variants are what the interactive presentation paths adopt.
- **Fence check at completion (the core correctness rule).** Before a worker result is committed to the investigation (`commitKernelResult` or TDA state), verify:
  1. `result.generation ===` current `runtimeGeneration` (kernel not invalidated since dispatch),
  2. `result.datasetVersion === AtlasCore.datasetVersion` (no `loadDataset`/`advanceDataset`/`commitKernelResult` since dispatch),
  3. `result.datasetFingerprint === AtlasCore.datasetFingerprint` (identity, not just version-counter coincidence).
  Any mismatch → result discarded silently (superseded), **not** an error. This mirrors `WorldLifecycleOwner.isCurrentKernelAttempt`.
- **Commit-side trigger fencing:** every mutation that bumps `_datasetVersion` or invalidates the kernel calls `port.supersede({...})`. Wiring points: `AnalyticalState.loadDataset` (line 53), `advanceDataset` (75), `commitKernelResult` (67), `restore` (93), `invalidateHandle` (153-158); `RuntimeState.invalidateRuntime` (72-80).
- **Presentation adoption (the actual frame-budget win):**
  - `TDAPlanes.recompute()` → fire-and-forget against `compute*Async`; on resolution (if the plane group is still current — guard by the same triple) apply geometry updates. Plane shows last-valid result while recompute is in flight; a spinner state is out of scope.
  - `DataOperationController._computeViaAtlas`/`preview` → `applyAnalysisAsync`/`previewAnalysisAsync`; UI affordance already exists to throw `KernelUnavailableError` — unchanged.
  - The Moneta solve + layout synthesize path (`MonetaTopologyNode.reSolveAndSynthesize`) is **explicitly deferred** — it is a solve-then-build-geometry chain with scene ownership invariants; queue it as P1-B follow-on tranche after TDA + operations prove the port.

### 2.4 Explicit non-goals (per programme)

- No `SharedArrayBuffer`, WASM threads, or SIMD in this tranche — gated on measured transfer/scheduling evidence (§3 test W5 produces exactly that baseline measurement).
- No second analytical engine in the worker; the worker *is* the (single) kernel instance for async work. `CommandApplier` stays dormant and same-thread (its ABI assumes shared WASM memory — do not force it across the worker boundary).
- No change to replay determinism: `InvestigationReplayRunner` keeps the synchronous port.

---

## 3. Test plan

Cheapest authoritative evidence per claim. New lane: add `tests/atlas-async-execution.test.ts` to the fast suite (uses a **mock worker** implementing the `postMessage` contract — no real WASM), plus real-WASM coverage in the existing `test:wasm` lane.

### 3.1 Contract / fencing (fast lane, mock worker)

| # | Test | Assertion |
|---|---|---|
| B1 | request identity | Every `execute` carries unique monotonic `requestId`, the fencing triple, and JSON-shaped params. |
| B2 | stale generation discarded | Invalidate kernel mid-flight (`invalidateRuntime`); in-flight result arrives → not committed, no error surfaced. |
| B3 | stale dataset version discarded | `loadDataset` during an in-flight TDA request → result discarded; new dataset unaffected. |
| B4 | supersede on mutation | `commitKernelResult`/`advanceDataset` triggers `port.supersede` with the new fence. |
| B5 | worker failure fails closed | Worker `error`/`messageerror` → `KernelUnavailableError` propagates through `_notifyFailure` → `markKernelUnavailable`; spy asserts **no** inline/J S compute was attempted. |
| B6 | fingerprint-keyed worker registration | Two ops against the same fingerprint register the dataset once; a new fingerprint registers separately; worker-local handle never escapes the port. |

### 3.2 Real-WASM worker end-to-end (extend `vitest.wasm.config.ts` allowlist — note: Node `worker_threads` polyfill or run in jsdom+forks with a stubbed Worker over the same module; pick whichever the implementing agent proves first, record the choice in the PR)

| # | Test | Assertion |
|---|---|---|
| W1 | async TDA parity | `compute*Async` on the worker port returns results structurally identical to the synchronous bridge on the same fixture (reuse the P1-A columnar/row fixtures). |
| W2 | dataset registered once | For an NTC1-typed current, exactly one worker `data_load_typed_columns` per fingerprint; `rowMaterialisationCount` in the worker unchanged. |
| W3 | recovery across the boundary | Kill + `invalidateRuntime`, then `World.recoverKernel()` pattern: new generation, old in-flight results rejected (mirrors `runtime-recovery-endurance.test.ts` shape, 2 cycles suffices here). |
| W4 | provenance passthrough | Result provenance envelope survives the round trip byte-identical (kernel, kernelVersion, fingerprints). |

### 3.3 Presentation integration

| # | Test | Assertion |
|---|---|---|
| P1 | TDAPlanes async recompute | recompute schedules async; when a dataset change lands mid-flight, geometry is updated exactly once with the newest result (guard by triple). |
| P2 | DataOperationController async path | `preview` resolves through `previewAnalysisAsync`; a superseded preview never commits. |

### 3.4 Measurement evidence (not a CI gate — an evidence lane per programme §Verification cadence)

| # | Measurement | Purpose |
|---|---|---|
| W5 | dispatch/transfer/compute split | Instrument `execute` with `performance.now()` around postMessage and worker compute for TDA at 10K/100K/1M fixture rows; publish to `docs/DATA_BOUNDARY_BENCHMARK.md`-style record. This measurement is the gate for any future SAB/SIMD proposal. |

### 3.5 Source contracts

| # | Test | Assertion |
|---|---|---|
| S1 | no inline fallback | Source scan: `WorkerAnalyticalPort.ts` must not import `computeMapperGraph` et al. from `RuntimeBridge` (the inline port owns that import; the worker port may only transport). |
| S2 | CSP/build | `netlify.toml` CSP retains `worker-src 'self' blob:`; `vite.config.ts` emits the worker chunk (build assertion test reading `dist/` manifest in CI is acceptable, or skip if flaky — decide with evidence in the PR). |

---

## 4. Implementation sequence (for the delegated agent)

1. Branch `feat/p1b-analytical-worker` off `main` **after** the P1-A columnar-TDA PR merges.
2. Port types + `InlineAnalyticalPort` + async `AtlasCore` variants + fencing (B1–B4 pass on the inline transport).
3. Worker module + `WorkerAnalyticalPort` + fingerprint-keyed registration (B5, B6, W1–W4).
4. Presentation adoption: TDAPlanes, DataOperationController (P1, P2, S1).
5. Measurement lane W5 written to a new `docs/ANALYTICAL_SCHEDULING_BENCHMARK.md` (same predeclared-gate methodology as `docs/DATA_BOUNDARY_BENCHMARK.md`).
6. Gate: `tsc --noEmit` → `eslint` 0 errors → `npm run test:all`.
7. PR + ROADMAP Status snapshot update.
