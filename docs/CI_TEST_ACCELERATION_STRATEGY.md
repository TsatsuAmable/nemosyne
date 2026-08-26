# CI and Test Acceleration Strategy

## Goal

Reduce developer feedback latency without weakening Nemosyne's correctness, scientific, security, provenance, browser, or XR evidence standards.

The governing principle is:

> **Accelerate scheduling before reducing proof.** Parallelize independent evidence, remove duplicate execution, cache expensive build products, and shard only when all authoritative results still converge into the required merge gate.

Executable CI topology lives in `.github/workflows/ci.yml`. Coverage thresholds and inclusion policy live in `vitest.coverage.config.ts`. This document records strategy and measured evidence, not duplicate machine configuration.

## Quality invariants

CI acceleration must not:

- lower or bypass the canonical global coverage policy;
- delete authoritative tests merely because they are slow;
- replace production-path tests with mocks;
- make changed-files-only selection the sole required merge gate;
- turn flaky failures into allowed passes or hide them behind automatic retries;
- move deterministic security, scientific-semantics, provenance, parser-boundary, Worker-lifecycle, or production-path regressions out of PR CI without equivalent required evidence;
- treat scheduled fuzz/soak evidence as a substitute for deterministic merge-gate correctness.

## Phase 1: independent proof tracks

**Status:** LANDED in #437.

The old monolithic CI path serialized static analysis, full coverage, production build, and browser smoke. #437 split these into independent proof tracks with a strict final `Node 24` fan-in. Browser smoke can now begin as soon as the tested production bundle exists instead of waiting behind the coverage suite.

No test or required evidence class was removed.

## Phase 2: sharded Vitest with merged global coverage

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE via #438.

### Baseline before sharding

A representative successful #437 coverage run executed:

- 311 test files;
- 1,661 tests;
- 343.31 seconds Vitest wall time;
- 2,087.65 seconds aggregate test execution;
- 82.59% statement, 76.73% branch, 86.36% function, and 83.66% line coverage.

These are dated measurements, not policy values.

### Landed design

#438 introduced:

1. one cached development WASM build published as an artifact;
2. three independent coverage shards consuming the identical WASM artifact;
3. test failures remaining fatal on every shard;
4. shard-local coverage collection without pretending a partial shard can satisfy repository-global coverage policy;
5. Vitest blob-report merge in the aggregate `Vitest coverage` job;
6. canonical global coverage enforcement only after the complete distributed result is reconstructed;
7. the existing required `Node 24` fan-in remaining dependent on that aggregate result.

The first live attempt failed closed and exposed three CI-mechanics defects: global thresholds being applied to partial shards, hidden report artifacts being skipped, and a WASM cache key hashing a nonexistent file. Those were fixed before #438 landed.

### Verification evidence

The successful #438 run reconstructed exactly the same 311 files and 1,661 tests as the unsharded baseline and reproduced the baseline coverage values above. Full required CI completed in about 3m07s versus about 4m22s for the representative Phase 1 run, roughly a 29% wall-time reduction even on the first cold-cache sharded run.

A same-commit warm-cache rerun also passed. The corrected WASM cache key hit successfully and avoided repeating the full cold compilation across all three shards.

Phase 2 remains **REVIEW ACTIVE**, not `VERIFIED COMPLETE`, until normal post-merge runs establish stable latency, runner-minute cost, and flake behavior across a broader sample.

## Phase 3: remove duplicate execution and separate endurance evidence

**Status:** ACTIVE.

The next optimization should remove redundant work before adding more shards. In particular, the standalone `.github/workflows/coverage.yml` currently performs another full unsharded coverage run on every push to `main`, immediately after required PR CI has already reconstructed and enforced full merged coverage. The useful scheduled/manual assurance role should be preserved, but duplicate post-merge execution should be removed.

Long-running workloads are appropriate for scheduled/manual assurance when deterministic PR regressions continue to protect the same property. Examples include:

- extended Rust parser/WASM ABI fuzz campaigns;
- Worker/runtime recovery soak;
- large resource-envelope sweeps;
- repeated physical-device/browser qualification;
- long statistical simulation/calibration campaigns.

Any defect found by exploratory fuzz/soak work should become a deterministic PR regression where feasible.

## Test flake policy

- Do not use blind automatic retries to turn a required correctness failure green.
- Record and investigate repeated nondeterministic failures rather than normalizing them.
- A known flake that can mask a blocker should be treated as engineering debt with an owner and removal criterion.
- Duration-aware shard balancing should use several normal CI runs, not one anomalous measurement.
- If tests are quarantined for diagnosis, equivalent deterministic protection must remain in the required gate for the affected safety property.

## Developer feedback tiers

1. **Edit loop:** targeted test or relevant fast project while coding.
2. **Pre-push:** ownership-aligned type/lint/test checks.
3. **PR gate:** full authoritative parallel proof, merged global coverage, Rust, CodeQL, and production browser smoke.
4. **Scheduled assurance:** fuzz, soak, broad performance campaigns, and physical-device qualification.

Fast feedback is a convenience. It is not promotion evidence.

## Metrics

Track trends for:

- time to first actionable failure;
- time to required fan-in completion;
- coverage-suite and shard wall time;
- maximum shard imbalance;
- WASM-build time and cache effectiveness;
- browser-smoke start delay and duration;
- total runner minutes per PR;
- flaky rerun rate;
- escaped defects that an existing required test should have caught.

Optimize for feedback latency and resource efficiency while keeping escaped-defect and flake rates flat or improving.

## Relationship to RF-033

This strategy is the execution record for RF-033. #437 landed the independent proof graph; #438 landed three-way sharding, one shared WASM build, and merged authoritative coverage. The remaining review work is operational measurement, shard balancing if supported by evidence, duplicate-work removal, and clean separation of deterministic PR proof from exploratory endurance assurance.
