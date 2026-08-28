# P1-Q Q1 Rust Cadence Post-Review

**Date:** 28 August 2026  
**Pilot evidence head:** `7b1314d8ed4cc29b27ed731e21008f6900b47871`  
**Pilot PR:** #494  
**Merged pilot main:** `e09acba617e3654433ca0a391cec888943387ccf`  
**Status:** Q1 CLASSIFIED

## Executive disposition

- **cargo-nextest: REJECT for required/default Nemosyne test execution.** It preserved the exact current native Rust test inventory and produced good fail-closed diagnostics, but did not improve hosted wall time. The paired cold comparison was effectively tied/slightly slower than `cargo test`, while warm nextest execution was roughly twice the already-subsecond cargo warm time. Adding another required tool would therefore increase maintenance and supply-chain surface without buying cadence.
- **sccache: TARGETED ONLY / no required-lane adoption yet.** The isolated local-cache experiment demonstrated useful compiler-cache reuse, but the preserved-cache rebuild did not materially beat the existing required lane's already-cached Cargo target behavior once tool/bootstrap and durable cross-run cache wiring are considered. Keep sccache as an explicitly manual experiment until a future build-growth or cache-invalidation problem justifies a cross-run persistent-cache comparison.

The current required Rust command remains:

```text
cargo test --manifest-path wasm/Cargo.toml
```

No retry policy, reduced test selection, or replacement proof is introduced.

## Hosted runner evidence

Q1 workflow run `33165658384` completed successfully on both alternating runner orders and on the bounded sccache job.

Timing format is `wall seconds / max RSS KiB`.

| Runner order | cargo test cold | cargo test warm | nextest cold | nextest warm |
| --- | ---: | ---: | ---: | ---: |
| cargo-first | 54.18 s / 1,539,964 | 0.46 s / 45,164 | 53.96 s / 1,539,060 | 0.93 s / 51,180 |
| nextest-first | 50.09 s / 1,544,312 | 0.46 s / 44,872 | 51.52 s / 1,543,020 | 0.90 s / 51,292 |
| mean | **52.14 s** | **0.46 s** | **52.74 s** | **0.92 s** |

On mean cold wall time, nextest was about **1.2% slower**. On mean warm wall time, nextest was about **99% slower**, although both warm durations are operationally tiny.

The ordinary required Rust job on the same pilot head also showed why runner scheduling is not the dominant cost: with the existing Cargo target cache restored, compilation still took about **33.12 s**, while the complete 278-test execution itself took about **0.39 s**. The cadence bottleneck is compilation/cache reuse, not serial test-body runtime.

## Test inventory equivalence

Both runner-order artifacts were normalized and compared by exact test name:

- `cargo test -- --list`: **278 tests**;
- `cargo nextest list`: **278 tests**;
- cargo-only names: **0**;
- nextest-only names: **0**.

This is strong evidence that nextest did not omit current Nemosyne native Rust tests in this pilot. It is not evidence that future harness modes, doctests, browser/WASM tests, or changed Cargo configuration would remain equivalent automatically.

## Deliberate failure evidence

Both tools ran the same temporary two-test crate containing one passing control and one deliberate assertion failure.

- `cargo test` exited `101` and reported `1 passed; 1 failed`, the exact assertion values and source line.
- `cargo nextest run` exited `100` and likewise reported the failing test, assertion values/source line, captured stdout/stderr and final `1 passed / 1 failed` summary.

Both therefore remained fail-closed and diagnostically useful. Nextest's failure presentation is good, but diagnostic quality alone does not justify replacing a faster/equivalent existing required runner.

## sccache evidence

The sccache job disabled Cargo incremental compilation, fetched dependencies outside the timer and compared clean-target executions:

| Condition | Wall | Max RSS |
| --- | ---: | ---: |
| cargo test, no sccache, cold | 56.06 s | 1,543,984 KiB |
| cargo test, empty sccache, cold | 51.59 s | 1,546,612 KiB |
| cargo test, preserved sccache + target clean | 30.25 s | 1,542,344 KiB |

The empty-cache run improved wall time by about **8%** in this sample. Preserving the compiler cache across a target clean improved the isolated baseline by about **46%**.

`sccache --show-stats` recorded:

- 208 compile requests;
- 144 compile requests executed;
- 70 Rust cache hits and 70 Rust cache misses;
- 50% Rust cache-hit rate;
- 70 compilations;
- 56 non-compilation calls;
- 57 MiB local cache;
- no cache read/write errors or timeouts.

This proves compiler artifacts can be reused across a target clean. It does **not** prove a required GitHub Actions lane would become 46% faster, because the current lane already restores `wasm/target` through `actions/cache`, the benchmark excluded tool acquisition from timing, and the pilot used a local cache preserved inside one job rather than a persisted cross-run cache. The ordinary cached Rust job's roughly 33-second compile phase is already close to the 30.25-second preserved-sccache command result.

## Supply-chain and maintenance disposition

Neither nextest nor sccache is added as a repository dependency or required installer action. Pilot binaries were downloaded from upstream GitHub releases and checked against exact SHA-256 values before extraction.

Because nextest has no measured cadence benefit, there is no reason to add its update/install burden to required CI.

For sccache, a later experiment is justified only if Rust compilation cost grows materially or the existing target cache proves unstable across toolchain/dependency changes. Such an experiment must measure the complete required job with persistent cache restore/save overhead included, not just compiler cache-hit latency.

## Workflow retirement

PR #494 merged while this bounded post-review was being completed. To avoid turning a benchmark into a recurring CI tax by accident, the retained `Rust cadence pilot` workflow is changed to **`workflow_dispatch` only** in the classification follow-up. The harness remains reproducible on demand but no longer runs automatically on ordinary Rust/PR changes.

## Q1 final classification

### cargo-nextest: **REJECT**

Rejected as the default/required Nemosyne Rust runner on current evidence. Revisit only if the Rust suite becomes execution-bound, test concurrency becomes a demonstrated bottleneck, or a nextest-specific capability becomes independently valuable enough to justify its maintenance surface.

### sccache: **TARGETED ONLY**

Retain only as a manual benchmark capability. Do not wire it into required CI yet. A future promotion requires a persistent cross-run cache experiment measuring full hosted job wall time, cache transfer overhead, invalidation behavior and reliability against the current `actions/cache` target strategy.

## Evidence boundaries

Q1 says nothing about Rust mathematical validity, WASM/browser parity, Quest behavior, security, memory safety, or scientific correctness beyond the tests executed. It does not lower or replace any existing proof gate.

## Next quality tranche

Q1 is closed at the pilot/classification level. The next immediate parallel-safe P1-Q tranche is **Q2 property testing**, focused on high-authority invariants such as canonical identity, graph lineage, history/replay/digest behavior and Rust/TypeScript projection boundaries. Property tests must add falsification power without becoming a blanket random-test tax on every module.
