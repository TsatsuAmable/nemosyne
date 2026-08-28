# P1-Q Q3C Same-Operation Materialization A/B

**Date:** 28 August 2026  
**Baseline:** `main@5483c6b734f798919fcdee54b216a59b4f95d38d` (#502 merged)  
**Status:** PILOT ACTIVE / REVIEW ACTIVE / NON-REQUIRED

## Question

Q3B measured a clear Worker materialisation-cost signal, but its compact and full paths used different Rust operations (`sort` versus `anomaly_zscore`). Q3C removes that confound.

The falsifiable question is:

> For the same deterministic input and the same authoritative Rust `sort` operation, what resource and latency cost is caused by returning a full `DatasetJSON` instead of the existing verified compact row-view?

No expected performance winner or threshold is pinned before measurement.

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

### Non-goals

- no production materialisation-policy change;
- no RF-035C optimization selected in advance;
- no physical Quest qualification;
- no claim about exact structured-clone wire bytes;
- no Worker GC-pause claim from main-page CDP forced GC;
- no threshold beyond the measured deterministic 1k/8k/32k browser cases.

## Evidence-only override boundary

`resourceEnvelopeDiagnostics.ts` temporarily wraps the active analytical port's `execute` method only while an explicitly instrumented synthetic scenario is running:

- `compact`: ensure `resultMode = row-view-if-lossless`;
- `full`: remove the compact hint so the existing Worker full-dataset path is used;
- `auto`: unchanged production policy, preserving Q3B behavior.

The wrapper is restored in `finally`. The hook itself is installed only in builds compiled with the existing Q3 resource-probe flag.

This is deliberately preferable to adding a user-facing or domain-level materialisation switch before the experiment establishes that such a policy belongs in production architecture.

## Measurement set

For `1,000`, `8,000`, and `32,000` rows, record compact and full:

- Rust kernel time;
- Worker result-materialisation time;
- Worker total execution time;
- Worker-local WASM buffer-capacity growth;
- Worker host-buffer allocation deltas;
- browser operation end-to-end time;
- operation-to-rendered-frame time;
- main-page immediate and retained-after-forced-GC heap deltas;
- CDP task/script/layout/recalc-style deltas;
- exact scientific input/output fingerprints and JSON size proxies.

## Decision rule

After the complete hosted staircase:

- if full materialisation is consistently and materially more expensive while kernel timings and scientific output identity remain comparable, use that evidence to design the next bounded RF-035C resident-result/lazy-materialisation tranche;
- if the same-operation end-to-end difference is weak, unstable or points elsewhere, do not implement the preselected RF-035C hypothesis; investigate the measured dominant stage instead;
- regardless of outcome, retire the Q3C automatic PR trigger before merge unless recurring execution demonstrably earns its cost.
