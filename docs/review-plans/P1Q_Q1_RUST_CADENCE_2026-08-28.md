# P1-Q Q1 Rust Cadence Benchmark

**Date:** 28 August 2026  
**Baseline:** `main@688bf2e4ec4ae542a5ca39816022fcdeea38a859`  
**Branch:** `chore/p1q-q1-rust-cadence`  
**Status:** PILOT / NOT A REQUIRED GATE

## Question

Can Nemosyne replace the current required Rust `cargo test` execution with `cargo-nextest` and/or add `sccache` in a way that measurably reduces hosted CI wall time without reducing the Rust suite, changing pass/fail semantics, or creating disproportionate maintenance/supply-chain cost?

Q1 is a measurement pilot. The current required `Rust kernel` job remains unchanged until post-review evidence supports an explicit `ADOPT`, `TARGETED ONLY`, or `REJECT` decision.

## Current authority

The required Rust lane currently executes:

```text
cargo test --manifest-path wasm/Cargo.toml
```

on Ubuntu with the repository stable Rust toolchain. Q1 must compare against that real crate and command semantics. It may not substitute a synthetic benchmark for the Nemosyne suite.

## Tool versions and acquisition

The pilot pins:

- `cargo-nextest 0.9.143`, Linux x86_64 GNU release archive SHA-256 `66786b9abe23920d022a182d1416b1bbc8130dd4872a9553d76985a1708dcd1e`;
- `sccache 0.17.0`, Linux x86_64 musl release archive SHA-256 `67c4a96dd237c1f518f6b36083f270f9976d516f1e57fce891755ea782e50006`.

The pilot downloads those release archives directly, verifies the exact SHA-256 before extraction, and does not add a third-party installer action or repository dependency. Tool download/extraction and `cargo fetch` occur outside measured test timing.

These tools are pilot-only until the decision. A future adoption must separately decide the durable installation/update mechanism.

## Runner comparison

`.github/workflows/rust-cadence-pilot.yml` creates two fresh hosted-runner comparisons with opposite execution order:

1. `cargo-first`;
2. `nextest-first`.

Each runner:

1. fetches dependencies outside the timer;
2. cleans `wasm/target` before each runner's cold measurement;
3. measures a cold and immediately repeated warm execution for `cargo test`;
4. measures a cold and immediately repeated warm execution for `cargo nextest run`;
5. records wall time, maximum RSS, user CPU and system CPU using `/usr/bin/time`;
6. records both runners' test-list output after performance measurement;
7. runs the same deliberately failing two-test temporary crate under both runners and requires both commands to fail, retaining the failure output for diagnosis comparison.

Alternating order does not eliminate hosted-runner variance, but it prevents a single fixed ordering from masquerading as a tool advantage.

## sccache comparison

A separate fresh hosted runner performs a bounded compiler-cache experiment:

1. dependency fetch outside timing;
2. clean-target `cargo test` baseline with `CARGO_INCREMENTAL=0`;
3. empty local sccache store, clean target, then `cargo test` with `RUSTC_WRAPPER=sccache`;
4. clean target again while preserving the sccache store, then repeat the same command;
5. retain `sccache --show-stats` plus the same timing/RSS evidence.

This deliberately measures whether cacheable compilation survives a target clean. It does not assume the final cdylib/test link is cacheable and does not treat cache-hit percentage alone as a cadence win. Adoption requires an end-to-end command-time benefit that plausibly exceeds setup/maintenance cost in the real required lane.

## Semantics and evidence boundaries

Q1 may establish only Rust test-runner/cache fitness for the current native Rust test lane.

It does **not** establish:

- WASM/browser semantic parity merely because native Rust tests pass;
- scientific or statistical validity beyond the tests actually executed;
- Quest/device performance;
- absence of flaky tests;
- correctness from retrying failures;
- security or memory-safety proof.

No retry policy is introduced during the benchmark. If nextest is adopted, retries remain disabled unless separately justified so that a flaky failure cannot be cosmetically converted into green evidence.

## Acceptance criteria

Classify `cargo-nextest` **ADOPT** only if all of the following hold:

- both real Nemosyne runner orders complete successfully;
- test inventory review shows no material suite omission;
- deliberate failure evidence remains fail-closed and at least as diagnosable as current cargo output;
- cold/warm hosted measurements show a repeatable enough wall-time advantage to justify replacing, rather than adding to, `cargo test`;
- no incompatible test-process/global-state assumption is exposed;
- ordinary Node 24, CodeQL and current Rust CI remain green on the pilot PR.

Classify it **TARGETED ONLY** if it is useful for selected local/diagnostic workflows but not a convincing required-lane replacement. Classify it **REJECT** if semantics differ materially or the measured cadence benefit is negligible/negative.

Adopt `sccache` only if the preserved-cache rebuild materially improves end-to-end command time and the expected hosted cache wiring does not add more complexity/latency than it saves. Otherwise reject it or retain it only for targeted workflows.

## Post-review record

After hosted evidence finishes, add a bounded Q1 post-review record containing:

- exact PR head;
- per-order cold/warm measurements;
- test-inventory comparison;
- failure-output assessment;
- sccache timing and cache statistics;
- ordinary CI/CodeQL/review state;
- explicit `ADOPT`, `TARGETED ONLY`, or `REJECT` decisions for nextest and sccache;
- if adopted, the exact follow-up change allowed in required CI.

Do not modify the required Rust lane before that classification.
