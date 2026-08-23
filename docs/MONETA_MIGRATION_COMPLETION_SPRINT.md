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
- **DEFER — hardening:** fuzzing, Miri/fuzz/property campaigns, broad cleanup, additional diagnostics, speculative future-proofing, and similar engineering improvements.
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
| Obsolete Draco compatibility files | deep `layouts/`, `representation` and `evidence` mirrors are gone; remaining top-level shims are compatibility-only | remaining compatibility is explicit and minimal | **ACTIVE** |
| Rust analytical fact authority | exit audit found canonical Atlas representation still permits pre-kernel `minimalMonetaFacts`/empty-`Facts` synthesis, and `SignatureBuilder` still supplies placeholder analytical values such as cluster separation/density | every research-relevant fact consumed by Moneta is Rust/WASM-derived or the operation fails explicitly | **ACTIVE** |
| Moneta scale boundary | bounded candidate/sensitivity contract is executable for 10K, 100K, 1M and 10M cardinality signatures; canonical reasoning modules are guarded from raw-row traversal | no Moneta reasoning module traverses raw rows or performs N-dependent JS work | **DONE** |
| Moneta computational JS fallbacks | #315 moved data-derived layout computation to Rust/WASM and fail-closed kernel boundaries | scale-sensitive/data-derived computation is Rust-owned; UI does not recompute analytical geometry independently | **DONE** |
| Fitness/scoring authority | exit audit found and removed the obsolete independent `ConstraintArbiter`; canonical representation ranking is now the versioned `MonetaHypothesisEngine`/FitnessModel path, with learned ranking downstream of bootstrap hard constraints | scoring/ranking semantics have one production authority with invariant tests | **DONE** |
| Representation/provenance continuity | #324-#332 persist and replay-verify analytical, representation, model, discovery and NIL provenance | representation/model/NIL/discovery provenance survives Investigation and replay | **DONE** |
| Downstream confidence terminology | `RepresentationDecision` exposes utility/status/margin correctly; audit found a deprecated `SpatialStrategy.confidence` compatibility alias that duplicates utility and must be removed from persisted/public consumers | uncalibrated utility is no longer presented as statistical confidence | **ACTIVE** |
| Metamorphic correctness | row order, semantic rename, duplication/scale and exact provenance contracts are covered | declared metamorphic policies are executable at the authoritative/boundary layer | **DONE** |
| Draco public migration surface | production imports are gone and deep mirrors are removed; top-level compatibility aliases remain while ordinary tests are migrated | retained compatibility is documented, tested and ready for eventual removal | **ACTIVE** |
| End-to-end migration integration | provenance pieces exist, but the single representative Rust -> Moneta -> runtime -> portable replay migration proof remains to be assembled after the fact-origin boundary is fixed | representative datasets flow Rust evidence -> Moneta -> runtime/replay with deterministic provenance and no legacy authority path | **FINAL** |
| Large-dataset migration validation | columnar/data-plane and bounded reasoning evidence exist; current-main benchmark matrix remains to run | focused 10K-10M tiers prove no full-data JS rematerialisation or N-dependent Moneta work | **FINAL** |

### Exit-audit blockers discovered 23 August 2026

The final authority audit found three migration blockers that were not visible in the earlier ledger:

1. `src/moneta/ConstraintArbiter.ts` was a second heuristic representation scorer and converted heuristic utility directly into a field named `confidence`. It has no production caller and is removed in the current authority-exit slice.
2. `RepresentationState` intentionally builds a provisional representation before WASM is ready by using `minimalMonetaFacts`/empty analytical facts. `World` later rebuilds after kernel initialization, but the provisional result is not clearly marked as non-analytical. The next slice must replace this with an explicit pre-kernel presentation state rather than silently executing analytical Moneta semantics.
3. `SignatureBuilder` still fills research-relevant signature fields with fixed placeholders (`separationScore`, `densityVariation`, fallback entropy/rank-deficiency values). The Rust `DatasetStructureProfile` and canonical `DatasetEvidence` transport already expose authoritative values, but the production Atlas→Moneta composition root does not consume that evidence yet.

Therefore **Rust analytical fact authority remains ACTIVE** until the structure-profile/DatasetEvidence path is wired into production and the legacy synthesized-signature path is fenced to compatibility/tests.

## Execution sequence

### Slice 1 — Authority inventory and layout boundary — COMPLETE

- production Draco/Moneta import inventory completed;
- production consumers moved to Moneta;
- data-derived layout computation moved to Rust/WASM;
- architecture tests prevent production Draco imports and JS analytical fallback recurrence.

### Slice 2 — Fitness, scoring, recommendation and provenance convergence — COMPLETE FOR MIGRATION

- obsolete independent `ConstraintArbiter` removed during exit audit;
- one bootstrap/learned ranking contract remains;
- bootstrap hard constraints precede learned ranking;
- candidate and sensitivity budgets are independent of source row count;
- exact learned artifact identity is pinned;
- representation/model/discovery/NIL provenance survives portable Investigation replay;
- metamorphic correctness contracts are live.

This does **not** mean learned Moneta is empirically superior. Held-out discovery-outcome validation remains post-migration scientific work.

### Slice 3 — Draco compatibility collapse — ACTIVE

- deep compatibility mirrors removed;
- ordinary tests continue migrating to Moneta imports;
- retain only deliberate top-level compatibility aliases/facade needed to prove legacy import continuity;
- document removal conditions;
- preserve architecture/import tests that prohibit independent Draco authority.

### Slice 4A — Rust DatasetEvidence production boundary — NEXT CRITICAL SLICE

- expose the existing Rust `data_compute_structure_profile` ABI through the TypeScript runtime bridge;
- add the structure-profile operation to the Atlas kernel interface;
- adapt the Rust profile into canonical `DatasetEvidence` without recomputation;
- build the `DatasetSignature` from provenance-bearing evidence rather than placeholder analytical values;
- require production representation arbitration to use this evidence-backed path;
- keep `minimalMonetaFacts` and legacy signature synthesis explicitly non-authoritative and unavailable to production Moneta decisions;
- preserve pre-kernel UI startup as a clearly non-analytical presentation state, then replace it with the authoritative representation after WASM becomes ready;
- add mismatch/tamper tests for every FitnessModel-relevant evidence field.

### Slice 4B — Terminology and compatibility exit

- remove the deprecated `SpatialStrategy.confidence` alias once remaining consumers are migrated; use utility plus `decisionStatus`/`decisionMargin` instead;
- migrate remaining top-level Draco test imports and reduce `src/draco` toward a single intentional facade;
- keep participant confidence ratings, gesture recognition confidence, and genuine interval/confidence-level semantics unchanged.

### Slice 4C — Integration and migration exit

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
- Moneta consumes authoritative Rust/WASM evidence for every research-relevant fact;
- pre-kernel UI construction is explicitly non-analytical and cannot emit an authoritative representation decision;
- no scale-sensitive or duplicated data-derived computation silently falls back to JavaScript;
- scoring/ranking and representation selection have one semantic authority with executable invariants;
- uncalibrated utility is never surfaced as statistical confidence;
- representation/model/NIL/discovery provenance survives Investigation and clean-room replay;
- representative end-to-end migration tests and required CI are green;
- large-dataset performance boundaries remain intact on current `main`;
- all blocker-class review findings are resolved or shown obsolete.

At that point, reopen private-preview, scientific-validation and hardening queues in the order defined by `docs/ROADMAP.md`.
