# Moneta Migration Completion Sprint

## Purpose

Finish the Draco-to-Moneta migration without weakening correctness, reproducibility, security, performance, or scientific validity.

The migration is now in exit verification. New work interrupts the critical path only when it demonstrates a correctness, Rust-authority, reproducibility, compatibility, required-CI, large-dataset, or XR hot-path blocker.

## Fixed architectural decisions

1. **Rust/WASM is the sole analytical and scale-sensitive computational authority.**
2. **Moneta owns bounded representation reasoning over compact Rust-derived evidence.**
3. **TypeScript/JavaScript orchestrates, presents, and adapts; it does not maintain an independent analytical implementation.**
4. **Legacy Draco is compatibility surface only.**
5. **Source cardinality is decoupled from rendered primitive count.**

## Migration ledger — reconciled 23 August 2026 after #338

| Capability / invariant | Current evidence | Exit condition | Status |
|---|---|---|---|
| Legacy Draco authority | architecture tests prohibit independent Draco analytical authority; production imports Moneta | no independent Draco solver/scorer/reasoning implementation | **DONE** |
| Draco import/call-site inventory | production inventory complete; no production consumer depends on Draco analytical modules | every live Draco call site classified | **DONE** |
| Obsolete Draco compatibility files | deep mirrors were removed in #334; #340 collapses remaining one-line top-level shims to `src/draco/index.ts` | one explicit compatibility facade only | **IN PR #340** |
| Rust analytical fact authority | #336 reconstructs signatures from canonical DatasetEvidence; #338 routes production Atlas through validated Rust `DatasetStructureProfile`/DatasetEvidence and fails closed without it; pre-WASM World supplies no analytical decision | every research-relevant fact consumed by production Moneta is Rust/WASM-derived or the operation fails explicitly | **DONE** |
| Moneta scale boundary | candidate/sensitivity budgets are independent of source row count and reasoning modules do not receive raw rows | no Moneta reasoning module traverses raw rows or performs N-dependent JS work | **DONE; CURRENT-MAIN MATRIX IN PR #342** |
| Moneta computational JS fallbacks | #315 moved data-derived layout computation to Rust/WASM; #338 closes production fact-origin fallback | scale-sensitive/data-derived computation is Rust-owned | **DONE** |
| Fitness/scoring authority | #335 removed obsolete `ConstraintArbiter`; versioned FitnessModel is the sole bootstrap authority and learned ranking remains downstream of hard constraints | one production scoring/ranking authority | **DONE** |
| Representation/provenance continuity | #324-#332 persist and replay analytical, representation, learned-model, discovery and NIL provenance | representation/model/NIL/discovery provenance survives Investigation and clean-room replay | **DONE** |
| Downstream confidence terminology | decisions expose utility/status/margin; #340 removes the remaining `SpatialStrategy.confidence` alias that duplicated utility | uncalibrated utility is never presented as statistical confidence | **IN PR #340** |
| Metamorphic correctness | row-order, semantic-rename, duplication/scale and provenance contracts are executable | declared metamorphic policies are covered at authoritative/boundary layer | **DONE** |
| Draco public migration surface | production imports are gone; #340 reduces legacy source compatibility to one documented facade | retained compatibility is explicit, minimal and tested | **IN PR #340** |
| End-to-end migration integration | component provenance tests exist; #341 composes Rust-profile evidence → Atlas/Moneta decision → SpatialStrategy → Discovery → `.nemosyne` → clean-room replay | one representative authoritative composition proof is green | **IN PR #341** |
| Large-dataset migration validation | #305/#306 establish typed-column ingest/capacity evidence; #342 adds current-main 10K/100K/1M/10M bounded-Moneta invariants without JS row materialisation | current-main evidence proves bounded Moneta work and no full-data JS rematerialisation | **IN PR #342; CAPACITY BENCHMARK REFRESH REMAINS** |
| Browser/WebXR migration checkpoint | #338 restored explicit pre-kernel presentation-only startup; broad runtime tests remain | representative browser/WebXR smoke is green on migration-exit main | **FINAL** |

## What #336 and #338 closed

The final fact-origin audit had found that production representation could still be built from synthesized TypeScript facts and placeholder signature values. That blocker is now closed:

