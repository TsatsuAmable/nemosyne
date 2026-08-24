# Moneta Migration Completion Sprint

## Purpose

Finish the Draco-to-Moneta migration without weakening correctness, reproducibility, security, performance, or scientific validity.

The migration completed its exit checkpoint on 24 August 2026. Subsequent work may reopen the migration only when it demonstrates a correctness, Rust-authority, reproducibility, compatibility, required-CI, large-dataset, or XR hot-path regression.

## Fixed architectural decisions

1. **Rust/WASM is the sole analytical and scale-sensitive computational authority.**
2. **Moneta owns bounded representation reasoning over compact Rust-derived evidence.**
3. **TypeScript/JavaScript orchestrates, presents, and adapts; it does not maintain an independent analytical implementation.**
4. **Legacy Draco is compatibility surface only.**
5. **Source cardinality is decoupled from rendered primitive count.**

## Migration ledger — reconciled 24 August 2026 after #342

| Capability / invariant | Current evidence | Exit condition | Status |
|---|---|---|---|
| Legacy Draco authority | architecture tests prohibit independent Draco analytical authority; production imports Moneta | no independent Draco solver/scorer/reasoning implementation | **DONE** |
| Draco import/call-site inventory | production inventory complete; no production consumer depends on Draco analytical modules | every live Draco call site classified | **DONE** |
| Obsolete Draco compatibility files | deep mirrors were removed in #334; #340 collapsed remaining one-line top-level shims to `src/draco/index.ts` | one explicit compatibility facade only | **DONE** |
| Rust analytical fact authority | #336 reconstructs signatures from canonical DatasetEvidence; #338 routes production Atlas through validated Rust `DatasetStructureProfile`/DatasetEvidence and fails closed without it; pre-WASM World supplies no analytical decision | every research-relevant fact consumed by production Moneta is Rust/WASM-derived or the operation fails explicitly | **DONE** |
| Moneta scale boundary | #342 proves bounded evidence, candidates and sensitivity at 10K, 100K, 1M and 10M rows without source-row payloads | no Moneta reasoning module traverses raw rows or performs N-dependent JS work | **DONE** |
| Moneta computational JS fallbacks | #315 moved data-derived layout computation to Rust/WASM; #338 closes production fact-origin fallback | scale-sensitive/data-derived computation is Rust-owned | **DONE** |
| Fitness/scoring authority | #335 removed obsolete `ConstraintArbiter`; versioned FitnessModel is the sole bootstrap authority and learned ranking remains downstream of hard constraints | one production scoring/ranking authority | **DONE** |
| Representation/provenance continuity | #324-#332 persist and replay analytical, representation, learned-model, discovery and NIL provenance | representation/model/NIL/discovery provenance survives Investigation and clean-room replay | **DONE** |
| Downstream confidence terminology | decisions expose utility/status/margin; #340 removed the remaining `SpatialStrategy.confidence` alias that duplicated utility | uncalibrated utility is never presented as statistical confidence | **DONE** |
| Metamorphic correctness | row-order, semantic-rename, duplication/scale and provenance contracts are executable | declared metamorphic policies are covered at authoritative/boundary layer | **DONE** |
| Draco public migration surface | production imports are gone; #340 reduced legacy source compatibility to one documented facade | retained compatibility is explicit, minimal and tested | **DONE** |
| End-to-end migration integration | #341 composes Rust-profile evidence → Atlas/Moneta decision → SpatialStrategy → Discovery → `.nemosyne` → clean-room replay | one representative authoritative composition proof is green | **DONE** |
| Large-dataset migration validation | #342 proves bounded reasoning on current main; capacity run 32698495825 characterizes the real Rust/WASM 10M tall, 1M wide and 1M high-cardinality boundaries | current-main evidence proves bounded Moneta work and no full-data JS rematerialisation | **DONE** |
| Browser/WebXR migration checkpoint | #338 restored explicit presentation-only construction; the checkpoint proves authoritative rebuild after real WASM readiness and production WebGL2/WASM boot through the WebXR entry surface | representative browser/WebXR-entry smoke is green on migration-exit main | **DONE** |

## What #336 and #338 closed

The final fact-origin audit had found that production representation could still be built from synthesized TypeScript facts and placeholder signature values. That blocker is now closed:

- #336 makes canonical DatasetEvidence reconstruct the DatasetSignature consumed by FitnessModel ranking, so caller-supplied analytical placeholders cannot override evidence;
- #338 connects Atlas to the existing Rust structure-profile ABI, validates the raw transport payload, binds profile identity to the live Rust dataset handle, and fails closed on missing/malformed evidence or fingerprint drift;
- `World` no longer emits an analytical representation before WASM is ready. Its pre-kernel construction passes no RepresentationDecision and authoritative arbitration occurs only after Atlas is ready.

