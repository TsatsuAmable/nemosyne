---
name: nemosyne-runtime-review
description: Use when reviewing Nemosyne for correctness bugs, Worker/WASM lifecycle failures, memory growth, repeated computation, dataset-copy overhead, or replay tests that pass without proving success.
---

# Nemosyne runtime review

Review the real investigation path for correctness and avoidable work. Default to findings and recommendations; implement fixes only when requested. This skill is review guidance, subordinate to the repository's current AGENTS.md, vision, roadmap, and executable configuration.

## Establish the review boundary

- Locate the repository; do not assume a machine-specific path. Record HEAD, worktree status, scope, and live remote-main comparison when available. An unavailable remote check does not prevent a clearly labelled local review.
- Read relevant current authorities. Discover commands and toolchain requirements from executable configuration. Do not inherit historical test counts, versions, or status claims.
- Use [review patterns](references/review-patterns.md) for the affected boundaries. Consult [historical findings](references/historical-findings.md) only as leads to revalidate, never as proof of current defects.

## Trace and falsify

Follow input → application orchestration → Worker registration/execution → Rust/WASM → result adoption → presentation/persistence. For each suspected defect, locate the real caller, owner, cleanup path, and test that should reject the forbidden behaviour.

Prioritise five failure classes:

1. **Residency disagreement:** caller believes a dataset is resident after the Worker has evicted it. Check concurrent readers/mutations, queued work, failed adoption, and recovery.
2. **Lifetime disagreement:** dataset/runtime destruction leaves semantic authority, buffers, or caches alive. Count retained metadata separately from WASM capacity and process memory.
3. **Repeated analytical work:** buffer-sizing and result-read calls each rebuild the same result. Trace into Rust; do not assume a sizing call is cheap.
4. **Copy amplification:** multiple layers defensively clone, serialise, fingerprint, or register the same dataset. Count work across the full production call chain.
5. **False-positive evidence:** a positive journey accepts failure, only checks text, or relies on mocks that omit the relevant ownership transition.

Use the smallest authoritative falsifier. Temporary probes belong outside tracked source; any repository edits follow its worktree and lease rules. Mock transport probes establish port behaviour, not real Worker/kernel correctness. Static call-graph evidence can establish duplicate work, but cannot establish a measured speedup.

Retain Rust/WASM analytical authority, missing-value semantics, durable identity, provenance, and runtime-local handle ownership in every proposed optimisation. Do not replace correct computation with a JavaScript fallback or silently weaken assertions.

## Report

Lead with prioritised findings, each containing:

- severity and confidence/evidence class;
- concrete trigger, production path, and observable consequence;
- current file/line anchors;
- evidence obtained and what remains unverified;
- smallest justified fix and a regression falsifier.

Separate reproduced defects, statically established defects/redundant work, and profiling hypotheses. A defective test does not prove the product is broken. Green focused tests do not establish repository-wide health. Report exact commands/results, unrun checks, reviewed SHA, and whether files changed. Prefer fewer supported findings to speculative breadth.
