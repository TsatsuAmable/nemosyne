# UXR0C3 SemanticTargetResolver benchmark

**Date:** 2026-09-10  
**Scope:** `SemanticTargetResolver.rank()` CPU scaling and allocation-pressure proxy  
**Environment:** local macOS development host, repository Node 24 toolchain, Vitest jsdom integration worker. This is engineering evidence, not Quest qualification evidence.

## Question

Does the allocation-heavy semantic ranking path justify a semantics-preserving implementation change before device verification?

## Method

`npm run benchmark:semantic-target-resolver` executes 20,000 steady-state `rank()` calls per case after 2,000 warm-up calls. Fixtures are constructed once and reused so the measured loop is dominated by resolver work. Candidate counts are 1, 8, 32, and 128; each is exercised with and without gaze scoring. Node runs with `--expose-gc` and the harness reports elapsed time, heap-used delta, and observed GC events.

For the tranche decision, the identical harness was run five times against:

1. **Baseline:** `b0d8879c` implementation before UXR0C3.
2. **Candidate:** stable single-pass extrema selection plus resolver-owned vector scratch and lazy winner materialisation.

Numbers below are medians of the five runs. `heapDeltaBytes` is only a **pre/post heap-growth proxy** because V8 can collect during the loop; it must not be read as exact allocated bytes.

## Median timing results

| Gaze | Hits | Baseline ns/call | Candidate ns/call | Change |
|---|---:|---:|---:|---:|
| no | 1 | 1,053.6 | 612.9 | 41.8% faster |
| no | 8 | 1,322.0 | 1,028.0 | 22.2% faster |
| no | 32 | 2,661.1 | 1,669.4 | 37.3% faster |
| no | 128 | 9,969.2 | 2,518.2 | 74.7% faster |
| yes | 1 | 658.4 | 961.1 | 46.0% slower |
| yes | 8 | 1,025.6 | 703.6 | 31.4% faster |
| yes | 32 | 3,518.3 | 1,708.9 | 51.4% faster |
| yes | 128 | 16,303.7 | 7,999.2 | 50.9% faster |

At 128 candidates the candidate is about **3.96x faster without gaze** and **2.04x faster with gaze**. The one-hit gaze case regresses in this microbenchmark, which is retained here rather than hidden; the optimization is justified by the scaling regime, not by claiming universal wins.

## Heap-growth proxy medians

| Gaze | Hits | Baseline bytes | Candidate bytes |
|---|---:|---:|---:|
| no | 1 | 29,055,824 | 12,314,512 |
| no | 8 | 25,076,864 | 27,582,400 |
| no | 32 | 60,428,632 | 10,798,304 |
| no | 128 | 36,084,592 | 9,172,560 |
| yes | 1 | 34,124,008 | 13,026,120 |
| yes | 8 | 13,561,832 | 14,566,888 |
| yes | 32 | 64,017,672 | 14,057,248 |
| yes | 128 | 42,411,184 | 11,250,856 |

The proxy is noisy at low candidate counts but shows a large reduction at 32 and 128 hits, consistent with removal of per-hit result objects, gaze clones, per-hit vectors, and filter/sort arrays.

## Semantic falsifiers

The candidate is not accepted on performance alone. `tests/semantic-target-resolution-equivalence.test.ts` freezes the pre-C3 first-call algorithm as a test oracle and compares 500 deterministic varied fixtures spanning candidate counts, gaze/no-gaze, task priors, structure kinds, invalid distances, salience, and coercion. It also pins stable first-hit precedence for exact score ties. Existing F1-F10 tests continue to cover hysteresis, assistance-radius coercion, identity, parity, persistence, and failure handling.

## Findings

**Finding:** the baseline performs unnecessary O(n log n) sorting and materialises intermediate arrays/objects although downstream semantics require only the highest-scoring hit, highest-scoring structure, and nearest observation.

**Finding:** replacing sorting/filtering with a stable O(n) pass materially improves the high-candidate regime while preserving the tested winner, score, confidence, coercion and tie semantics.

**Finding:** resolver-owned scratch vectors remove Nemosyne-owned per-hit `Vector3` allocation from gaze scoring without mutating caller-owned gaze input.

**Hypothesis:** the change should reduce GC pressure and semantic-targeting frame-tail variance on Quest when dense hit sets occur. The local benchmark cannot establish that device-level effect.

**Speculation:** once Nemosyne-owned resolver allocation is reduced, Three.js intersection creation and hit-set size upstream may dominate the remaining semantic-selection cost. That should be measured before further resolver micro-optimization.

## Decision

Adopt the candidate as UXR0C3, subject to exact-head CI, CodeQL, promotion evidence, and adversarial review. Do not use this benchmark as Quest performance qualification. The next resource-efficiency measurement target is upstream intersection/hit-set production or the remaining desktop cursor residual, whichever device traces show to dominate.
