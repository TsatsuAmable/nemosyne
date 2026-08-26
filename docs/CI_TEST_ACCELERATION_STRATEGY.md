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

#438 introduced one shared cached development WASM artifact, three fatal-on-test-failure coverage shards, Vitest blob-report aggregation, and canonical global coverage enforcement only over the reconstructed full suite. The required `Node 24` fan-in remains dependent on the aggregate result.

The first live attempt failed closed and exposed three CI-mechanics defects: global thresholds being applied to partial shards, hidden report artifacts being skipped, and a WASM cache key hashing a nonexistent file. Those were fixed before #438 landed.

### Verification evidence

The successful #438 run reconstructed exactly the same 311 files and 1,661 tests as the unsharded baseline and reproduced the baseline coverage values above. Full required CI completed in about 3m07s versus about 4m22s for the representative Phase 1 run, roughly a 29% wall-time reduction even on the first cold-cache sharded run.

A same-commit warm-cache rerun also passed. Phase 2 remains **REVIEW ACTIVE**, not `VERIFIED COMPLETE`, until normal post-merge runs establish stable latency, runner-minute cost, and flake behavior across a broader sample.

## Phase 3: remove duplicate execution and separate endurance evidence

**Status:** PARTIALLY LANDED in project-engineering hygiene work.

The standalone `Coverage Assurance` workflow is now scheduled/manual only and serves as an **unsharded parity audit**. It no longer reruns the entire suite on every push to `main` immediately after required CI has already reconstructed and enforced complete sharded coverage. The periodic audit is weekly rather than daily because PR/main CI already supplies continuous deterministic coverage evidence.

Long-running workloads remain appropriate for scheduled/manual assurance when deterministic PR regressions protect the same property. Examples include extended parser/WASM ABI fuzz campaigns, Worker/runtime recovery soak, large resource-envelope sweeps, repeated physical-device/browser qualification, and long statistical simulation/calibration campaigns.

Any defect found by exploratory fuzz/soak work should become a deterministic PR regression where feasible.

## Test flake policy

- Do not use blind automatic retries to turn a required correctness failure green.
- Record and investigate repeated nondeterministic failures rather than normalizing them.
- A known flake that can mask a blocker is engineering debt with an owner and removal criterion.
- Duration-aware shard balancing should use several normal CI runs, not one anomalous measurement.
- If tests are quarantined for diagnosis, equivalent deterministic protection must remain in the required gate for the affected safety property.

## Workflow supply-chain policy

External GitHub Actions are pinned to immutable commit SHAs. Human-readable version comments preserve update intent, and the repository's existing Dependabot GitHub Actions configuration remains responsible for proposing updates. `npm run ci:actions-check` fails required static analysis if a mutable external action ref is introduced.

This does not eliminate action supply-chain risk, but it prevents an already-reviewed workflow from silently executing different code because a mutable major tag or branch moved.

## Developer feedback tiers

1. **Edit loop:** targeted test or relevant fast project while coding.
2. **Pre-push:** ownership-aligned type/lint/test checks.
3. **PR gate:** full authoritative parallel proof, merged global coverage, Rust, CodeQL, and production browser smoke.
4. **Scheduled assurance:** fuzz, soak, broad performance campaigns, and physical-device qualification.

Fast feedback is a convenience. It is not promotion evidence.

## Metrics

Track trends for time to first actionable failure, required fan-in completion, shard balance, cache effectiveness, browser-smoke delay, total runner minutes, flaky rerun rate, and escaped defects that an existing required test should have caught.

Optimize for feedback latency and resource efficiency while keeping escaped-defect and flake rates flat or improving.

## Relationship to RF-033

#437 landed the independent proof graph; #438 landed three-way sharding, one shared WASM build, and merged authoritative coverage. The hygiene tranche removes redundant coverage execution and makes external workflow dependencies immutable. Remaining RF-033 review work is operational measurement and duration-aware rebalancing only when multiple normal runs justify it.