- #336 makes canonical DatasetEvidence reconstruct the DatasetSignature consumed by FitnessModel ranking, so caller-supplied analytical placeholders cannot override evidence;
- #338 connects Atlas to the existing Rust structure-profile ABI, validates the raw transport payload, binds profile identity to the live Rust dataset handle, and fails closed on missing/malformed evidence or fingerprint drift;
- `World` no longer emits an analytical representation before WASM is ready. Its pre-kernel construction passes no RepresentationDecision and authoritative arbitration occurs only after Atlas is ready.

Legacy `SignatureBuilder`/minimal facts may remain only as explicitly non-authoritative compatibility or isolated-test scaffolding. They are not a production Moneta decision path.

## Current parallel exit work

### PR #340 — terminology and Draco facade exit

- remove the deprecated `SpatialStrategy.confidence` utility alias;
- keep utility represented as `score` / `utilityScore`, with decision status and margin carrying ambiguity information;
- preserve genuine statistical confidence, interval/confidence-level and participant/gesture confidence concepts where semantically valid;
- collapse `src/draco` to the single `index.ts` compatibility facade;
- add architecture tests preventing utility-as-confidence and Draco shadow-module regression;
- migrate any CI-discovered legacy deep imports to canonical Moneta paths rather than restoring shims.

### PR #341 — authoritative end-to-end replay proof

Prove the successful composition path without hand-authoring the representation decision:

`Rust structure-profile evidence → DatasetEvidence → AtlasCore/Moneta → RepresentationDecision → SpatialStrategy → DiscoveryEpisode → Investigation → .nemosyne → clean-room replay`

Existing #332 tests remain the focused NIL and tamper/drift proof.

### PR #342 — 10K to 10M scale exit matrix

- exercise compact authoritative profiles at 10K, 100K, 1M and 10M source cardinalities;
- prove evidence size and candidate enumeration remain bounded as N increases;
- bound sensitivity scenario count for successful decisions;
- prove the Moneta authority payload contains metadata, not source-row arrays;
- complement, rather than duplicate, #305/#306 typed-column capacity benchmarks.

## Remaining final work after #340-#342

1. Refresh the real Rust/WASM columnar capacity benchmark on current `main` at the migration checkpoint. Do not manufacture 10M JavaScript row objects.
2. Run the representative browser/WebXR smoke path, including startup before WASM readiness and authoritative rebuild after readiness.
3. Sweep current review threads and required CI for blocker-class findings.
4. If those gates pass, mark every migration row DONE and close the Draco-to-Moneta migration sprint.
5. Reopen private-preview/productization, scientific validation, security/reliability hardening, and VR/UI/UX outcome work in the order defined by `docs/ROADMAP.md`.

## Verification cadence

Use the cheapest layer capable of proving the property.

- **Per edit:** type/compiler check, directly affected tests, focused architecture invariant.
- **Per coherent PR:** required CI, relevant Rust tests, JS/WASM boundary tests only where the ABI is involved.
- **Migration checkpoint:** full relevant suite, architecture guards, deterministic scale/capacity evidence, browser/WebXR smoke, unresolved blocker review sweep.
- **Post-migration hardening:** broader fuzz/Miri/property campaigns, kernel recovery hardening, collaboration cleanup, dependency/platform modernization, and other valid work not required for migration correctness.

## Migration exit criteria

The sprint is complete only when:

- Draco contains no independent analytical/representation reasoning authority and retained compatibility is one explicit facade;
- every research-relevant fact consumed by production Moneta is Rust/WASM-derived or fails closed;
- pre-kernel UI construction is explicitly non-analytical and cannot emit an authoritative representation decision;
- no scale-sensitive or duplicated data-derived computation silently falls back to JavaScript;
- scoring/ranking and representation selection have one semantic authority;
- uncalibrated utility is never surfaced as statistical confidence;
- representation/model/NIL/discovery provenance survives portable Investigation replay;
- the representative authoritative end-to-end migration test is green;
- current-main 10K-10M bounded-reasoning and Rust/WASM capacity evidence are green;
- representative browser/WebXR smoke is green;
- all blocker-class review findings are resolved or demonstrated obsolete.

At that point the migration is complete, not merely feature-complete.
