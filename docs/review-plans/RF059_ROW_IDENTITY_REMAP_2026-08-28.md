# RF-059 — Linear-time row identity remap

**Date:** 28 August 2026  
**Baseline:** `main@406aca8946da94824b29a319b52a2f1733ec895b` (#504 merged)  
**Status:** IMPLEMENTATION ACTIVE / REVIEW ACTIVE

## Finding

Q3C's same-operation Worker measurement disproved eager full-result materialization as the dominant latency source for Rust `sort`. On the measured 32k case, full `DatasetJSON` materialization added about 107 ms while the Rust operation envelope was about 36.4 s.

Code review found a stronger candidate inside `Dataset::clone_with_rows`: every transformed output row called `find_matching_source_row`, which linearly scanned source observations until it found the first unused row equal on declared scientific columns. A row-preserving reorder therefore had worst-case `O(n² × columns)` identity recovery after the ordinary `O(n log n)` sort.

This is **RF-059** because durable row identity and graph endpoint remapping are correctness/provenance responsibilities, not optional presentation metadata.

## Invariant

The fix must preserve the exact previous row-matching semantics while changing the lookup algorithm:

- compare only declared scientific columns;
- missing declared values and explicit `Null` compare identically;
- duplicate scientific observations consume source identities in original source order;
- `-0.0` and `0.0` compare equal;
- NaN must not become an identity match;
- valid row IDs remain attached to the same source observations;
- positional graph endpoints remap into transformed order;
- stable string endpoints survive only when the transform preserves the complete source membership, exactly as before;
- genuinely derived rows still clear topology and obtain new lineage IDs.

## Implementation

`Dataset::clone_with_rows` now builds one hash index over declared scientific row values. Each scientific key owns a FIFO queue of source indices. Output rows consume the next index from the matching queue.

Expected matching complexity changes from worst-case `O(n² × columns)` to expected `O((n + m) × columns)` for `n` source rows and `m` output rows, plus the existing edge-remap cost. The transform still owns its normal row cloning and fingerprint/provenance work.

The hash key mirrors Rust `Value` equality rather than stringifying values:

- numeric values use `f64::to_bits`;
- signed zero is normalized to the same key;
- NaN produces no key and therefore preserves the old fail-to-match behavior;
- text, boolean and null remain type-distinct.

No analytical algorithm, fingerprint algorithm or Worker result policy changes.

## Pre-promotion falsifiers

The change is rejected if any of these occur:

1. existing duplicate-row ID tests change output ordering;
2. positional or stable graph endpoint tests fail;
3. missing-vs-null scientific equality changes;
4. signed zero no longer follows ordinary Rust equality;
5. NaN gains a false identity match;
6. canonical scientific fingerprints differ for the same sorted result;
7. the same Q3C 1k/8k/32k staircase does not materially reduce the measured Rust sort envelope, in which case the optimization remains a correctness/complexity improvement but the latency diagnosis must move elsewhere;
8. ordinary exact-head CI, CodeQL, approval or architecture-policy evidence fails.

## Evidence plan

1. Run Rust unit coverage including the existing row-ID/graph transform regressions and the new signed-zero/NaN cases.
2. Run ordinary PR CI/CodeQL/approval/architecture-policy gates.
3. Manually dispatch the already-retired Q3C same-operation workflow on this branch, preserving the same deterministic 1k/8k/32k compact/full `sort` staircase and evidence boundaries.
4. Compare absolute Rust kernel, Worker-total and browser end-to-end timings with Q3C evidence head `3a0cad1515094c472a59375f4ec8de748e607183`; do not claim a percentage contribution until the remeasurement exists.
5. Record the result and classification before merge.

## Non-claims

- This is not generic 10M-row qualification.
- Hosted Chromium is not Quest evidence.
- A faster deterministic synthetic sort does not establish all analytical operations are bounded.
- Hash-index allocation is not zero-cost; Q3C remeasurement must show the real trade.
- RF-035 remains review-active after this fix because transfer/materialization, resident state, graph/derived results and device evidence remain broader concerns.
