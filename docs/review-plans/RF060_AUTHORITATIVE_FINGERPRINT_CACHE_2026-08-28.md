# RF-060 — Cache the authoritative current-dataset fingerprint

**Status:** FALSIFIER ACTIVE / FIX NOT YET SELECTED

## Trigger

Q3D post-RF-059 browser decomposition on evidence head `7a24375eee864d389a8c416dc4e86f1c9e5b4ff9` showed, at 32k rows:

- controller total: ~3.84 s;
- Atlas total: ~3.18 s;
- `AtlasCore._registerCurrentDatasetInWorker`: ~740 ms;
- `WorkerAnalyticalPort.registerDataset`: ~351 ms;
- Worker operation promise: ~1.93 s;
- Atlas row-view materialization: ~120 ms;
- `operation:applied`: ~477 ms, including ~408 ms synchronous structure discovery and ~49 ms dashboard update.

The ~389 ms gap inside current-dataset registration is not explained by Worker registration itself. Code review shows the successful registration path rechecks `this.datasetFingerprint`; `AnalyticalState.getFingerprint()` asks its authoritative provider when no retained scalar exists but currently returns the provider value without retaining it. All governed dataset/kernel transitions already clear or replace `_authoritativeFingerprint`.

## Pre-fix falsifier

Before changing fingerprint retention, extend Q3D read-only instrumentation to time:

- `AtlasCore._kernelFingerprintDirect`;
- `AtlasCore._kernelFingerprint`;
- `AtlasCore._ensureHandle`.

Run the existing 1k/8k/32k compact-sort staircase through the real production browser/Worker/WASM path. The cache hypothesis is supported only if repeated authoritative fingerprint lookup is a material part of the 32k Atlas registration/event envelope.

## Candidate invariant

If the pre-fix falsifier supports the hypothesis, `AnalyticalState` may retain a successful authoritative fingerprint returned by the live kernel provider until an existing lifecycle transition invalidates or replaces it.

The fix must preserve:

1. Rust/WASM remains the fingerprint authority when a live authoritative provider is available;
2. no cached fingerprint survives dataset replacement, mutation without an explicit output fingerprint, restore, handle invalidation, or kernel replacement;
3. async Worker output fingerprints remain the authoritative retained scalar after mutation commit;
4. canonical browser identity remains only the governed fallback when no live fingerprint is available;
5. dataset identity, Worker registration fencing, replay/provenance and cross-language golden tests remain unchanged semantically.

## Required regression evidence

- repeated `getFingerprint(provider)` calls invoke the provider once while state is unchanged;
- dataset advance/set/restore/invalidation causes a fresh provider call;
- `commitKernelResult(... fingerprint)` returns the supplied authoritative fingerprint without provider work;
- provider failure/empty result does not cache a false value and retains the existing canonical fallback behavior;
- Q3D rerun after the fix shows whether registration and end-to-end latency actually improve.

## Non-goals

This tranche does not optimize Worker structured-clone transport, row-view reconstruction, synchronous structure discovery, TDA scheduling, dashboard rendering or Quest performance. Those remain separate measured findings unless the cache fix materially changes their envelope.