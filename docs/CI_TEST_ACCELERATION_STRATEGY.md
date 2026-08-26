# CI & Test Acceleration Strategy

## Goal

Reduce developer feedback latency without weakening Nemosyne's correctness, scientific, security, provenance, browser, or XR evidence standards.

The governing principle is:

> **Accelerate scheduling before reducing proof.** Parallelize independent evidence, remove duplicate execution, cache expensive build products, and shard only when all authoritative results still converge into the required merge gate.

## Quality invariants

CI acceleration must not:

- lower global coverage thresholds;
- delete authoritative tests merely because they are slow;
- replace production-path tests with mocks;
- make changed-files-only selection the sole required merge gate;
- turn flaky failures into allowed passes;
- move security, scientific-semantics, provenance, parser-boundary, worker-lifecycle, or production-path correctness tests out of the PR gate without an equivalent deterministic PR regression;
- treat scheduled fuzz/soak evidence as a substitute for deterministic merge-gate correctness.

## Phase 1 - Parallelize the existing proof graph

**Status:** landed in #437 and verified green on the merged implementation.

The previous CI job serialized:

1. WASM build,
2. typecheck,
3. lint,
4. the full coverage suite,
5. production build,
6. browser smoke only after all of the above.

These proofs do not all depend on each other. The CI graph is therefore split into independent jobs:

- **Static analysis:** `npm ci` -> typecheck -> lint.
- **Vitest coverage:** full deterministic coverage proof.
- **Production build:** build the same Vite production bundle and publish it as the smoke-test artifact.
- **Rust kernel:** run the existing Rust unit suite.
- **Chromium production smoke:** begin as soon as the production-build artifact exists rather than waiting for coverage/static analysis.
- **Node 24 aggregate gate:** remain required and fail unless every authoritative track succeeds.

No test was removed and no threshold was changed in Phase 1. The trade-off is somewhat higher parallel runner consumption in exchange for lower wall-clock feedback and earlier independent browser evidence.

## Phase 2 - Profile and shard Vitest with merged global coverage

**Status:** implementation active under RF-033.

### Measured baseline

The successful #437 coverage job establishes the initial baseline for the current deterministic coverage suite:

- 311 test files passed;
- 1,661 tests passed;
- Vitest wall time: 343.31 seconds;
- aggregate test execution reported by Vitest: 2,087.65 seconds;
- cached WASM dev build itself: approximately 1.4 seconds;
- global coverage: 82.59% statements, 76.73% branches, 86.36% functions, 83.66% lines.

The long tail is materially skewed: several individual files take roughly 14-51 seconds while many complete in well under one second. The test execution, not the cached WASM compilation, is therefore the dominant critical-path cost.

### Initial sharding design

Start with **three Vitest shards**. Three is intentionally conservative: Vitest already parallelizes within one runner, so excessive cross-runner sharding can spend substantially more runner minutes for diminishing wall-clock benefit.

Each shard:

1. performs the same deterministic checkout/toolchain/dependency setup;
2. builds the cached development WASM package;
3. runs `vitest run --coverage --shard=<n>/3 --reporter=blob` against the canonical coverage config;
4. uploads its blob report as an immutable per-shard artifact.

A separate aggregate `Vitest coverage` job:

1. fails closed unless every shard succeeded;
2. downloads all shard reports;
3. merges them with Vitest `--merge-reports` and coverage enabled;
4. evaluates the canonical `vitest.coverage.config.ts` global thresholds over the merged result.

The aggregate retains the existing job name `Vitest coverage`, and the required `Node 24` fan-in still depends on that aggregate. The merge gate therefore continues to require the complete deterministic suite rather than any individual shard.

### Why WASM is not a serial prep job in the first sharded design

The measured cached WASM build is approximately 1.4 seconds, while runner setup and the test suite dominate elapsed time. A shared preparation job would force every shard to wait for another checkout/toolchain/npm/artifact round trip before tests could begin. The first sharding tranche therefore duplicates the cheap cached WASM build in exchange for immediate shard parallelism.

