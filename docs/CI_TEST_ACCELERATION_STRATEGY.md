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

**Status:** implementation in this tranche.

The previous CI job serialized:

1. WASM build,
2. typecheck,
3. lint,
4. the full coverage suite,
5. production build,
6. browser smoke only after all of the above.

These proofs do not all depend on each other. The CI graph is therefore split into independent jobs:

- **Static analysis:** `npm ci` -> typecheck -> lint.
- **Vitest coverage:** build the test WASM package -> run the existing full coverage suite and existing thresholds.
- **Production build:** build the same Vite production bundle and publish it as the smoke-test artifact.
- **Rust kernel:** run the existing Rust unit suite.
- **Chromium production smoke:** begin as soon as the production-build artifact exists rather than waiting for coverage/static analysis.
- **Node 24 aggregate gate:** remain required and fail unless every authoritative track succeeds.

No test is removed and no threshold is changed in Phase 1. The trade-off is somewhat higher parallel runner consumption in exchange for materially lower wall-clock feedback.

## Phase 2 - Profile and shard Vitest with merged global coverage

Only begin after Phase 1 timings are collected from several representative PRs.

### Method

1. Record per-file or per-project durations from representative full-suite runs.
2. Identify the long tail rather than assuming file count predicts cost.
3. Form stable balanced shards by measured duration and capability requirements.
4. Run shards in parallel.
5. Emit raw coverage from every shard.
6. Merge coverage before evaluating the existing global thresholds.
7. Make the aggregate coverage result required.

### Shard boundaries

Prefer semantic/capability boundaries where they help setup reuse, but balance by measured duration. Candidate groups include:

- pure TypeScript/unit and deterministic orchestration;
- Moneta/scientific semantics and provenance;
- WASM-backed analytical integration;
- network/security/worker lifecycle;
- VR UI/interaction integration that does not require a real browser;
- heavy deterministic regression suites.

Do not create a 'slow but optional' shard for authoritative correctness.

### Coverage rule

Per-shard percentages are not meaningful as the quality gate because each shard sees only part of the codebase. The gate must evaluate **merged global coverage** against the current repository thresholds. Sharding must not lower or silently reinterpret those thresholds.

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
- WASM-build wall time and cache hit rate;
- browser-smoke start delay and duration;
- total runner minutes per PR;
- flaky rerun rate;
- percentage of merged defects that should have been caught by an existing required test.

Optimize primarily for time to first actionable failure and required-gate wall time while keeping escaped-defect and flaky-rerun rates flat or improving.

## Relationship to RF-033

This strategy is the execution plan for the remaining RF-033 CI/test-architecture work. Phase 1 removes unnecessary serialization. Phase 2 addresses the heavy Vitest critical path with measured sharding and merged coverage. Phase 3 prevents exploratory assurance workloads from clogging normal development while preserving deterministic PR proof.
