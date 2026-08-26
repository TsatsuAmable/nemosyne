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
- global coverage: 82.59% statements, 76.73% branches, 86.36% functions, 83.66% lines.

The long tail is materially skewed: several individual files take roughly 14-51 seconds while many complete in well under one second. Test execution is therefore the dominant critical-path cost once the WASM package is available.

### Initial sharding design

Start with **three Vitest shards**. Three is intentionally conservative: Vitest already parallelizes within one runner, so excessive cross-runner sharding can spend substantially more runner minutes for diminishing wall-clock benefit.

The first live sharded run exposed three CI-mechanics issues before aggregate verification:

1. the canonical global thresholds were correctly applied by Vitest to each partial shard, causing every shard to fail even though partial-shard coverage is not a meaningful repository-wide quality measure;
2. the dot-prefixed `.vitest-reports` directory was skipped by `actions/upload-artifact` because hidden files are excluded by default;
3. the existing WASM cache key hashed a nonexistent `wasm/Cargo.lock`, producing the degenerate key `Linux-wasm-target-`; a stable Rust toolchain refresh then caused each shard to spend roughly 37 seconds rebuilding the same WASM package.

The corrected design therefore separates collection from enforcement and removes duplicated WASM compilation:

1. **Coverage WASM package:** build the development WASM package once, with a cache keyed from the actual `wasm/Cargo.toml` and `rust-toolchain.toml`, then publish `wasm/pkg` as an artifact.
2. **Three coverage shards:** download the identical WASM artifact, execute one third of the deterministic suite, collect coverage, and emit a non-hidden blob report. Test failures remain fatal. A narrowly scoped `NEMOSYNE_COVERAGE_REPORT_ONLY=1` flag suppresses only the repository-global coverage threshold check while a partial shard is being collected.
3. **Aggregate `Vitest coverage`:** fail unless every shard succeeded, download all three blob reports, merge them with Vitest, and run the canonical coverage config without the report-only flag.
4. **Required `Node 24`:** continue to depend on the aggregate `Vitest coverage` result exactly as before.

This follows Vitest's supported distributed-testing model: shards emit blob reports with coverage and the final merge reconstructs the complete test and coverage result.

### Coverage authority

The repository's canonical global thresholds are unchanged:

- statements: 75%;
- lines: 75%;
- functions: 70%;
- branches: 60%.

They remain defined in `vitest.coverage.config.ts` and are enforced by the merged aggregate. The report-only shard mode does not define substitute thresholds and is never used by the aggregate required check.

A partial shard is not a coverage-policy decision. It is one fragment of the evidence needed to calculate the global decision. Applying global thresholds independently to each fragment would be mathematically incorrect because each shard intentionally executes only a subset of the tests.

### WASM fan-out rationale

The first live run showed that duplicating the WASM build can be expensive when the toolchain/cache changes: one shard spent about 37 seconds compiling the development package. Building the package once and fanning out the artifact removes two redundant Rust/WASM builds without changing the tested binary within the shard set.

The cache key now hashes files that actually exist, `wasm/Cargo.toml` and `rust-toolchain.toml`, rather than the nonexistent `wasm/Cargo.lock`. Cache effectiveness and toolchain-refresh behavior remain measured evidence, not assumptions.

### Acceptance evidence for Phase 2

Before RF-033 can treat sharding as landed, verify on the live PR path that:

- all three shards collectively execute the complete current coverage suite;
- the merged report has the expected total test-file/test counts for that commit;
- merged global coverage is consistent with the unsharded baseline, allowing only explainable source/test changes;
- the unchanged 75/75/70/60 global thresholds are enforced by the merged aggregate;
- shard failure makes `Vitest coverage` and therefore `Node 24` fail;
- the shared WASM artifact is present and verified before each shard executes;
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

This strategy is the execution plan for RF-033 CI/test-architecture work. Phase 1 removed unnecessary serialization and landed in #437. Phase 2 addresses the heavy Vitest critical path with measured three-way sharding, one shared WASM build, and merged authoritative coverage. Phase 3 prevents exploratory assurance workloads from clogging normal development while preserving deterministic PR proof.
