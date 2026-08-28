# P1-Q Engineering Quality & Cadence Substrate

**Date:** 28 August 2026  
**Baseline:** `main@8d91dff40ab9d66e22c4aa13701d04a3623edb04`  
**Status:** PLANNED ENABLER / IMPLEMENTATION NOT STARTED

## Purpose

Improve Nemosyne engineering quality and delivery cadence by adding tools that attack failure classes the current test stack does not cover well, while avoiding a permanent merge-time tax on unrelated work.

P1-Q is an engineering substrate, not a fourth product stream. Each capability belongs to an existing Stream A/B/C or RF owner. Cheap deterministic checks may become ordinary PR gates; expensive mutation, fuzz, Miri, formal-model and network-chaos campaigns remain targeted or scheduled unless a specific risk justifies promotion to required status.

## Governing rules

1. **No evidence inflation.** A tool only proves the invariant it actually exercises. Mutation score is not correctness; emulator green is not Quest qualification; fuzzing is not a proof of memory safety; a formal model is not evidence that production code implements the model.
2. **Authority first.** Tooling may inspect, perturb or validate authoritative paths, but must not introduce new analytical, security, persistence or input authorities.
3. **Measure before requiring.** Any new required CI gate must first demonstrate material defect-catching value and acceptable wall-clock cost.
4. **Keep failure diagnosis first-class.** A red gate should emit enough evidence to reproduce and understand the failure without log archaeology.
5. **Target expensive assurance.** Mutation, fuzz, Miri, TLA+/Apalache and network fault campaigns attach to high-risk boundaries and scheduled hardening, not every PR by default.
6. **Preserve exact-head promotion.** Tool output is only promotion evidence for the exact candidate SHA.

## Q0 — Architecture policy engine — HIGH VALUE / LOW-MEDIUM COST

Evaluate and, if fit, adopt `dependency-cruiser` for dependency-direction rules and `ast-grep` for structural source rules across TypeScript and Rust.

Initial rule candidates:

- prevent VR/presentation layers from importing analytical implementation internals;
- prevent TypeScript analytical fallbacks or new N-dependent scientific computation outside governed adapters;
- forbid `dataset.rows` traversal in known scale-sensitive presentation/embodiment layers unless explicitly allowlisted;
- require production Worker construction through the governed Worker factory/port;
- prevent durable/security-sensitive IDs from weak randomness helpers;
- prevent new production endpoint literals outside the relevant service/config authority;
- detect new direct semantic callbacks that bypass `InputRouter`/Atlas authorities;
- preserve known Moneta/Atlas/Rust dependency direction and prohibit new cycles across architectural layers.

Acceptance:

- run against current `main` and classify every initial violation as real defect, deliberate exception or false positive;
- no blanket suppressions;
- source rules have focused fixtures proving both detection and allowed forms;
- PR wall-clock cost is measured before making the gate required;
- rules encode durable architecture, not temporary filenames that will immediately rot.

Primary owners: Stream B architecture review, RF-001/RF-036/RF-055/RF-058, P1-U authority boundaries.

## Q1 — Rust test cadence benchmark — HIGH VALUE / LOW COST

Benchmark `cargo-nextest` against current `cargo test` using the real Nemosyne Rust suite and CI-like clean/warm cache conditions.

Measure:

- cold and warm wall time;
- test-process isolation behavior;
- failure output quality;
- flaky/retry semantics where applicable;
- compatibility with the WASM crate and existing scripts;
- CI artifact/log behavior.

Adopt only if the measured result improves cadence without reducing coverage or changing test semantics.

Also run a bounded `sccache` experiment for cacheable Rust compilation units. Do not assume benefit for final `cdylib` linking; retain only if measured end-to-end CI time improves.

Primary owners: CI/engineering governance, RF-009/RF-034/RF-052.

## Q2 — Property-based testing pilots — VERY HIGH QUALITY VALUE / MEDIUM COST

Use `fast-check` in TypeScript and `proptest` in Rust for invariants that are poorly represented by example tests.

Pilot properties:

