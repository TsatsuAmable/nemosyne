# Stream A A1 — Real browser / Worker / WASM resource envelope

**Date:** 29 August 2026  
**Base:** `main@a8be01af10e36e595e52571c91613cc070035b51`  
**Status:** IMPLEMENTATION ACTIVE / MEASUREMENT FIRST / NON-QUALIFYING

## Purpose

A1 is the first checkpoint in the railed Stream A execution wave. It measures the existing production-shaped browser path before selecting another optimization:

```text
browser input preparation
  -> Worker registration/transfer
  -> Worker-local WASM resident state
  -> Rust/WASM kernel work
  -> Worker result materialisation/return
  -> Atlas durable adoption
  -> presentation/event work
  -> rendered-frame settlement
  -> automatic derived-analysis settlement
```

This checkpoint reuses the existing Q3B/Q3D/Q3E diagnostic substrate. It does not create a second benchmark runtime, does not alter analytical algorithms, and does not redesign the Worker protocol.

## Pre-implementation adversarial contract

### Authority being observed

- Atlas remains dataset/version/provenance authority.
- the real module `WorkerAnalyticalPort` remains the asynchronous execution transport;
- the Worker-local Rust/WASM runtime remains analytical authority;
- `DataOperationController` remains the production operation entry path;
- Three.js remains presentation/embodiment, not analytical authority.

### Invariant

Every A1 scenario must execute one deterministic compact `sort` through the real product path and prove:

1. one authoritative dataset version transition;
2. real asynchronous Worker execution;
3. authoritative Rust operation execution;
4. compact `row-view` Worker result;
5. exact input/output dataset fingerprints;
6. bounded Worker/WASM diagnostic samples;
7. browser controller/Atlas/Worker/commit/presentation stage evidence;
8. rendered-frame settlement;
9. explicit completion or governed refusal of the automatic derived-analysis generation;
10. exact source, production bundle and WASM artifact identity.

### Primary falsifiers

Reject an A1 scenario as evidence if it:

- executes inline/fallback rather than through the module Worker;
- returns a full dataset when compact row-view was requested;
- loses or fabricates dataset identity/version transitions;
- omits Worker registration/execution diagnostics;
- lacks Worker-local WASM memory capacity samples;
- lacks the controller, Atlas, Worker round-trip, analytical commit or visual stage;
- hides automatic derived work instead of waiting for its terminal state;
- records generic derived failure as successful settlement;
- cannot pin the exact measured source/bundle/WASM identities.

### Duplicate-authority risk

The measurement harness must never implement analytical work, materialise an alternate result for product use, mutate Moneta decisions, or select a different representation to improve a measurement. Diagnostic hooks are observation-only.

### Production entry point

The measured mutation path is:

```text
ResourceEnvelopeDiagnosticHook.runScenario
  -> World.loadDataset
  -> DataOperationController.applyAsync('sort')
  -> AtlasCore.applyAnalysisAsync
  -> WorkerAnalyticalPort
  -> analytical.worker.ts
  -> Rust/WASM runOperation
  -> compact row-view
  -> Atlas durable adoption
  -> DataOperationController.applyVisual
  -> operation event / render settlement
```

The hook supplies deterministic synthetic data, but the operation path after dataset construction is the real production path.

## Measurements

For the 1k / 8k / 32k staircase, capture:

- workload shape: rows, columns, numeric dimensions, operation and materialisation mode;
- main-page JS heap immediately and after explicit CDP garbage collection;
- CDP task/script/layout/recalc-style duration deltas;
- Worker registration and execution timings;
- Rust kernel time and Worker materialisation time;
- Worker-local WASM buffer capacity before/after kernel/materialisation;
- Worker-local host-buffer allocation counts;
- registration/input and output representation byte-size proxies already emitted by the resource substrate;
- controller, Atlas, Worker-port, analytical-commit, visual/event and render-settlement timings;
- derived-analysis settlement and terminal outcome;
- scene object/node/render-call/triangle counts.

## Evidence boundaries

- **Hosted Chromium is not Quest evidence.** A1 cannot close PERF-04, UX-03, U9 or physical-device memory/frame-pacing gates.
- **Forced CDP GC is main-page evidence only.** It does not measure Worker GC pause time.
- **WASM buffer bytes are capacity, not process RSS.** Browser/Worker engine overhead and native allocator metadata remain outside that number.
- **JSON byte counts are representation proxies, not exact structured-clone wire bytes.** A1 must label that limitation instead of inventing transport precision the browser does not expose.
- **Synthetic data only.** No user dataset, screenshot, video, trace, camera pose or heap snapshot is retained.
- **No performance threshold is preselected.** The evidence may show that no single stage dominates.

## Decision rule

After the hosted staircase completes:

1. identify the dominant measured costs at 32k and their scaling from 1k/8k/32k;
2. distinguish nested timing spans from additive stages to avoid double counting;
3. separate mutation latency, presentation settlement and automatic derived-analysis settlement;
4. reconcile Worker/WASM memory evidence with RF-029 and browser/transport evidence with RF-035/RF-051;
5. record exact structured-clone bytes and Worker GC as **unmeasured** unless a later instrument can measure them without dishonest inference;
6. select the next optimization only from the measured evidence;
7. preserve this run as the before baseline for later P1-R / scale work.

## Explicit non-goals

A1 does not:

- optimize any measured stage;
- change Worker protocol or result semantics;
- expand resource limits;
- claim generic 10M support;
- change representation mathematics;
- perform P1-R0 inventory work;
- perform Quest/device qualification.

## A1 exit

A1 may exit only when one exact-head hosted report contains a structurally valid 1k/8k/32k staircase and the post-run review records which costs are measured, which are only proxies, which remain unknown, and what concrete next optimization or P1-R measurement should consume the baseline.