If later measurements show WASM setup or dependency restoration becoming material, introduce a reusable artifact only when its fan-out benefit exceeds the serial dependency and artifact-transfer cost.

### Coverage rule

Per-shard percentages are not the quality gate because each shard sees only part of the codebase. The gate must evaluate **merged global coverage** against the repository's existing thresholds:

- statements: 50%;
- lines: 50%;
- functions: 50%;
- branches: 40%.

Those values remain defined by `vitest.coverage.config.ts`. They are not lowered, duplicated as a weaker authoritative policy, or replaced by per-shard thresholds.

### Acceptance evidence for Phase 2

Before RF-033 can treat sharding as landed, verify on the live PR path that:

- all three shards collectively execute the complete current coverage suite;
- the merged report has the expected total test-file/test counts for that commit;
- merged global coverage is consistent with the unsharded baseline, allowing only explainable source/test changes;
- the unchanged global thresholds are enforced by the merged aggregate;
- shard failure makes `Vitest coverage` and therefore `Node 24` fail;
- CodeQL, Rust, production build, and Chromium smoke remain unchanged authoritative gates;
- no tests are silently filtered out by sharding;
- required-gate wall time improves enough to justify additional runner minutes.

After several representative runs, rebalance shard count only from measured durations and runner-cost evidence.

## Phase 3 - Separate deterministic merge proof from exploratory endurance evidence

Some workloads are intrinsically unsuitable for every PR, including long fuzz campaigns, extended soak/endurance tests, large performance sweeps, and repeated physical-device qualification.

They may run on scheduled/manual workflows only when all of the following hold:

- the PR gate retains deterministic boundary and regression tests for the same safety property;
- any fuzz/soak-discovered defect is converted into a deterministic PR regression;
- scheduled failure is visible and owned rather than ignored;
- performance/device claims remain blocked until the required measured evidence exists.

Suitable scheduled evidence includes:

- extended Rust parser/WASM ABI fuzz campaigns;
- long worker/runtime recovery soak;
- large-scale resource-envelope sweeps;
- repeated browser/device qualification matrices.

Unsuitable candidates for removal from the PR gate include:

- authentication/authorization admission tests;
- replay and malformed-input regressions;
- statistical/scientific invariant tests;
- provenance identity and replay correctness;
- deterministic worker generation/staleness/failure tests;
- parser safety regressions discovered by fuzzing;
- production browser smoke.

## Developer feedback tiers

The repository can expose faster local commands without redefining the merge gate:

1. **Edit loop:** targeted test file or existing fast project while coding.
2. **Pre-push:** typecheck/lint plus the most relevant deterministic project(s).
3. **PR gate:** all parallel authoritative jobs, full merged coverage, Rust, CodeQL, and production browser smoke.
4. **Scheduled assurance:** fuzz, soak, broad performance campaigns, and other long-running evidence.

Fast local feedback is a convenience. It is not promotion evidence.

## Metrics

Track at least:

- time to first actionable failure;
- time to required `Node 24` completion;
- coverage-suite wall time;
- maximum and spread of shard wall times;
- WASM-build wall time and cache hit rate;
- browser-smoke start delay and duration;
- total runner minutes per PR;
- flaky rerun rate;
- percentage of merged defects that should have been caught by an existing required test.

Optimize primarily for time to first actionable failure and required-gate wall time while keeping escaped-defect and flaky-rerun rates flat or improving.

## Relationship to RF-033

This strategy is the execution plan for RF-033 CI/test-architecture work. Phase 1 removed unnecessary serialization and landed in #437. Phase 2 addresses the heavy Vitest critical path with measured three-way sharding and merged authoritative coverage. Phase 3 prevents exploratory assurance workloads from clogging normal development while preserving deterministic PR proof.
