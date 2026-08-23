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

## Migration ledger

| Capability / invariant | Current state | Exit condition | Status |
|---|---|---|---|
| Legacy Draco authority | restricted to compatibility re-exports by architecture tests | no independent Draco solver/scorer/reasoning implementation remains | DONE |
| Draco import/call-site inventory | incomplete | every live `src/draco` import/export/call site classified as adapter, neutral contract, renderer helper, or obsolete | ACTIVE |
| Obsolete Draco compatibility files | retained pending inventory | files with no required live consumer deleted; remaining compatibility is explicit and minimal | NEXT |
| Rust analytical fact authority | partially established | every research-relevant fact consumed by Moneta is Rust/WASM-derived or fails explicitly | ACTIVE |
| Moneta scale boundary | bounded candidate/sensitivity contract exists | no Moneta reasoning module traverses raw rows or performs N-dependent JS work | ACTIVE |
| Moneta computational JS fallbacks | some layouts still contain degraded JS computation | scale-sensitive/data-derived layout computation is Rust-owned; UI may retain last-known-good presentation but not recompute analytical geometry independently | ACTIVE |
| Fitness/scoring authority | bootstrap/learned model infrastructure present | scoring/ranking semantics have one authoritative implementation and focused invariant tests | ACTIVE |
| Representation/provenance continuity | partial | representation/model/NIL/discovery provenance persists through Investigation and replay | NEXT |
| Downstream confidence terminology | partial compatibility remains | uncalibrated utility is no longer presented as statistical confidence | NEXT |
| Metamorphic correctness | incomplete | row shuffle, valid semantic rename, and declared duplication/scale policies are tested at the authoritative layer | NEXT |
| Draco public migration surface | compatibility retained | remaining public compatibility is documented, tested, and ready for eventual removal without hidden second authority | NEXT |
| End-to-end migration integration | incomplete | representative datasets flow Rust evidence -> Moneta -> representation runtime with deterministic provenance and no legacy authority path | FINAL |
| Large-dataset migration validation | architecture contract present | migration passes focused benchmark tiers and does not rematerialize full data or execute N-dependent Moneta JS work | FINAL |

Update this table in PRs that change a migration state. Keep only one or two `ACTIVE` rows when possible.

## Execution sequence

### Slice 1 — Authority inventory and layout boundary

- complete Draco/Moneta import and call-site inventory;
- remove or quarantine obsolete compatibility consumers;
- eliminate Moneta data-derived computational JS fallbacks that duplicate Rust layout work;
- add architecture tests that prevent recurrence;
- keep presentation-only fallback limited to last-known-good or explicitly non-analytical UI state.

### Slice 2 — Fitness, scoring, and recommendation convergence

- establish one scoring/ranking semantic authority;
- ensure bootstrap hard constraints precede learned ranking;
- keep candidate and sensitivity budgets bounded independently of source row count;
- retain only thin JS/WASM contract tests above authoritative Rust tests.

### Slice 3 — Draco compatibility collapse

- convert remaining required Draco entry points to explicit Moneta aliases/adapters;
- delete obsolete Draco implementation files after inventory proves no live consumers;
- add architecture/import tests that prohibit reintroduction of independent Draco authority.

### Slice 4 — Integration and migration exit

- prove authoritative Rust evidence -> Moneta reasoning -> representation runtime end to end;
- prove investigation/replay provenance survives the path;
- run migration-level performance tiers and representative integration tests;
- clean remaining uncalibrated `confidence` compatibility terminology required for the migration contract;
- mark migration rows DONE.

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

Avoid one-line PR chains that repeatedly pay checkout, CI, Copilot review, rebase, and merge overhead unless isolation is needed for a genuinely high-risk change.

## Review handling

Review comments are evidence, not commands.

For every finding:

1. verify it against the current head;
2. classify it `BLOCKER`, `DEFER`, or `SUGGESTION`;
3. fix blockers with the smallest change and focused regression evidence;
4. record valid deferred work without expanding the PR;
5. resolve obsolete/outdated/non-blocking threads once dispositioned so conversation-resolution rules do not turn suggestions into accidental merge gates.

Do not automatically push a fix merely because Copilot found something valid. Automatic review-remediation remains disabled during this sprint.

## Migration exit criteria

The sprint is complete when:

- Draco contains no independent analytical/representation reasoning authority;
- all required legacy Draco surfaces are explicit, thin Moneta compatibility adapters or removed;
- Moneta consumes authoritative Rust/WASM evidence for research-relevant facts;
- no scale-sensitive or duplicated data-derived computation silently falls back to JavaScript;
- scoring/ranking and representation selection have one semantic authority with executable invariants;
- representative end-to-end migration tests and required CI are green;
- large-dataset performance boundaries remain intact;
- all blocker-class review findings are resolved or shown obsolete.

At that point, reopen pre-preview and hardening queues in priority order.