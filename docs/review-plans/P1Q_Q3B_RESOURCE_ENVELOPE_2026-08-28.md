# P1-Q Q3B Real Worker + WASM Resource Envelope

**Date:** 28 August 2026  
**Baseline:** `main@81583f3060304b8686ab6e120449201eb5f9ad5b` (#501 merged)  
**Evidence head:** `2cf3fb527b170e3eed32e20f7eb26517111e8273`  
**Merged:** PR #502 as `5483c6b734f798919fcdee54b216a59b4f95d38d`  
**Status:** IMPLEMENTATION LANDED / MEASUREMENT COMPLETE / TARGETED EXECUTION

## Purpose

Measure the still-open RF-015/RF-029/RF-035/RF-051 production resource seam before selecting another memory/transfer rewrite:

`deterministic dataset -> World.loadDataset -> Atlas registration -> real browser module Worker -> Worker-local Rust/WASM -> operation -> Worker result -> Atlas durable state -> visual transform -> rendered frames`

RF-035A/B2 already removed several avoidable registration/history/result copies, but the remaining full Worker -> JS mutation result path and its browser/WASM resource envelope had not been measured with a real module Worker and real WASM.

## Comparative experiment

For each deterministic edge-free tabular dataset size, Q3B ran two operations through the same production product path:

- `sort`: existing verified `row-view-if-lossless` compact result path;
- `anomaly`: current full `DatasetJSON` Worker -> JS result path.

The measured sizes were `1,000`, `8,000`, and `32,000` rows. The evidence hook permits at most `100,000` rows, but no larger-N claim is made by that guard.

The input generator uses a fixed integer mixing function, stable row IDs and a fixed five-column schema. It does not use `Math.random`, so compact/full scenarios at a given row count received the same source dataset identity and shape.

## Measurements

### Worker-local authoritative runtime instrumentation

The instrumented analytical Worker records bounded metadata only when the build is compiled with `VITE_NEMOSYNE_Q3B_RESOURCE_PROBE=1`:

- Worker registration duration;
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

## Hosted result

The successful hosted Chromium run completed all six scenarios on the real module-Worker + Worker-local WASM path.

| Rows | Full / compact materialise | Full / compact end-to-end | Compact WASM growth | Full WASM growth |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 3.06x | 1.25x | 0 B | 0 B |
| 8,000 | 8.79x | 0.66x | 0 B | 0 B |
| 32,000 | 7.59x | 0.09x | 6,619,136 B | 27,066,368 B |

The full `DatasetJSON` materialisation path is therefore materially more expensive than the compact row-view materialisation step in this experiment, and at 32k rows it coincides with substantially greater Worker WASM capacity growth.

However, Q3B does **not** establish that full result transport dominates real mutation latency. `sort` and `anomaly_zscore` perform different Rust kernel work; the end-to-end ratios reverse at larger N. Treating those end-to-end numbers as a compact/full causal comparison would be evidence inflation.

The successful measurement step took about one minute. The standalone job also rebuilt WASM/Vite and provisioned Chromium, so recurring automatic PR execution has a poor cost/signal ratio. The Q3B workflow is therefore retained as `workflow_dispatch` only.

## Evidence boundaries

The following distinctions remain mandatory when interpreting results:

1. **Headless Chromium is not Quest evidence.** This pilot proves browser module-Worker + WASM behaviour on hosted Chromium. It does not qualify Quest memory, frame pacing, tracking or thermal behaviour.
2. **Forced main-page GC is not Worker GC timing.** CDP `HeapProfiler.collectGarbage` applies to the inspected page target. Retained page heap is useful comparative evidence but is not a measurement of Worker GC pause time.
3. **WASM buffer bytes are capacity, not process RSS.** The Worker measurement is the actual Worker-local `WebAssembly.Memory` buffer capacity. It does not include browser/Worker engine overhead or native allocator metadata outside that buffer.
4. **JSON bytes are a representation-size estimate, not structured-clone wire bytes.** They provide a stable size proxy for the full dataset representation; the browser does not expose exact structured-clone bytes here.
5. **Different operations have different kernel work.** Q3B intentionally exercised different operations and therefore cannot isolate the causal end-to-end cost of result mode.
6. **No private data enters the pilot.** All data is deterministic synthetic evidence data. The uploaded artifact contains structured JSON/timing text only, not Playwright traces, screenshots or video.
7. **No threshold is a product claim.** These results do not establish generic large-N, private-preview, or physical-device acceptance thresholds.

## Falsification result

The successful run proved that every configured scenario:

- executed through an asynchronous Worker port;
- committed exactly one authoritative dataset-version transition;
- emitted real Worker registration and execution diagnostics;
- returned `row-view` for `sort` and full `dataset` for `anomaly`;
- exposed Worker-local WASM memory capacity;
- retained exact source-head, workflow-checkout, production-bundle and WASM identities.

Two earlier red pilot runs were harness failures and are not promotion evidence: one drained registration diagnostics before inspection; the next exceeded the generic 30-second Playwright test timeout. Both were corrected without weakening the production-path requirements.

## Classification

**ADOPT MEASUREMENT SUBSTRATE / TARGETED EXECUTION.**

Keep the bounded Worker/WASM diagnostics and deterministic browser resource probe available for explicit performance investigations. Do not make the standalone resource-envelope workflow an automatic PR tax.

Q3B confirms a materialisation-cost signal but leaves the causal end-to-end question open. No RF-035 implementation should be justified solely from the cross-operation end-to-end ratios.

## Q3C handoff

Run a same-operation A/B using identical deterministic input and the same Rust operation, with only result materialisation changed:

- `sort -> row-view-if-lossless`;
- `sort -> full DatasetJSON`.

The Q3C probe must preserve the normal Atlas registration, version/fence, adoption, history/provenance and render path, and must prove that both modes end at the same authoritative scientific fingerprint. Only then may a resident-result/lazy-materialisation RF-035C implementation be selected from the measured evidence.
