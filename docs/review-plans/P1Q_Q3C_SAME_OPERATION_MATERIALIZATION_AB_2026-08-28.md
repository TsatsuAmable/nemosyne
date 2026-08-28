# P1-Q Q3C Same-Operation Materialization A/B

**Date:** 28 August 2026  
**Baseline:** `main@5483c6b734f798919fcdee54b216a59b4f95d38d` (#502 merged)  
**Evidence head:** `3a0cad1515094c472a59375f4ec8de748e607183`  
**Hosted run:** `33193788679` / job `98925655910`  
**Status:** MEASUREMENT COMPLETE / REVIEW ACTIVE / TARGETED EXECUTION

## Question

Q3B measured a clear Worker materialisation-cost signal, but its compact and full paths used different Rust operations (`sort` versus `anomaly_zscore`). Q3C removes that confound.

The falsifiable question is:

> For the same deterministic input and the same authoritative Rust `sort` operation, what resource and latency cost is caused by returning a full `DatasetJSON` instead of the existing verified compact row-view?

No expected performance winner or threshold was pinned before measurement.

## Pre-implementation adversarial contract

### Invariant

For each configured row count, compact and full scenarios must execute the same Rust `sort` operation over byte-equivalent scientific input and finish at the same authoritative output fingerprint. The only intended independent variable is Worker result materialisation.

### Authority / production path

The measured path remains:

`World.loadDataset -> AtlasCore -> real module Worker -> Worker-local Rust/WASM runOperation(sort) -> Worker result -> Atlas authoritative verification/adoption -> DataOperationController visual application -> rendered frames`

The evidence driver may alter only the `resultMode` hint on the single Worker execution request. It must not reimplement sort, fingerprinting, Atlas result adoption, history/provenance, version fencing or rendering.

### Primary failure modes

1. **False A/B:** compact and full runs accidentally execute different operations, inputs or output identities.
2. **Authority bypass:** the test manually reconstructs/adopts a result instead of exercising Atlas production adoption.
3. **Fallback path:** an inline/synchronous kernel path masquerades as Worker evidence.
4. **Instrumentation distortion:** the override leaks outside the one scenario or changes ordinary production behavior.
5. **Evidence inflation:** materialisation timing is presented as structured-clone wire time, Worker GC time, Quest behavior or a generic large-N threshold.
6. **Harness cost promotion:** the expensive build/browser setup becomes a permanent PR tax without evidence that recurring execution earns it.

### Falsifying evidence

The hosted pilot fails unless every pair proves:

- real asynchronous Worker execution;
- one authoritative Atlas dataset-version transition;
- Worker diagnostic `operationName === "sort"` for both modes;
- compact result kind `row-view` and forced-full result kind `dataset`;
- identical authoritative source fingerprints across the pair;
- identical authoritative output fingerprints across the pair;
- identical materialized output JSON size across the pair;
- real Worker-local WASM memory diagnostics;
- exact source-head, workflow-checkout, production-bundle and WASM identities.

Partial measurements from a failed staircase are diagnostic-only.

## Evidence-only override boundary

`resourceEnvelopeDiagnostics.ts` temporarily wraps the active analytical port's `execute` method only while an explicitly instrumented synthetic scenario is running:

- `compact`: ensure `resultMode = row-view-if-lossless`;
- `full`: remove the compact hint so the existing Worker full-dataset path is used;
- `auto`: unchanged production policy, preserving Q3B behavior.

The wrapper is restored in `finally`. The hook itself is installed only in builds compiled with the existing Q3 resource-probe flag.

This avoids adding a user-facing or domain-level materialisation switch before evidence establishes that such a policy belongs in production architecture.

## Hosted result

The first complete hosted run passed the full 1k/8k/32k staircase. Every compact/full pair used the same Rust `sort`, the same authoritative source fingerprint, the same authoritative output fingerprint and the same final JSON-size proxy.

| Rows | Compact kernel | Full kernel | Compact materialise | Full materialise | Full / compact materialise | Compact Worker total | Full Worker total | Compact browser E2E | Full browser E2E |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 65.19 ms | 51.12 ms | 1.46 ms | 8.09 ms | 5.54x | 72.47 ms | 69.37 ms | 536.39 ms | 473.48 ms |
| 8,000 | 2,105.45 ms | 2,180.91 ms | 5.24 ms | 30.21 ms | 5.76x | 2,156.41 ms | 2,256.97 ms | 2,917.19 ms | 2,923.31 ms |
| 32,000 | 36,445.22 ms | 36,340.79 ms | 18.04 ms | 125.05 ms | 6.93x | 36,638.44 ms | 36,632.67 ms | 37,859.13 ms | 37,789.80 ms |

At 32k, the compact scenario grew the Worker-local WASM buffer by 6,619,136 bytes during the measured operation and the full scenario by 15,597,568 bytes. These are per-scenario capacity changes from different starting capacities in one long-lived Worker, so they are useful pressure signals but not isolated allocation measurements.

The full result path is therefore unambiguously more expensive to materialise. The absolute penalty at 32k in this run was about 107 ms. However, Worker-total and browser end-to-end ratios were effectively 1.0 at 8k and 32k. Materialisation is **not the dominant latency in the measured sort path**.

The standalone evidence job itself is also expensive: the instrumented build took about 68 seconds, Chromium provisioning about 27 seconds, and the six-scenario same-sort probe about 145 seconds. Automatic execution on every PR is not justified.

## Primary new finding: row-identity remap has quadratic worst-case work

The dominant measured time sits inside the Rust operation envelope: roughly 65 ms at 1k, 2.1 s at 8k and 36.4 s at 32k.

Code inspection after the measurement found a concrete asymptotic defect in the row-preserving mutation path:

- `wasm/src/data/operations.rs::sort` clones/sorts rows and then calls `Dataset::clone_with_rows`;
- `Dataset::clone_with_rows` walks every output row and calls `find_matching_source_row`;
- `find_matching_source_row` linearly scans the source rows until it finds an unused scientific-row match.

For a pure reordering this is worst-case `O(n² × columns)` identity recovery after an otherwise `O(n log n)` sort. This defect is independently real from the timing experiment. Q3C does not yet attribute a precise percentage of the 36-second kernel envelope to that helper, so the causal performance claim remains to be measured after a bounded fix.

Record this as **RF-059: quadratic row-identity remap in row-preserving Rust mutations**. The first fix-forward target should be sort because Q3C measured it directly. Preserve duplicate-row behavior, row IDs, positional-edge remapping, stable string endpoints and authoritative fingerprints.

## Classification

**Q3C: ADOPT MEASUREMENT SUBSTRATE / TARGETED EXECUTION.**

**RF-035C eager full-result rewrite: DEFER AS A LATENCY PRIORITY.** The full `DatasetJSON` path wastes materialisation time and can create additional memory pressure, so the existing compact row-view policy remains justified and full materialisation should stay explicit/lazy where possible. But this experiment does not justify a broad resident-result rewrite ahead of the much larger measured Rust operation cost.

**RF-059: HIGH-PRIORITY FIX-FORWARD.** Replace the quadratic row-identity recovery for known row-preserving reorderings with an identity-preserving source-index path (or equivalently bounded mapping) that cannot change scientific output identity. Add deterministic duplicate-row and graph-remap regressions, then rerun this same Q3C staircase against the fixed implementation.

## Evidence boundaries

- Hosted headless Chromium is not Quest evidence.
- CDP forced GC covers the inspected page target, not Worker GC pause time.
- WASM buffer bytes are capacity, not process RSS.
- JSON bytes are representation-size proxies, not exact structured-clone wire bytes.
- One hosted run is sufficient to falsify architecture/path assumptions and expose order-of-magnitude defects; it is not a stable product performance threshold.
- Q3C times include the existing production operation envelope around Rust/WASM. They do not independently separate Rust sorting from `clone_with_rows` identity recovery.

## Next handoff

1. retire the Q3C automatic `pull_request` trigger and retain the workflow as manual evidence only;
2. land this measurement substrate after ordinary exact-head gates;
3. create a bounded RF-059 fix from fresh `main` that preserves row identity by construction rather than rediscovering source rows quadratically;
4. benchmark the Rust operation directly and rerun Q3C 1k/8k/32k after the fix;
5. only revisit broader RF-035C resident-result/lazy-materialisation architecture if post-RF-059 measurements show materialisation has become a meaningful share of the remaining envelope.
