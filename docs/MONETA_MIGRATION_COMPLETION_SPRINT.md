# Moneta Migration Completion Sprint

## Purpose

Finish the Draco-to-Moneta migration quickly without materially weakening correctness, reproducibility, security, performance, or scientific validity.

This sprint is the critical path. New findings do not interrupt it unless they are migration blockers under the policy below.

## Fixed architectural decisions

During this sprint, do not reopen these decisions without evidence that the architecture cannot meet the product requirement:

1. **Rust/WASM is the sole analytical and scale-sensitive computational authority.**
2. **Moneta owns bounded representation reasoning over compact Rust-derived evidence.**
3. **TypeScript/JavaScript orchestrates, presents, and adapts; it does not maintain an independent analytical implementation.**
4. **Legacy Draco is compatibility surface only and must converge toward aliases/re-exports, then removal where consumers permit.**
5. **Source cardinality is decoupled from rendered primitive count.**

## Blocker policy

A finding may interrupt the current migration slice only if it demonstrates one or more of:

- incorrect or non-deterministic analytical/representation results;
- security, privacy, data-integrity, or reproducibility failure;
- Rust/WASM authority violation, including duplicated JS analytical/layout computation or scale-sensitive JS work;
- required Draco compatibility breakage or creation of a second implementation;
- material large-dataset or XR hot-path regression;
- failing required type/build/test/architecture/integration gate.

Everything else is classified as:

- **DEFER — pre-preview:** valid resilience, UX, collaboration, API cleanup, or operational issue that should be fixed before broader use but does not invalidate the migration.
- **DEFER — hardening:** fuzzing, Miri campaigns, broad cleanup, additional diagnostics, speculative future-proofing, and similar engineering improvements.
- **SUGGESTION:** optional improvement with no demonstrated failure mode.

A valid deferred issue is not ignored. It is simply prevented from hijacking the migration critical path.

## Work rule

Before starting work, ask:

> Does this advance a migration-ledger row toward DONE, or fix a blocker preventing one from advancing?

If not, defer it.

Avoid opportunistic cleanup, adjacent refactors, dependency modernization, broad architecture reviews, and repository-wide audits while a migration row is active.

## Migration ledger — reconciled 23 August 2026

| Capability / invariant | Current state | Exit condition | Status |
|---|---|---|---|
| Legacy Draco authority | architecture tests restrict Draco to compatibility aliases/re-exports; production imports Moneta directly | no independent Draco solver/scorer/reasoning implementation remains | **DONE** |
| Draco import/call-site inventory | production inventory complete; no production consumer imports `src/draco/**` | every live Draco call site classified | **DONE** |
| Obsolete Draco compatibility files | deep `layouts/`, `representation/` and `evidence/` mirrors removed in the current exit slice | remaining compatibility is explicit and minimal | **ACTIVE** |
| Rust analytical fact authority | major analytical/evidence/layout paths are Rust/WASM-owned, but the complete research-fact origin audit is not yet recorded | every research-relevant fact consumed by Moneta is Rust/WASM-derived or fails explicitly | **NEXT** |
| Moneta scale boundary | bounded candidate/sensitivity contract is executable for 10K, 100K, 1M and 10M cardinality signatures; canonical reasoning modules are guarded from raw-row traversal | no Moneta reasoning module traverses raw rows or performs N-dependent JS work | **DONE** |
| Moneta computational JS fallbacks | #315 moved data-derived layout computation to Rust/WASM and fail-closed kernel boundaries | scale-sensitive/data-derived computation is Rust-owned; UI does not recompute analytical geometry independently | **DONE** |
| Fitness/scoring authority | bootstrap hard constraints precede learned ranking; exact learned provenance is pinned and invalid provenance fails closed | scoring/ranking semantics have one production authority with invariant tests | **DONE** |
| Representation/provenance continuity | #324-#332 persist and replay-verify analytical, representation, model, discovery and NIL provenance | representation/model/NIL/discovery provenance survives Investigation and replay | **DONE** |
| Downstream confidence terminology | compatibility and investigator-facing uses remain to audit | uncalibrated utility is no longer presented as statistical confidence | **NEXT** |
| Metamorphic correctness | row order, semantic rename, duplication/scale and exact provenance contracts are covered | declared metamorphic policies are executable at the authoritative/boundary layer | **DONE** |
| Draco public migration surface | production imports are gone; deep mirrors are being removed; top-level compatibility aliases remain | retained compatibility is documented, tested and ready for eventual removal | **ACTIVE** |
| End-to-end migration integration | provenance pieces exist, but the single representative Rust -> Moneta -> runtime -> portable replay migration proof remains to be assembled | representative datasets flow Rust evidence -> Moneta -> runtime/replay with deterministic provenance and no legacy authority path | **FINAL** |
| Large-dataset migration validation | columnar/data-plane and bounded reasoning evidence exist; current-main benchmark matrix remains to run | focused 10K-10M tiers prove no full-data JS rematerialisation or N-dependent Moneta work | **FINAL** |

