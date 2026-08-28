# P1-Q Q3B Real Worker + WASM Resource Envelope

**Date:** 28 August 2026  
**Baseline:** `main@81583f3060304b8686ab6e120449201eb5f9ad5b` (#501 merged)  
**Status:** PILOT ACTIVE / NON-REQUIRED / MEASUREMENT FIRST

## Purpose

Measure the still-open RF-015/RF-029/RF-035/RF-051 production resource seam before selecting another memory/transfer rewrite:

`deterministic dataset -> World.loadDataset -> Atlas registration -> real browser module Worker -> Worker-local Rust/WASM -> operation -> Worker result -> Atlas durable state -> visual transform -> rendered frames`

RF-035A/B2 already removed several avoidable registration/history/result copies, but the remaining full Worker -> JS mutation result path and its browser/WASM resource envelope have not been measured with a real module Worker and real WASM.

## Comparative experiment

For each deterministic edge-free tabular dataset size, Q3B runs two operations through the same production product path:

- `sort`: requests the existing verified `row-view-if-lossless` compact result path;
- `anomaly`: exercises the current full `DatasetJSON` Worker -> JS result path.

The pilot sizes are `1,000`, `8,000`, and `32,000` rows. The evidence hook permits at most `100,000` rows, but no larger-N claim is made by that guard.

The input generator uses a fixed integer mixing function, stable row IDs and a fixed five-column schema. It does not use `Math.random`, so compact/full scenarios at a given row count receive the same source dataset identity and shape.

## Measurements

### Worker-local authoritative runtime instrumentation

The instrumented analytical Worker records bounded metadata only when the build is compiled with `VITE_NEMOSYNE_Q3B_RESOURCE_PROBE=1`:

- Worker registration duration;
- bridge-ready duration;
- Rust operation duration;
- result materialisation duration (`datasetRowView` or `getDatasetJson`);
- actual Worker-local `WebAssembly.Memory.buffer.byteLength` before/after kernel/materialisation;
- Worker-local host-buffer allocation count before/after;
- result kind (`row-view` versus `dataset`);
- row/column counts.

These measurements describe runtime/transport behaviour only. They are not analytical evidence and cannot alter results.

### Browser product-path measurements

The browser probe records:

- synchronous `World.loadDataset` time;
- load-to-two-rendered-frames time;
- `DataOperationController.applyAsync` end-to-end time;
- operation-to-two-rendered-frames time;
- main-page JS heap metrics where Chromium exposes them;
- retained main-page heap after an explicit CDP garbage collection;
- CDP Task/Script/Layout/RecalcStyle duration deltas;
- main-thread WASM buffer size and host-buffer allocation count;
- scene object/rendered-node/render-call/triangle counts;
- UTF-8 JSON byte-size estimates for the scientific input/output representation.

## Evidence boundaries

The following distinctions are mandatory when interpreting results:

1. **Headless Chromium is not Quest evidence.** This pilot proves browser module-Worker + WASM behaviour on hosted Chromium. It does not qualify Quest memory, frame pacing, tracking or thermal behaviour.
2. **Forced main-page GC is not Worker GC timing.** CDP `HeapProfiler.collectGarbage` applies to the inspected page target. Retained page heap is useful comparative evidence but is not a measurement of Worker GC pause time.
3. **WASM buffer bytes are capacity, not process RSS.** The Worker measurement is the actual Worker-local `WebAssembly.Memory` buffer capacity. It does not include browser/Worker engine overhead or native allocator metadata outside that buffer.
4. **JSON bytes are a representation-size estimate, not structured-clone wire bytes.** They provide a stable size proxy for the full dataset representation; the browser does not expose exact structured-clone bytes here.
5. **Different operations have different kernel work.** `sort` and `anomaly_zscore` are intentionally chosen to exercise compact versus full result modes on the same data shape. End-to-end ratios therefore include both algorithm and result-path differences. Worker `kernel` versus `materialize` timings are recorded separately to avoid attributing the entire difference to transfer.
6. **No private data enters the pilot.** All data is deterministic synthetic evidence data. The uploaded artifact contains structured JSON/timing text only, not Playwright traces, screenshots or video.
7. **No threshold is a product claim.** The initial pilot validates measurement shape and identifies bottlenecks. It does not establish generic large-N, private-preview, or physical-device acceptance thresholds.

## Falsification requirements

The pilot fails if any scenario does not:

- execute through an asynchronous Worker port;
- commit exactly one authoritative dataset-version transition;
- emit a real Worker registration diagnostic;
- emit a real Worker execution diagnostic;
- return `row-view` for `sort`;
- return full `dataset` for `anomaly`;
- expose Worker-local WASM memory capacity;
- retain exact source-head, workflow-checkout, production-bundle and WASM identities.

This prevents a fallback/inline path, skipped operation or uninstrumented Worker from producing apparently useful measurements.

## Promotion decision

After the hosted pilot:

- inspect exact timings, heap/WASM deltas, task-duration deltas and artifact size;
- determine whether the full Worker -> JS DatasetJSON result is materially dominant after separating kernel and materialisation time;
- record any newly discovered defect class, but do not duplicate RF-035/RF-051 ownership for already-known full-result materialisation;
- select the next optimization only from measured evidence;
- retire the pilot's automatic PR trigger before merge unless recurring execution demonstrably earns its cost;
- keep the measurement harness non-required unless its incremental cost and defect signal justify promotion.

## Q3B handoff

If the data confirms the existing full-result seam is materially expensive, the next bounded RF-035 tranche should define identity-first resident mutation results plus explicit/lazy presentation or export materialisation, preserving authoritative fingerprint/version/replay semantics. If another stage dominates, fix that measured bottleneck instead.