Legacy `SignatureBuilder`/minimal facts may remain only as explicitly non-authoritative compatibility or isolated-test scaffolding. They are not a production Moneta decision path.

## Landed exit work

### PR #340 — terminology and Draco facade exit — merged

- remove the deprecated `SpatialStrategy.confidence` utility alias;
- keep utility represented as `score` / `utilityScore`, with decision status and margin carrying ambiguity information;
- preserve genuine statistical confidence, interval/confidence-level and participant/gesture confidence concepts where semantically valid;
- collapse `src/draco` to the single `index.ts` compatibility facade;
- add architecture tests preventing utility-as-confidence and Draco shadow-module regression;
- migrate any CI-discovered legacy deep imports to canonical Moneta paths rather than restoring shims.

### PR #341 — authoritative end-to-end replay proof — merged

Prove the successful composition path without hand-authoring the representation decision:

`Rust structure-profile evidence → DatasetEvidence → AtlasCore/Moneta → RepresentationDecision → SpatialStrategy → DiscoveryEpisode → Investigation → .nemosyne → clean-room replay`

Existing #332 tests remain the focused NIL and tamper/drift proof.

### PR #342 — 10K to 10M scale exit matrix — merged

- exercise compact authoritative profiles at 10K, 100K, 1M and 10M source cardinalities;
- prove evidence size and candidate enumeration remain bounded as N increases;
- bound sensitivity scenario count for successful decisions;
- prove the Moneta authority payload contains metadata, not source-row arrays;
- complement, rather than duplicate, #305/#306 typed-column capacity benchmarks.

## Exit checkpoint evidence

The checkpoint is anchored to current-main SHA `0a9afb3221a0690bc6c576bdd64f9f161bb970c4` (#342).

1. **Rust/WASM capacity:** GitHub Actions run [32698495825](https://github.com/TsatsuAmable/nemosyne/actions/runs/32698495825) completed successfully. All three reloads preserved checksum identity. The 10M-tall scenario used a 320,000,000-byte logical core, loaded in 271.5 ms and recorded 640,221,184 bytes of first-run WASM growth; the 1M-wide scenario used a 275,000,000-byte logical core and 550,305,792 bytes of first-run growth; the 1M high-cardinality scenario used a 32,000,000-byte logical core and 73,269,248 bytes of first-run growth. The artifact is capacity characterization, not a production-promotion threshold.
2. **Kernel lifecycle:** `tests/production-runtime-wiring.test.ts` constructs World before Atlas readiness, observes a presentation-only node with no RepresentationDecision, starts real WASM, then verifies replacement with a decision bound to the live Rust dataset fingerprint.
3. **Production browser:** `tests/smoke/load.spec.ts` boots the production bundle in real headless Chromium/WebGL2, renders a frame, attaches the WebXR entry button, requires 200 responses for both generated WASM assets and treats kernel-unavailability console output as a failure.
4. **Review and CI sweep:** PRs #333-#338 and #340-#342 are merged with no review threads. Required CI and approval gates for #340, #341 and #342 are green; #342's CI run 32695772659 includes Rust tests, a dev WASM build, typecheck, lint and the full test suite.
5. **Checkpoint gate:** typecheck, lint, coverage (305 files / 1,877 tests; 81.14% statements, 69.48% branches), production build, 160 Rust tests and Playwright smoke all passed on the checkpoint branch.

The Draco-to-Moneta migration sprint is complete. The next critical-path work is private-preview/productization, followed in parallel by the scientific validation, security/reliability hardening and VR/UI/UX outcome programmes ordered in `docs/ROADMAP.md`.

## Post-exit performance finding

The migration checkpoint proved 10M resident columnar capacity, not practical 10M end-to-end performance. The subsequent Rust/JS boundary envelope, independently reproduced by GitHub Actions run [32701995846](https://github.com/TsatsuAmable/nemosyne/actions/runs/32701995846), found that the columnar-only handle can ingest, identify, scan and reload 10M rows, but cannot produce the authoritative DatasetStructureProfile required by Moneta. The request fails closed with zero row materialisations and zero evidence bytes transferred. Migration authority remains closed; the practical massive-data claim is blocked on columnar-native evidence generation and the follow-up physical-device browser/LOD envelope tracked in `docs/ROADMAP.md`.

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
