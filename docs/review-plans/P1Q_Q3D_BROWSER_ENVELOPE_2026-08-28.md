# P1-Q Q3D — Browser operation-envelope decomposition

**Status:** PILOT ACTIVE / MEASUREMENT FIRST / NON-REQUIRED

## Why this tranche exists

RF-059 removed the quadratic Rust row-identity remap and collapsed the 32k authoritative `sort` kernel from roughly 36.4 s to roughly 0.43 s on the same Q3C hosted harness. The same post-fix evidence still showed about 3.2 s from `DataOperationController.applyAsync()` entry to return, while the instrumented Worker operation itself was roughly 0.58–0.64 s. The remaining browser-side envelope is therefore large enough to measure before selecting another optimization.

Q3D does not assume the next bottleneck. It decomposes the existing production path and accepts any result, including that no single browser stage dominates.

## Production path under test

```text
DataOperationController.applyAsync
  -> pre-Atlas dataset/presentation preparation
  -> AtlasCore.applyAnalysisAsync
       -> WorkerAnalyticalPort.execute
       -> Worker-local Rust/WASM sort
       -> compact row-view return
       -> authoritative Atlas verification/adoption
       -> analytical commit
       -> evidence/result/graph recording
  -> presentation visual transform
  -> synchronous operation subscribers
       -> spatial acceleration invalidation
       -> telemetry/logging
  -> autosave request
  -> rendered-frame settlement
```

The pilot uses the existing deterministic Q3B/Q3C synthetic tabular dataset and the current default compact `sort` result path at 1k, 8k and 32k rows.

## Read-only instrumentation

`src/app/browserEnvelopeDiagnostics.ts` is installed only when `VITE_NEMOSYNE_Q3D_BROWSER_PROBE=1`. It wraps existing methods for timing and restores them on disposal. It does not change analytical parameters, result materialisation policy, fingerprints, persistence ordering, rendering policy or runtime authority.

Captured stages include:

- controller total;
- Atlas async total;
- main-thread Worker request/response promise duration;
- analytical `commitKernelResult`;
- ledger result/event writes;
- visual application;
- synchronous operation and autosave event dispatch;
- spatial-acceleration invalidation;
- aggregate `Dataset.clone()` and `Dataset.toJSON()` calls during the controller envelope;
- post-controller two-frame settlement from the existing Q3 resource probe.

The structured evidence stores timings and metadata only. No trace, screenshot, video, user dataset, heap snapshot or private payload is retained.

## Falsifiers

The pilot is rejected as evidence if any scenario:

1. does not execute the real asynchronous Worker path;
2. does not execute authoritative Rust `sort`;
3. does not use the compact `row-view` result;
4. lacks authoritative input/output fingerprints;
5. fails to commit exactly one dataset version;
6. lacks controller, Atlas, Worker, analytical-commit, visual, operation-event, autosave-event or spatial-invalidation stages;
7. produces a controller timing inconsistent with the existing Q3 resource-envelope timing;
8. cannot pin exact source, checkout, production-bundle and WASM identities.

## Decision rule

After a complete hosted staircase:

- identify the largest measured browser-side stage at 32k and its scaling from 1k/8k/32k;
- distinguish nested timings from additive timings to avoid double counting;
- create a new RF item only for a concrete, materially expensive production behavior;
- prefer a bounded fix that preserves Rust/WASM authority, exact identity, replay/history, provenance and presentation semantics;
- rerun the same Q3D staircase after any optimization before claiming causality or improvement.

The temporary PR trigger exists only to obtain the initial hosted evidence. It must be retired to `workflow_dispatch` before merge unless recurring execution demonstrates enough value to justify its build/browser cost.

## Non-claims

Q3D is synthetic hosted-Chromium evidence. It is not Quest memory/frame qualification, does not prove generic large-N support, and does not establish Worker GC timing or process RSS. RF-029/RF-035/RF-051 and physical Quest qualification remain separately governed.