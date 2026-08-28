# P1-Q Engineering Quality & Cadence — Post-Review

**Date:** 28 August 2026  
**Baseline:** `main@8d91dff40ab9d66e22c4aa13701d04a3623edb04`  
**Branch:** `docs/p1q-engineering-quality-cadence`

## Result

The P1-Q programme is coherent as an engineering substrate and does not alter Nemosyne product/scientific authority. The immediate Q0-Q3 pilots are parallel-safe with the current RF-015 measurement and P1-USIM work. Q4-Q7 remain targeted/scheduled or prerequisite-gated. Q8/Q9 may become low-cost governance gates only after bounded pilots demonstrate signal and acceptable cost.

## Adversarial findings and dispositions

1. **Tool sprawl / CI tax** — rejected blanket adoption. Every new required gate must first measure defect signal, wall-clock cost and maintenance burden. Mutation, fuzz, Miri, formal-model and network-chaos campaigns default to targeted/scheduled execution.
2. **Architecture-rule brittleness** — Q0 must encode durable dependency/authority constraints, with positive/negative fixtures and explicit classified exceptions. File-name pattern policing alone is insufficient.
3. **Test-speed evidence loss** — Q1 may replace equivalent `cargo test` execution with `cargo-nextest` only if semantics, coverage and failure behavior agree. It must not create a second duplicate Rust test lane. `sccache` is retained only on measured end-to-end benefit.
4. **Generative-test non-reproducibility** — Q2 requires bounded generators and preservation of failing seeds/shrunk examples as deterministic regressions.
5. **Diagnostic data leakage** — Playwright/DevTools/heap/network artifacts can contain scientific data, credentials or tokens. Q3 is synthetic/CI-first; retained artifacts must be sanitized, and production/user heap snapshots are forbidden absent an explicit governed retention policy.
6. **Mutation-score inflation** — mutation score is not a project-quality KPI. Surviving meaningful mutants are used to improve deterministic/property tests; repository-wide mutation is not a required PR gate.
7. **Fuzz/Miri overclaim** — campaign success does not prove absence of defects or WASM/browser memory safety. Every discovered issue becomes a minimized deterministic regression; Miri-compatible native scope is stated explicitly.
8. **Network-tool authority mismatch** — Toxiproxy can perturb signalling/WebSocket/TCP-style service paths but is not a faithful WebRTC data-channel impairment tool. Q6 now requires a `tc/netem`-class lower-level emulator or proven WebRTC-specific harness before peer data-plane loss/jitter/partition claims.
9. **Formal-model drift** — TLA+/Apalache is limited to state machines whose interleavings justify the maintenance cost; model invariants/counterexamples must map back to production tests/runtime assertions.
10. **Dependency-tool duplication** — Q8 preserves Dependabot as update automation; Dependency Review/cargo-deny are preventive policy candidates, not a second dependency-update programme and not a substitute for the deferred post-UI modernization sprint.
11. **Promotion-controller false approval** — Q9 coordinates with RF-052 and may enforce exact-head evidence/promotion state but must never manufacture or imply independent approval that repository policy does not actually require.

## Priority

Implementation order remains:

1. Q0 architecture-policy pilot;
2. Q1 cargo-nextest/sccache benchmark;
3. Q2 property-testing pilots;
4. Q3 failure-evidence/agent-runtime diagnostics;
5. Q8/Q9 after pilot evidence;
6. Q5/Q4 targeted assurance under owning RFs;
7. Q6 after collaboration authority and real service-path prerequisites;
8. Q7 only where state-space/interleaving risk warrants a maintained model.

This order improves ordinary engineering feedback first and reserves expensive assurance for the boundaries where it can actually falsify important claims.

Status: **PLANNING LANDED ON BRANCH / IMPLEMENTATION NOT STARTED**.
