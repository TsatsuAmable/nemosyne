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

## Phase 4: consolidate the PR workflow surface

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE.

The PR checks page had accumulated temporary pilots, evidence collectors and governance audits around the canonical merge gate. Several provided useful evidence when introduced, but continuing to run or emit them on every PR duplicated already-required proof and made one underlying condition appear as multiple failures.

The consolidated model is:

- `Node 24` remains the single required aggregate for deterministic application CI: static analysis, complete merged coverage, Rust tests, production build and Chromium smoke.
- `CodeQL SAST (javascript-typescript)` remains an independent required security signal.
- `approval-gate` owns promotion/governance evidence unique to it: live-ruleset drift, owner approval authority, exact-head identity, review disposition and the adversarial/promotion marker. GitHub's ruleset composes `Node 24`, CodeQL and `approval-gate`; the approval workflow does not poll the other required checks.
- `architecture:check` is enforced inside the existing `Static analysis` job. The standalone architecture workflow is retained only as a manual timing/RSS audit.
- the Q9 promotion-controller workflow is retained as an explicit manual exact-head governance audit rather than a second per-PR copy of `approval-gate`.
- the Q8 supply-chain pilot runs on PRs only when dependency manifests, lockfiles, toolchain or supply-chain policy files change. `cargo-deny` also runs weekly and on manual dispatch so newly published Rust advisories remain visible without taxing ordinary PRs; GitHub Dependency Review remains PR-only because it requires a change diff.
- the heavier UV0 instrumented screenshot baseline runs automatically only when its compile-gated evidence seam or harness changes, while ordinary production/browser behavior remains protected by required CI.
- legacy Q3D and Stream A A1 resource-envelope workflows are manual reproduction tools rather than skipped checks emitted on every PR.
- wiki publication still watches `src/**` on `main` because the generated codebase index depends on exported TypeScript symbols, but source-only PRs no longer run a validation job that cannot detect drift against a committed wiki artifact.

### Permanent-workflow admission rule

A new permanent PR job must protect a **distinct defect class** that is not already represented by an existing required signal. Experimental jobs must define an exit condition: graduate the minimum useful deterministic check into canonical CI, narrow it to the affected change surface, move it to scheduled/manual assurance, or retire it.

The desired ordinary-PR shape is three required check names (`Node 24`, CodeQL and `approval-gate`) with non-required jobs appearing only when the PR changes their relevant evidence surface.

## Phase 5: make assurance earn its cost

**Status:** POLICY LANDED; operational measurement is ongoing.

Nemosyne treats review and CI mechanisms as engineering components with maintenance cost, not as permanent rituals. A mechanism remains in the default PR path only while it protects a distinct failure class or enforces a necessary merge invariant.

For every permanent PR-time assurance mechanism, be able to answer:

1. **What unique failure class does it protect?** If the answer is identical to another required mechanism, consolidate them.
2. **What is its cheapest authoritative form?** Prefer one deterministic regression inside canonical CI over a second workflow that proves the same property.
3. **Does every PR need it?** If only a path, dependency, research treatment or platform surface can trigger the defect, path-scope it or move it to scheduled/manual assurance.
4. **What makes it retire?** Pilots and temporary gates need an explicit graduation, narrowing or deletion condition.

Review depth follows the same rule. High-risk changes retain pre-implementation plus post-implementation adversarial review. Standard-risk behavior changes receive one bounded post-implementation falsification pass. Low-risk non-semantic changes may use the exemption. Additional reviewers are justified only when they attack materially different failure classes.

Documentation is evidence only when it preserves durable truth. Routine review narration belongs in the PR body; separate review-plan/review files are reserved for programme/research evidence, milestone/finding closure, or future audit needs. `ROADMAP.md` changes only when status, sequence, a durable finding or completion truth changes.

### Periodic value review

Evaluate the default assurance surface over rolling batches of roughly **30-50 merged PRs** rather than reacting to one anomalous run. Use repository history and Actions data already emitted by GitHub; do not add another always-on workflow solely to measure the workflows.

A permanent mechanism is a candidate for consolidation, scoping or retirement when, over that window:

- it catches no distinct actionable failure and another required mechanism exercises the same property;
- most failures are duplicates of one underlying condition already surfaced earlier;
- it is regularly skipped/unrelated to the changed surface;
- its flake/non-actionable failure rate creates more rework than useful signal;
- or its latency/runner cost is material while the protected property can be enforced more cheaply at an authoritative layer.

Do not retire a mechanism merely because it has been green. A low-frequency security, scientific-integrity or recovery invariant may be valuable precisely because it prevents rare high-impact regressions. Retirement requires evidence of **redundancy**, not simply absence of recent failure.

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
3. **PR gate:** full authoritative parallel proof, merged global coverage, Rust, CodeQL, architecture policy, and production browser smoke.
4. **Scheduled/manual assurance:** fuzz, soak, broad performance campaigns, physical-device qualification, baseline evidence capture and independent governance audits.

Fast feedback is a convenience. It is not promotion evidence.

## Metrics

Track trends for time to first actionable failure, required fan-in completion, shard balance, cache effectiveness, browser-smoke delay, total runner minutes, flaky rerun rate, duplicate-failure amplification, unrelated non-required checks per PR, and escaped defects that an existing required test should have caught.

For assurance-value reviews, also classify whether a failure was **distinct/actionable**, **duplicate of an already surfaced root cause**, **infrastructure/flake**, or **unrelated/skipped**. The goal is not to maximize defect counts; it is to identify mechanisms that add independent information.

Target a typical required wall-clock of five minutes or less, three required check names, and near-zero unrelated non-required jobs on an ordinary PR. Optimize for feedback latency and resource efficiency while keeping escaped-defect and flake rates flat or improving.

## Relationship to RF-033

#437 landed the independent proof graph; #438 landed three-way sharding, one shared WASM build, and merged authoritative coverage. Subsequent hygiene work removed redundant coverage execution, made external workflow dependencies immutable, consolidated duplicate PR-time evidence around the canonical required gate, and introduced an explicit assurance-value/retirement policy. Remaining RF-033 review work is operational measurement and duration-aware rebalancing only when multiple normal runs justify it.