Keep only one or two `ACTIVE` rows when possible. Current active rows are the two facets of Draco compatibility collapse; scientific terminology/authority work follows immediately afterward.

## Execution sequence

### Slice 1 — Authority inventory and layout boundary — COMPLETE

- production Draco/Moneta import inventory completed;
- production consumers moved to Moneta;
- data-derived layout computation moved to Rust/WASM;
- architecture tests prevent production Draco imports and JS analytical fallback recurrence.

### Slice 2 — Fitness, scoring, recommendation and provenance convergence — COMPLETE FOR MIGRATION

- one bootstrap/learned ranking contract established;
- bootstrap hard constraints precede learned ranking;
- candidate and sensitivity budgets are independent of source row count;
- exact learned artifact identity is pinned;
- representation/model/discovery/NIL provenance survives portable Investigation replay;
- metamorphic correctness contracts are live.

This does **not** mean learned Moneta is empirically superior. Held-out discovery-outcome validation remains post-migration scientific work.

### Slice 3 — Draco compatibility collapse — ACTIVE

- remove obsolete deep compatibility mirrors;
- migrate ordinary tests to Moneta imports;
- retain only deliberate top-level compatibility aliases/facade needed to prove legacy import continuity;
- document removal conditions;
- preserve architecture/import tests that prohibit independent Draco authority.

### Slice 4 — Integration and migration exit — NEXT

- audit research-relevant Moneta inputs for Rust/WASM analytical origin;
- clean remaining uncalibrated `confidence` terminology;
- prove authoritative Rust evidence -> Moneta reasoning -> representation runtime -> Investigation -> `.nemosyne` replay end to end;
- run 10K/100K/1M/10M performance tiers and memory/transfer evidence;
- run browser/WebXR smoke and final blocker sweep;
- mark remaining migration rows DONE only on evidence.

## Verification cadence

Use the cheapest layer capable of proving the property.

### Per edit / tight loop

- compiler/typecheck for the affected language;
- directly affected tests;
- focused architecture invariant when authority boundaries changed.

### Per coherent commit

- focused Moneta/Draco tests for the changed slice;
- Rust tests for Rust-owned behavior;
- focused JS/WASM boundary tests when ABI behavior changed;
- lint/type checks for changed application code.

### Per PR

- required repository CI gates;
- broader integration only for affected surfaces;
- benchmark evidence only when a hot path or scale contract changed.

### Migration checkpoint / before declaring the sprint complete

- full relevant test suite and coverage assurance;
- broad architecture checks;
- representative browser/WebXR smoke path;
- deterministic benchmark tiers and memory/transfer evidence;
- unresolved blocker review sweep.

### Post-migration hardening

- broad WASM `unsafe` audit;
- Miri/fuzz/property campaigns not already required for a migration blocker;
- kernel panic/recovery architecture beyond immediate containment needs;
- collaboration and unrelated subsystem cleanup;
- dependency/platform modernization not required by the migration.

## PR sizing

Prefer coherent vertical PRs over microscopic PRs. Target one migration slice or a meaningful sub-slice per PR, with multiple small commits where useful.

Avoid one-line PR chains that repeatedly pay checkout, CI, review, rebase and merge overhead unless isolation is needed for a genuinely high-risk change.

## Review handling

Review comments are evidence, not commands.

For every finding:

1. verify it against the current head;
2. classify it `BLOCKER`, `DEFER`, or `SUGGESTION`;
3. fix blockers with the smallest change and focused regression evidence;
4. record valid deferred work without expanding the PR;
5. resolve obsolete/outdated/non-blocking threads once dispositioned so conversation-resolution rules do not turn suggestions into accidental merge gates.

## Migration exit criteria

The sprint is complete when:

- Draco contains no independent analytical/representation reasoning authority;
- all required legacy Draco surfaces are explicit, thin Moneta compatibility adapters or removed;
- Moneta consumes authoritative Rust/WASM evidence for research-relevant facts;
- no scale-sensitive or duplicated data-derived computation silently falls back to JavaScript;
- scoring/ranking and representation selection have one semantic authority with executable invariants;
- representation/model/NIL/discovery provenance survives Investigation and clean-room replay;
- representative end-to-end migration tests and required CI are green;
- large-dataset performance boundaries remain intact on current `main`;
- all blocker-class review findings are resolved or shown obsolete.

At that point, reopen private-preview, scientific-validation and hardening queues in the order defined by `docs/ROADMAP.md`.