- canonical dataset serialize/deserialize preserves scientific identity;
- graph transforms preserve valid lineage and cannot manufacture invalid endpoints;
- history `undo -> branch -> undo/seek` reconstructs the exact intended version;
- result/session materialization preserves schema-v2 compatibility and semantic digest;
- presentation-only state does not alter scientific digest;
- row-view compaction/materialization preserves authoritative fingerprints;
- malformed resource descriptors/refusal inputs fail closed at authoritative boundaries;
- Rust/TypeScript canonical projections remain cross-language equivalent over generated bounded datasets.

Every generator must be bounded and every failure seed/shrunk case must be retained as a deterministic regression when it reveals a defect.

Primary owners: Stream B; RF-044/RF-046/RF-047/RF-048/RF-051 and graph/session/history work.

## Q3 — Failure Evidence Pipeline / Agent Runtime Observatory — VERY HIGH CADENCE VALUE / MEDIUM COST

Turn browser/XR failures into reproducible diagnostic bundles rather than verdict-only CI.

For failing Playwright/IWER/product-path scenarios, retain where available:

- Playwright trace;
- screenshot/video at failure;
- browser console and page errors;
- relevant network requests/failures;
- semantic scene snapshot / scene-inspector output;
- XR simulator/device profile and deterministic input scenario ID;
- Worker generation/runtime state summary;
- relevant browser memory/performance measurements;
- exact source SHA, production bundle identity and WASM hash.

Evaluate Chrome DevTools MCP (or equivalent DevTools Protocol automation) for isolated agent/debug environments so engineering agents can inspect console/network/performance/heap state while also consuming Nemosyne semantic scene/evidence state. Do not expose normal user browser profiles or secrets to agent tooling.

Primary owners: Stream B and XR Agent Harness; RF-008/RF-015/RF-033/RF-050/RF-053/RF-056 and P1-USIM.

## Q4 — Mutation testing — HIGH QUALITY VALUE / EXPENSIVE, TARGETED

Pilot `cargo-mutants` on small, high-authority Rust modules and a fit TypeScript mutation tool only if a bounded pilot demonstrates useful signal.

Candidate Rust targets:

- canonical identity/digest primitives;
- resource/refusal predicates;
- graph/topology validation;
- ABI descriptor validation;
- deterministic analytical helpers where changed behavior should always be caught.

Do not run repository-wide mutation testing on every PR. Use scheduled or tranche-specific campaigns and convert surviving meaningful mutants into stronger deterministic/property tests.

Primary owners: Stream B, RF-043/RF-046/RF-048/RF-058.

## Q5 — Fuzz / UB / WASM artifact assurance — VERY HIGH BOUNDARY VALUE / TARGETED

Combine:

- `cargo-fuzz` for attacker-reachable Rust parsers/ABI/typed buffers/handles;
- Miri-compatible native subsets for UB classes where the code can execute under Miri;
- Bytecode Alliance `wasm-tools` to validate/inspect the emitted WASM and support bounded mutate/shrink experiments where useful.

Campaign targets inherit RF-043 requirements: malformed/truncated CSV/JSON, Unicode/numeric extremes, typed metadata/validity/shape mismatches, pointer/length/handle abuse, allocation/reinitialization and parser/package stress.

Rules:

- no claim that Miri proves the WASM runtime or browser embedding safe;
- no claim that fuzzing proves absence of bugs;
- discovered crashes/semantic defects become minimal deterministic regressions;
- campaigns are scheduled or risk-triggered unless their execution cost becomes sufficiently low.

Primary owners: Stream C/RF-043, RF-053 artifact qualification.

## Q6 — Network fault injection — HIGH VALUE AFTER LIVE AUTHORITY FIXES

Evaluate Toxiproxy or an equivalent deterministic TCP/network fault injector for deployed/contract-faithful signalling and other external service paths.

Scenarios:

- latency/jitter and bandwidth constraints;
- mid-session service disappearance;
- stalled reads/writes;
- reconnect storms;
- slow close/half-open behavior where representable;
- recovery after transient partition.

Use IWER/multi-browser clients to drive embodied collaboration while the proxy perturbs the real network path. The security/correctness claim remains owned by the signalling/WebRTC/session authorities, not the proxy.

