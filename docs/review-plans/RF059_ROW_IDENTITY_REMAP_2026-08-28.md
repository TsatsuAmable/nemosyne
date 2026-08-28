# RF-059 — Linear-time row identity remap

**Date:** 28 August 2026  
**Discovery baseline:** `main@406aca8946da94824b29a319b52a2f1733ec895b` (#504 merged)  
**Implementation rebased through:** `main@496cd785dc12bf54493320d7f55a3b4262498441` (#503 merged)  
**Status:** IMPLEMENTATION LANDED ON BRANCH / REVIEW ACTIVE / REMEASUREMENT PASSED

## Finding

Q3C's same-operation Worker measurement disproved eager full-result materialization as the dominant latency source for Rust `sort`. On the original measured 32k case, full `DatasetJSON` materialization added about 107 ms while the Rust operation envelope was about 36.4 s.

Code review found a stronger candidate inside `Dataset::clone_with_rows`: every transformed output row called `find_matching_source_row`, which linearly scanned source observations until it found the first unused row equal on declared scientific columns. A row-preserving reorder therefore had worst-case `O(n² × columns)` identity recovery after the ordinary `O(n log n)` sort.

This is **RF-059** because durable row identity and graph endpoint remapping are correctness/provenance responsibilities, not optional presentation metadata.

## Invariant

The fix preserves the previous row-matching semantics while changing the lookup algorithm:

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

## Correctness evidence

Exact branch Rust unit execution passed after the implementation. Existing regressions still prove:

- duplicate scientific observations retain distinct durable row IDs and preserve first-unused source ordering through sort;
- positional graph endpoints remap into sorted order;
- stable string graph endpoints survive a pure reorder;
- filtering preserves/drops topology according to source membership;
- genuinely derived rows clear graph topology;
- row IDs remain excluded from scientific fingerprint identity.

New RF-059 regressions additionally prove:

- `-0.0` and `0.0` retain one row-identity equivalence class;
- NaN does not gain a false identity match from the hash index.

## Same-harness Q3C remeasurement

**Original Q3C evidence:** head `3a0cad1515094c472a59375f4ec8de748e607183`, run `33193788679`.  
**RF-059 remeasurement:** source head `39cb8a197c5fdf1a4193f0230c5a3dea6e6621b9`, run `33196011917`, artifact `9695844098` (`sha256:47f1f9bb40c55bb4d2a2dda3420b1610027c5070527cdc6402bcfa3f3efcf21d`).

The remeasurement used the same deterministic 1k/8k/32k hosted Chromium, real module Worker, real WASM, authoritative Rust `sort`, compact-row-view versus forced-full-dataset experiment. Every compact/full pair retained identical authoritative source and output scientific fingerprints and the expected `row-view`/`dataset` result kinds.

| Rows | Mode | Rust kernel before | Rust kernel RF-059 | Kernel speed-up | Worker total before | Worker total RF-059 | Browser op before | Browser op RF-059 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1k | compact | 65.190 ms | 34.410 ms | 1.89x | 72.465 ms | 51.635 ms | 536.390 ms | 472.900 ms |
| 1k | full | 51.115 ms | 16.900 ms | 3.02x | 69.370 ms | 30.085 ms | 473.480 ms | 551.635 ms |
| 8k | compact | 2,105.450 ms | 83.120 ms | 25.33x | 2,156.405 ms | 144.260 ms | 2,917.185 ms | 2,032.060 ms |
| 8k | full | 2,180.905 ms | 94.345 ms | 23.12x | 2,256.970 ms | 189.450 ms | 2,923.305 ms | 1,996.935 ms |
| 32k | compact | 36,445.215 ms | 437.515 ms | 83.30x | 36,638.435 ms | 575.195 ms | 37,859.125 ms | 3,196.625 ms |
| 32k | full | 36,340.785 ms | 431.975 ms | 84.13x | 36,632.670 ms | 640.595 ms | 37,789.800 ms | 3,131.600 ms |

At 32k the Rust kernel envelope fell by about **98.8%**, from ~36.4 seconds to ~0.43 seconds. Worker total fell by about **57–64x**, and browser operation end-to-end improved by about **12x**. This bounded before/after evidence strongly supports the quadratic row-identity recovery as the dominant cause of the original Q3C sort-kernel cliff for this deterministic workload.

Full result materialization remains measurably more expensive than compact materialization after the fix: at 32k, compact materialization was 12.385 ms and full materialization 82.750 ms, about 6.7x. It is still not the dominant same-sort latency stage, so the Q3C decision to keep compact output while deferring a broad eager/full-result latency rewrite remains valid.

## Classification

- **RF-059 implementation:** ADOPT. The algorithmic cliff is removed while existing row-lineage and graph semantics remain covered.
- **RF-059 performance diagnosis:** CONFIRMED FOR THE MEASURED Q3C SORT WORKLOAD. The same harness shows an ~83–84x 32k Rust-kernel improvement after removing quadratic identity rediscovery.
- **Q3C compact result policy:** retain.
- **Broad RF-035C eager/full-result rewrite as latency priority:** remain deferred; materialization remains a smaller bounded cost in this path.
- **RF-035/RF-029/RF-051:** remain review-active. RF-059 closes one concrete Rust post-operation cliff, not the whole browser/WASM/device resource envelope.

## Promotion gates

Before merge:

1. retire the temporary Q3C `pull_request` trigger back to `workflow_dispatch` only;
2. record RF-059 in the current roadmap without overwriting concurrent Stream-A updates;
3. run ordinary CI, CodeQL, approval and architecture-policy evidence on the final exact head after the trigger retirement/documentation changes;
4. confirm no unresolved material review threads;
5. confirm the final branch is not behind current `main`;
6. merge only with an expected-head guard.

## Non-claims

- This is not generic 10M-row qualification.
- Hosted Chromium is not Quest evidence.
- A faster deterministic synthetic sort does not establish all analytical operations are bounded.
- The new hash index still allocates O(n) auxiliary identity state; the result proves a large latency improvement, not zero-copy behavior.
- Browser operation end-to-end remains seconds at 32k because rendering/main-thread/TDA/setup work exists outside the isolated Rust sort kernel; RF-029/RF-035/RF-051 still own the complete resource envelope.