Entry gate: RF-037/RF-038/RF-057 authoritative collaboration fixes landed and a production/contract-faithful service path exists.

Primary owners: Stream C, RF-054/RF-057/RES-02.

## Q7 — Small-state formal models — HIGH VALUE FOR SELECTED STATE MACHINES / TARGETED

Evaluate TLA+/Apalache for a small number of concurrency/state-machine risks where interleavings are expensive to enumerate by tests.

Initial candidates:

- Worker generation, supersession, residency and stale-result rejection;
- collaboration admission/reconnect/replay-sequence ownership;
- dataset-version/history branching and restore identity;
- Direct Touch capture/modality arbitration if implementation complexity remains high after simulator evidence.

Required discipline:

- model scope and assumptions are explicit;
- bounded model success is not treated as implementation proof;
- every model invariant maps to production-path tests or runtime assertions where practical;
- model counterexamples become deterministic regressions before closure.

Primary owners: Stream B for runtime/history; Stream C for collaboration; P1-USIM/RF-049 only if needed.

## Q8 — Supply-chain prevention — HIGH VALUE / LOW COST

Evaluate:

- GitHub Dependency Review on PRs for newly introduced vulnerable dependencies;
- `cargo-deny` for Rust advisories, licences, banned/duplicate crates and source policy.

Keep Dependabot as the update mechanism unless a measured need justifies replacement. Do not introduce Renovate merely to duplicate current update automation.

Primary owners: Stream C / RF-041/RF-058 and dependency-modernization backlog.

## Q9 — Exact-head promotion controller — VERY HIGH GOVERNANCE VALUE / MEDIUM COST

Replace promotion races with one explicit merge authority.

A governed PR may promote only when the exact current head SHA has:

- all required CI/CodeQL/security checks successful;
- no unresolved material review threads;
- the required adversarial/post-review evidence marker for the tranche;
- roadmap/status truth reconciled where the tranche changes completion claims;
- no newer commit after the reviewed candidate;
- an explicit promotion state/action.

Any head movement revokes promotion automatically and requires exact-head evidence again.

The controller must not manufacture approvals or imply independent human review when repository policy does not require one. Coordinate with RF-052 rather than creating another misleading "approval" label.

Primary owners: RF-009/RF-034/RF-052, all streams at promotion.

## Sequencing

### Immediate, parallel-safe

1. **Q0 architecture-policy pilot** — cheap, catches recurrent boundary drift.
2. **Q1 cargo-nextest benchmark** — measurable cadence improvement with no quality reduction.
3. **Q2 property-testing pilot** — start with dataset identity/history/digest invariants.
4. **Q3 failure-evidence bundle** — improve diagnosis of the browser/IWER work already entering the critical path.

These may run alongside the current RF-015 resource-measurement and P1-USIM work because they do not change product semantics.

### After pilots demonstrate value

5. Q8 supply-chain prevention and Q9 exact-head promotion controller.
6. Q5 targeted fuzz/Miri/WASM artifact campaigns under RF-043/RF-053.
7. Q4 mutation campaigns on selected authority modules.
8. Q6 network fault injection after collaboration authority/deployed-path prerequisites.
9. Q7 formal models only for state machines where review/testing evidence shows interleaving risk worth the maintenance cost.

## CI policy

Default required-PR candidates after successful pilots:

- Q0 architecture policy checks;
- Q8 dependency-review / cargo-deny checks if low-noise;
- Q9 promotion-state validation;
- Q1 nextest as a replacement for, not addition to, equivalent Rust test execution if semantics agree.

Default non-required/scheduled or targeted:

- Q4 mutation testing;
- Q5 fuzz/Miri campaigns;
- Q6 network chaos;
- Q7 formal-model exploration.

Q2 property tests become ordinary tests only when bounded enough for the owning lane. Q3 diagnostic collection runs on failure or in explicitly instrumented evidence jobs.

## Exit gate for P1-Q planning

P1-Q planning is complete when the roadmap names the tranches, owners, evidence boundaries and sequencing. P1-Q implementation remains independently partial until each adopted tool passes its own fitness benchmark and is either integrated or explicitly rejected with evidence.
