# TEC2 Heuristic Terminology Inventory

- **Status:** inventory (not a closure claim). The six migrations it enumerates were implemented in place on 2026-09-21 — see the Closure record at the end. TEC2 itself remains open.
- **Base:** `main` @ `3198ff8713752ac35fdbb3c78c0ae5a2eaf7b751`
- **Date:** 2026-09-21
- **Purpose:** Trace the six "bootstrap heuristic" fields enumerated in `docs/STATISTICAL_FOUNDATIONS.md:105-114` end-to-end (Rust producer → wire transport → TS consumers → persistence → UI → tests), and determine the concrete blast radius of renaming each one.
- **Scope statement:** This is TEC2 audit work. It makes no closure claim, changes no production code, and asserts no new statistical semantics. Every claim below was verified against source at the stated SHA; no claim is inferred from a field name alone.

Naming note: `docs/STATISTICAL_FOUNDATIONS.md:226` ("Migration debt") states the governing constraint — compatibility must never turn a magnitude threshold into significance, a silhouette-derived score into stability confidence, or sample count into statistical confidence. This inventory records where that constraint is currently satisfied by narrowing at an adapter boundary and where the legacy name survives.

---

## 1. `CorrelationProfile.significant_pairs_count`

### 1.1 Producer (Rust)
- Struct field: `wasm/src/data/profile.rs:66` — `pub significant_pairs_count: usize` on `CorrelationProfile` (`:63-68`).
- Computation: `wasm/src/data/profile.rs:922-927` — iterates `stats.correlation`, computes `let is_strong = absolute > 0.6;` (`:926`) and increments the counter for each strong pair (`:927`). Assigned into the struct at `:938`.
- This is a pure magnitude count. No test statistic, no p-value, no multiple-comparison correction, no sample-size dependence. The name "significant" is not backed by any inferential procedure in this file.

### 1.2 Transport
- `CorrelationProfile` carries `#[serde(rename_all = "camelCase")]` (`wasm/src/data/profile.rs:61-62`), so the wire name is **`significantPairsCount`**.
- TS transport mirror: `src/data/evidence/RustStructureProfile.ts:51` (`RustCorrelationProfile.significantPairsCount`).
- Validator: `src/atlas/MonetaEvidenceAuthority.ts:38-79` (`assertRustDatasetStructureProfile`) checks only that `correlations` is an object (`:53-68`) and that `provenance` has `kernelVersion` / `datasetFingerprint` / `algorithmSuite` / `timestampMs` (`:70-78`). It does **not** type-check `significantPairsCount` or any of the other five fields. A rename in Rust would therefore not be caught at the boundary; the value would silently become `undefined` at the adapter.
- Adapter: `src/data/evidence/StructureProfileEvidenceAdapter.ts:212` maps `profile.correlations.significantPairsCount` → **`strongCorrelationPairCount`** in the `dependency:correlations` evidence item (`:199-216`). This is the narrowing point required by the terminology migration. `pair.isStrong` is likewise narrowed to `isStrongByMagnitudeThreshold` at `:209`.

### 1.3 TypeScript consumers
- `src/moneta/representation/DatasetEvidenceSignature.ts:447-450` reads the narrowed key `dependency.strongCorrelationPairCount` back into the **legacy-named** signature field `dependence.significantPairsCount`. Epistemic marking: `:253-259` marks it `heuristic` with note "Pair count uses a magnitude threshold; it is not statistical significance".
- `src/moneta/representation/DatasetSignature.ts:55` declares the fact path `'dependence.significantPairsCount'`; `:170` declares `significantPairsCount?: number` on `DatasetSignatureDependence`.
- **Independent TS recomputation with a different threshold:** `src/moneta/representation/SignatureBuilder.ts:79-91` recomputes the count locally from `Facts.correlation` using `if (absolute >= 0.5) significantPairsCount += 1;` (`:88`). Assigned at `:161` and `:352`; epistemic-marked `measured` with note "Computed by supplied Rust kernel Facts" (`:162-174`, `:353-365`).
- `Facts`-type declaration carried through `src/data/types.ts` (accessed as `facts.correlation`).
- **Decision-bearing?** No. Grep across `src/` shows `dependence.significantPairsCount` / `dependence.maxCorrelation` are written into the signature and marked epistemically, but no module reads them for a threshold, ranking, gate, promotion or admissibility decision. `src/moneta/representation/FitnessModel.ts` contains no reference to `dependence` at all. It is carried, not used.

### 1.4 Persisted / serialized consumers
- **(Corrected 2026-09-23 — see the Correction record at the end.)** The original "None" was wrong at the signature level. The receipt/fixture half stands: not present in `src/data/evidence/EvidenceReceipt.ts`; not present in any `tests/fixtures/**` JSON.
- What "None" missed: pre-TEC2, `DatasetEvidenceSignature.ts` wrote this value into the signature field `dependence.significantPairsCount`, and a `RepresentationDecision` — including its full `datasetSignature` — is persisted verbatim as `investigation/representation.json` in portable `.nemosyne` packages (`src/session/NemosynePackage.ts:196-198`) and is digest-bearing in the v2 digest via `representationStateHash` (`src/atlas/domain/InvestigationAggregate.ts:411-418`, `src/investigation/InvestigationDigest.ts:241-248`). Historical v2 packages may therefore carry this key.
- The in-memory `DatasetEvidence` envelope produced by the adapter (`StructureProfileEvidenceAdapter.ts:382-387`) remains rebuilt from the live kernel handle per `src/atlas/MonetaEvidenceAuthority.ts:85-109`; that claim stands for the envelope but it is not the only durable form — the persisted decision is.

### 1.5 Investigator-visible label
- None. No string in `src/vr/**` or `src/ui/**` surfaces this field or a human-readable variant. Grep for label variants (case-insensitive "significant pair", etc.) across `src/`, `tests/`, `wasm/src/` returns only `DatasetEvidenceSignature.ts:513` ("density variation") and Rust code comments.

### 1.6 Test coverage
- `tests/representation-signature.test.ts:94` — `expect(sig.dependence.significantPairsCount).toBe(1)`. Asserts the **legacy name** on the signature.
- `tests/dataset-evidence-wiring.test.ts:130` (sets `source.correlations.significantPairsCount = 2`) and `:139` (`expect.objectContaining({ strongCorrelationPairCount: 2 })`), with `:140` asserting `JSON.stringify(dependency?.value)` does **not** match `/significant/i`.
- `tests/dataset-evidence-wiring.test.ts:48` — fixture value `significantPairsCount: 0`.
- `tests/atlas-moneta-evidence-authority.test.ts:32` — fixture value `significantPairsCount: 1`.
- `tests/helpers/moneta-kernel-fixture.ts:56` — fixture value `significantPairsCount: 0`.
- No test asserts the threshold value 0.6 or 0.5, and no test pins the count's relationship to `pairs` length.

### 1.7 Blast radius of a rename
Source files that must change: `wasm/src/data/profile.rs`, `src/data/evidence/RustStructureProfile.ts`, `src/data/evidence/StructureProfileEvidenceAdapter.ts`, `src/moneta/representation/SignatureBuilder.ts`, `src/moneta/representation/DatasetSignature.ts`, `src/moneta/representation/DatasetEvidenceSignature.ts`.
Test files that must change: `tests/representation-signature.test.ts`, `tests/dataset-evidence-wiring.test.ts`, `tests/atlas-moneta-evidence-authority.test.ts`, `tests/helpers/moneta-kernel-fixture.ts`.
Persisted/serialized format impact: **(corrected 2026-09-23)** — no receipt or `tests/fixtures/**` fixture records the name, but the signature key `dependence.significantPairsCount` was persisted inside `RepresentationDecision.datasetSignature` payloads (`investigation/representation.json`) and committed by the v2 investigation digest. Deleting the field from `DatasetSignature.ts` does not break those historical packages only because replay restores decisions verbatim; any future stripping or normalizing of the key in persisted payloads is a digest-changing format migration governed by RFC 0008 (`docs/rfcs/0008-historical-dataset-signature-persistence.md`).
Compatibility alias: **not required for persistence** — replay restores historical decisions verbatim, so retired keys in persisted payloads remain valid history (RFC 0008). Required only if the `DatasetSignature` consumer surface (`dependence.significantPairsCount`) must remain stable for out-of-tree callers; the canonical evidence key is already narrowed to `strongCorrelationPairCount`, so a Rust-side rename is contained to the adapter.
Additional note: because `assertRustDatasetStructureProfile` does not type-check this field, a rename without updating `RustStructureProfile.ts` + the adapter fails **silently**, not loudly.

---

## 2. `ClusterProfile.stability_confidence`

### 2.1 Producer (Rust)
- Struct field: `wasm/src/data/profile.rs:77` — `pub stability_confidence: f64` on `ClusterProfile` (`:72-87`).
- Zero-case: `wasm/src/data/profile.rs:281` — `stability_confidence: 0.0` in `empty_cluster_profile` (`:270-295`).
- Computation: `wasm/src/data/profile.rs:545-549` — `if has_clusters { (best_silhouette * 0.9).clamp(0.1, 1.0) } else { 0.0 }`. `best_silhouette` is the best average silhouette over candidate k (`:529-532`); `has_clusters` is `best_silhouette > 0.35 && best_k > 1` (`:535`).
- The value is a deterministic affine rescaling of one silhouette score. There is no resampling, no bootstrap, no repetition, and no seed variation in this computation — despite the `sampling_seed` field present on the same struct (`:81`), which is used for bottom-k sample selection (a sampling bound, not a stability measurement).

### 2.2 Transport
- camelCase via `wasm/src/data/profile.rs:70-71` → wire name **`stabilityConfidence`**.
- TS mirror: `src/data/evidence/RustStructureProfile.ts:60`.
- Adapter: `src/data/evidence/StructureProfileEvidenceAdapter.ts:156` maps it to **`legacySilhouetteDerivedScore`** inside the `cluster:global` evidence item (`:146-185`). Note the adapter names the neighbouring fields `heuristicSeparationScore` (`:154`) and `heuristicDensityVariation` (`:155`), so the whole cluster block is narrowed here.

### 2.3 TypeScript consumers
- Only one: `src/data/evidence/StructureProfileEvidenceAdapter.ts:156`.
- It is **not** reconstructed into `DatasetSignature`: `src/moneta/representation/DatasetEvidenceSignature.ts:456-470` reads only `heuristicEstimatedCount`, `heuristicPartitionDetected`, `heuristicSeparationScore`, `heuristicDensityVariation` as `clusterStructure.{estimatedCount,hasClusters,separationScore,densityVariation}`. `legacySilhouetteDerivedScore` has no destination in `DatasetSignature`.
- **Decision-bearing?** No. The value is transported and labelled, then dropped. No ranking, gate, or admissibility path reads it.
- Contrast (adjacency, not this field): `clusterStructure.hasClusters` **is** decision-bearing — `src/moneta/representation/FitnessModel.ts:247-249, 291-296` (CLUSTER family score 0.95) and `src/moneta/representation/DatasetEvidenceSignature.ts:512` (decision-relevance equality gate).

### 2.4 Persisted / serialized consumers
- None. `src/data/evidence/EvidenceReceipt.ts` has a first-class `EvidenceReceiptStabilityV1` (`:33-37`: `method`, `score`, `repetitions`) but no code path populates it from `stability_confidence`. `docs/audits/TEC0_EVIDENCE_PROPAGATION_AUDIT_2026-09-20.md:25` records this as "explicitly legacy/heuristic" and "Required migration; heuristic compatibility only meanwhile".
- No fixture under `tests/fixtures/**` records it.

### 2.5 Investigator-visible label
- None in `src/vr/**` or `src/ui/**`. The only user-adjacent string mentioning it is the audit/design reference in `docs/`.

### 2.6 Test coverage
- `tests/dataset-evidence-wiring.test.ts:133` sets `source.clusters.stabilityConfidence = 0.648` and `:145` asserts the narrowed transport `legacySilhouetteDerivedScore: 0.648`; `:146` asserts `JSON.stringify(cluster?.value)` does **not** match `/confidence/i`. This test actively asserts against the misleading name.
- `tests/dataset-evidence-wiring.test.ts:40` / `:56` — fixture values `stabilityConfidence: 0.72` / `0`.
- `tests/helpers/moneta-kernel-fixture.ts:64` — `stabilityConfidence: hasClusters ? 0.8 : 1`. This is **inverted relative to Rust**, which returns `0.0` when `has_clusters` is false (`profile.rs:548`). Recorded as a fixture observation only; no production impact.
- `tests/representation-preview-purity.test.ts:70` — fixture value `legacySilhouetteDerivedScore: 0`.
- No Rust test asserts on `stability_confidence` values (grep over `wasm/src/**/*.rs` returns only the struct field and the two assignments).

### 2.7 Blast radius of a rename
Source: `wasm/src/data/profile.rs`, `src/data/evidence/RustStructureProfile.ts`, `src/data/evidence/StructureProfileEvidenceAdapter.ts`.
Tests: `tests/dataset-evidence-wiring.test.ts`, `tests/helpers/moneta-kernel-fixture.ts`, `tests/atlas-moneta-evidence-authority.test.ts`, `tests/representation-preview-purity.test.ts`.
Persisted/serialized impact: **none**.
Compatibility alias: **not required.** The canonical evidence key is already `legacySilhouetteDerivedScore`; nothing downstream reads it.

---

## 3. `SpectralFacts.periodicity_confidence`

### 3.1 Producer (Rust)
- Primary struct field: `wasm/src/data/spectral.rs:33` — `pub periodicity_confidence: f64` on `SpectralFacts` (`:21-43`), with the comment at `:31-32`: "Historical field name retained for ABI compatibility. This is an uncalibrated deterministic heuristic score, not statistical confidence."
- Computation: `wasm/src/data/spectral.rs:316-321`:
  - `has_periodicity = power_spectrum_peak > 0.35 && normalized_entropy < 0.75` (`:316`)
  - `periodicity_confidence = (power_spectrum_peak * 0.6 + (1.0 - normalized_entropy) * 0.4).clamp(0.0, 1.0)` when `has_periodicity`, else `0.0` (`:317-321`)
  - Rounded to 3 decimals at `:336`. Zero-case at `:274`.
- The weighted combination of peak power and spectral entropy is exactly as described in `docs/STATISTICAL_FOUNDATIONS.md:111`. No null distribution, no calibration, no threshold-vs-null comparison is computed.
- Second Rust carrier: `wasm/src/data/profile.rs:200` — `SpectralProfile.periodicity_confidence`, populated from `facts.periodicity_confidence` at `:1007`. The same value is also copied into every `PeriodicityProfile.confidence` at `:1029` (`PeriodicityProfile` at `profile.rs:100-108`, with comment at `:106`: "Historical heuristic score, not calibrated statistical confidence").

### 3.2 Transport
- `SpectralFacts` camelCase via `wasm/src/data/spectral.rs:19-20`; `SpectralProfile` and `PeriodicityProfile` camelCase via `profile.rs:192-193` and `:98-99`.
- Wire names: **`periodicityConfidence`** on `spectral` (mirror `src/data/evidence/RustStructureProfile.ts:158`), **`periodicityConfidence`** on the profile as well (`src/data/evidence/RustStructureProfile.ts` `RustSpectralProfile`), and **`confidence`** on each periodicity (`src/data/evidence/RustStructureProfile.ts:85`, `RustPeriodicityProfile.confidence`).
- Adapter: `src/data/evidence/StructureProfileEvidenceAdapter.ts:297` maps to **`periodicityHeuristicScore`** in `spectral:global`; `:296` maps `hasPeriodicity` → `heuristicPeriodicityDetected`; `:270` maps each periodicity's `confidence` → **`heuristicScore`**.

### 3.3 TypeScript consumers
- Narrowed path: `src/moneta/representation/DatasetEvidenceSignature.ts:127-130` reads `spectral.periodicityHeuristicScore` into `SpectralFacts.periodicityHeuristicScore`; `:397-403` marks `hasPeriodicity` and `periodicityHeuristicScore` as `heuristic` with note "Periodicity detection/score is explicitly heuristic".
- Legacy path: `src/moneta/representation/DatasetSignature.ts:122-125` declares `periodicityConfidence?: number` as `@deprecated` alongside `periodicityHeuristicScore?: number`; `:77-78` declares both fact paths.
- `src/moneta/representation/SignatureBuilder.ts:54-59` marks both `spectralStructure.periodicityConfidence` and `spectralStructure.periodicityHeuristicScore` as `heuristic` in the epistemic map.
- Legacy TS mirror of the raw payload: `src/data/types.ts:243` (`SpectralFacts.periodicityConfidence`, used by `RepresentationHypothesisEngine.reason` callers — see `MonetaHypothesisEngine.ts:177, 190`).
- **Decision-bearing?** The **value** is not. Grep for `periodicityConfidence` / `periodicityHeuristicScore` across `src/` returns only declaration + adapter + epistemic-marking sites; no comparison, threshold, or ranking reads it.
- **However, its sibling derived boolean is decision-bearing.** `signature.spectralStructure.hasPeriodicity` is computed from the same expression (`spectral.rs:316`) and is consumed by:
  - `src/moneta/representation/FitnessModel.ts:282-285` — FREQUENCY family receives `score = 1` when `candidate.supports.includes('periodic-spectrum') && signature.spectralStructure?.hasPeriodicity === true`. This is a ranking input (`score` feeds `0.7 * score + 0.3 * requiredCoverage` at `:316`).
  - `src/moneta/representation/MonetaHypothesisEngine.ts:429-431` — asserts the fact "spectral periodicity detected in signal".
  - `src/moneta/representation/MonetaHypothesisEngine.ts:935` — `if (layout === 'SPECTRAL_VOLUME' && !signature.spectralStructure?.hasPeriodicity)` — a layout-admissibility rejection.
  - `src/moneta/representation/DatasetEvidenceSignature.ts:516` — the decision-relevance equality gate `assertDecisionRelevantSignatureMatchesEvidence` compares `spectralStructure?.hasPeriodicity` between the provided and authoritative signature and throws on mismatch. `periodicityHeuristicScore` is **not** in that check list (`:500-517`).

### 3.4 Persisted / serialized consumers
- `src/data/evidence/EvidenceReceipt.ts` does not reference it.
- No fixture JSON under `tests/fixtures/**` records it.
- **(Corrected 2026-09-23 — see the Correction record.)** The section originally implied no durable consumer beyond the envelope. The signature level says otherwise: pre-TEC2 the value was also carried as `DatasetSignature.spectralStructure.periodicityConfidence` (declared on pre-TEC2 `DatasetSignature.ts` as the `@deprecated` alias alongside `periodicityHeuristicScore`), and a `RepresentationDecision`'s full `datasetSignature` is persisted verbatim as `investigation/representation.json` and is digest-bearing in the v2 digest (`src/atlas/domain/InvestigationAggregate.ts:411-418`). Historical v2 packages may therefore carry this key.
- It **is** baked into the in-memory evidence envelope, and — notably — the decision-relevance gate at `DatasetEvidenceSignature.ts:516` is the one place a value derived from the same computation is used to **throw** on mismatch.

### 3.5 Investigator-visible label
- None directly. No `src/vr/**` or `src/ui/**` string surfaces `periodicityConfidence` or a variant. User-facing text that mentions periodicity derives from `hasPeriodicity`, not from this score (e.g. the FREQUENCY representation family label path, not the number).

### 3.6 Test coverage
- **Rust ABI test asserts the misleading camelCase name:** `wasm/src/data/spectral.rs:404-428` (`spectral_facts_serialize_camel_case_for_wasm_abi`) includes `"periodicityConfidence"` in the required-key list at `:416` and asserts the key is present (`:424`). This test would fail on a Rust-side rename and is the single Rust test pinning any of the six names.
- `tests/dataset-evidence-wiring.test.ts:181` and `:231` — profile fixtures with `periodicityConfidence: 0.8`; `:215` and `:246` assert `periodicityHeuristicScore: 0.8`; `:226` asserts `JSON.stringify(spectral?.value)` does **not** match `/confidence/i`.
- `tests/spectral-analysis.test.ts:19` — `periodicityConfidence: 0.88` in a `SpectralFacts` fixture.
- `tests/frequency-field.test.ts:144` — `periodicityConfidence: 0.9` in a `SpectralFacts` fixture; `:157-162` asserts the FREQUENCY family is chosen and that the evidence list mentions "spectral periodicity" (the decision here follows `hasPeriodicity`, not the score).
- `tests/synthetic/representation-fixtures.ts:132` — `periodicityConfidence: 0.94` in a fixture whose `expectedFamily` is `'FREQUENCY'` (`:136`).

### 3.7 Blast radius of a rename
Source: `wasm/src/data/spectral.rs`, `wasm/src/data/profile.rs`, `src/data/evidence/RustStructureProfile.ts`, `src/data/evidence/StructureProfileEvidenceAdapter.ts`, `src/moneta/representation/DatasetSignature.ts`, `src/moneta/representation/DatasetEvidenceSignature.ts`, `src/moneta/representation/SignatureBuilder.ts`, `src/data/types.ts`.
Tests: `wasm/src/data/spectral.rs` (in-file ABI test), `tests/dataset-evidence-wiring.test.ts`, `tests/spectral-analysis.test.ts`, `tests/frequency-field.test.ts`, `tests/synthetic/representation-fixtures.ts`.
Persisted/serialized impact: **the `SpectralFacts` camelCase ABI is asserted as a frozen contract by a Rust test** (`spectral.rs:404-428`) and is declared in `wasm/pkg/nemosyne_wasm.d.ts` generated bindings territory. No `tests/fixtures/**` JSON records the value, but the signature key `spectralStructure.periodicityConfidence` was persisted inside historical `RepresentationDecision.datasetSignature` payloads (`investigation/representation.json`); the type-level deletion does not break those packages because replay restores decisions verbatim — any future stripping of the key from persisted payloads is a digest-changing format migration (corrected 2026-09-23, RFC 0008). Independently, a wire rename breaks the asserted ABI shape.
Compatibility alias: **recommended for the Rust→TS hop** unless the ABI test is updated in the same change. The TS-side canonical key is already narrowed to `periodicityHeuristicScore`, so the alias surface is confined to `RustStructureProfile.ts` + the adapter.

---

## 4. `DensityProfile.global_density`

### 4.1 Producer (Rust)
- Struct field: `wasm/src/data/profile.rs:92` — `pub global_density: f64` on `DensityProfile` (`:91-96`).
- Computation: `wasm/src/data/profile.rs:987-993` — a three-step row-count threshold function on `row_count` alone: `>= 50 → 0.7`, `>= 20 → 0.4`, else `0.15`.
- No observation coordinates, no bandwidth, no kernel, no volume element, and no row-count normalization enter this value. Two datasets with identical row counts receive identical `global_density` regardless of their data. The function is exactly the "row-count threshold heuristic" named in `docs/STATISTICAL_FOUNDATIONS.md:112`.
- Sibling on the same struct: `is_sparse: row_count < 15` (`:996`) — also row-count-only.

### 4.2 Transport
- camelCase via `wasm/src/data/profile.rs:89-90` → wire name **`globalDensity`**.
- TS mirror: `src/data/evidence/RustStructureProfile.ts:73` (`RustDensityProfile.globalDensity`).
- Adapter: `src/data/evidence/StructureProfileEvidenceAdapter.ts:139` places it in the `density:global` evidence item (`:133-145`) **retaining the name `globalDensity`**, unlike its sibling on `:140` which is renamed to `heuristicLocalDensityVariation` and `:141` which is renamed to `heuristicModeCount`. The density block is therefore only partly narrowed.

### 4.3 TypeScript consumers
- Only one: `src/data/evidence/StructureProfileEvidenceAdapter.ts:139`.
- `DatasetSignature` has **no density section at all**. Confirmed against `src/moneta/representation/DatasetSignature.ts`: the fact-path union (`:50-88`) contains no density path and the `DatasetSignature` interface (`:211` onward) has no `density` member. `src/moneta/representation/DatasetEvidenceSignature.ts:434-455` reconstructs `distribution`, `dependence`, and `clusterStructure` but never reads the `density:global` item.
- **Decision-bearing?** No. The value is named, wrapped in an evidence item with `uncertainty: { kind: 'none' }` (`StructureProfileEvidenceAdapter.ts:65`), and then carried with no reader.
- Adjacency worth recording: `src/app/densityEvidenceDiagnostics.ts` and `src/moneta/representation/FitnessModel.ts:367-409` (`scoreDensityHandling`) concern density-capable candidate selection, but `scoreDensityHandling` gates on `requirements.requiredStructures` and on `signature.clusterStructure.densityVariation` (`:374-381`) — **not** on `globalDensity`.

### 4.4 Persisted / serialized consumers
- None. Absent from `src/data/evidence/EvidenceReceipt.ts` and from all `tests/fixtures/**` JSON.

### 4.5 Investigator-visible label
- None. Grep over `src/vr/**` and `src/ui/**` for `globalDensity` and for human-readable variants returns no matches. The nearest user-visible density strings are representation-candidate labels such as `DENSITY_FIELD` and "Binned density" (e.g. `src/app/densityEvidenceDiagnostics.ts:231`), which do not surface this value.

### 4.6 Test coverage
- `tests/atlas-moneta-evidence-authority.test.ts:52` — fixture value `globalDensity: 0.4` (note: 0.4 is the `>= 20` branch value, and the fixture also declares `rowCount: 128`, which in Rust would yield 0.7 — the fixture is internally inconsistent with the producer, confirming fixtures are not replay data).
- `tests/dataset-evidence-wiring.test.ts:68` — `globalDensity: 0.5` (a value Rust can never emit: the reachable set is `{0.15, 0.4, 0.7}`).
- `tests/evidence-backed-moneta.test.ts:71` — `globalDensity: 1` (also unreachable in Rust).
- `tests/helpers/moneta-kernel-fixture.ts:76` — `globalDensity: 0.5`.
- `tests/representation-preview-purity.test.ts:60` — `globalDensity: 1`.
- No test asserts on the threshold behaviour, and no Rust test asserts on `global_density` (grep over `wasm/src/**/*.rs` returns only the struct field and the assignment).
- Observation: three separate fixtures use values the Rust producer cannot emit. No test would fail if the Rust value were replaced by a constant.

### 4.7 Blast radius of a rename
Source: `wasm/src/data/profile.rs`, `src/data/evidence/RustStructureProfile.ts`, `src/data/evidence/StructureProfileEvidenceAdapter.ts`.
Tests: `tests/atlas-moneta-evidence-authority.test.ts`, `tests/dataset-evidence-wiring.test.ts`, `tests/evidence-backed-moneta.test.ts`, `tests/helpers/moneta-kernel-fixture.ts`, `tests/representation-preview-purity.test.ts`.
Persisted/serialized impact: **none**.
Compatibility alias: **not required.** No consumer reads the key.

---

## 5. `DensityProfile.local_density_variation`

### 5.1 Producer (Rust)
- Struct field: `wasm/src/data/profile.rs:93` — `pub local_density_variation: f64` on `DensityProfile`.
- Computation: `wasm/src/data/profile.rs:994` — `local_density_variation: if clusters.has_clusters { 0.3 } else { 0.1 }`.
- This is a two-valued constant selected by the heuristic cluster-detection boolean. It is not a local-density statistic of any kind: no neighbour distance, no k-NN density, no kernel estimate, no per-observation aggregation is computed. It matches `docs/STATISTICAL_FOUNDATIONS.md:113` exactly ("fixed value conditioned on heuristic cluster detection").

### 5.2 Transport
- camelCase via `wasm/src/data/profile.rs:89-90` → wire name **`localDensityVariation`**.
- TS mirror: `src/data/evidence/RustStructureProfile.ts:74`.
- Adapter: `src/data/evidence/StructureProfileEvidenceAdapter.ts:140` maps to **`heuristicLocalDensityVariation`** inside `density:global`.

### 5.3 TypeScript consumers
- Only one: `src/data/evidence/StructureProfileEvidenceAdapter.ts:140`.
- Not reconstructed into `DatasetSignature` (no density section; see §4.3).
- **Decision-bearing?** No.
- **Distinct field, do not conflate:** `ClusterProfile.density_variation` (`wasm/src/data/profile.rs:76`, computed `:544` as `if has_clusters { 0.25 } else { 0.0 }` — also a constant) is a *different* field. It travels as `heuristicDensityVariation` (`StructureProfileEvidenceAdapter.ts:155`), is reconstructed into `signature.clusterStructure.densityVariation` (`DatasetEvidenceSignature.ts:466-469`, epistemic `heuristic` at `:268-279`), and **is** consumed by a decision:
  - `src/moneta/representation/FitnessModel.ts:367-381` (`scoreDensityHandling`) — `knownDensityVariation = hasAuthoritativeDensityEvidence && signature.clusterStructure.densityVariation > 0` (`:377-380`), and `densityRelevant = (densityRequirement?.importance ?? 0) > 0 || knownDensityVariation` (`:381`). When `densityRelevant` is false the method returns 1 (`:385`); otherwise the candidate is scored 1 / 0.75 / 0 / 0.25 (`:387-409`), which feeds the composite fitness.
  - `src/moneta/representation/DatasetEvidenceSignature.ts:513` — the decision-relevance equality gate includes `clusterStructure.densityVariation` and throws on mismatch.

  Since `ClusterProfile.density_variation` is a two-valued constant conditional on `has_clusters`, this ranking input carries no more information than `hasClusters` while appearing as a continuous quantity. This is outside the six listed fields but is the same class of defect and is the one instance in this inventory where a *density* heuristic reaches a ranking path. **(Resolved 2026-09-25 — see the `ClusterProfile.density_variation` closure record at the end of this document.)**

### 5.4 Persisted / serialized consumers
- None for `localDensityVariation`. Absent from `src/data/evidence/EvidenceReceipt.ts` and from all `tests/fixtures/**` JSON.

### 5.5 Investigator-visible label
- None. No `src/vr/**` or `src/ui/**` string references it. The one human-readable string that mentions density variation is the equality-gate error label `'density variation'` at `src/moneta/representation/DatasetEvidenceSignature.ts:513`, which refers to `clusterStructure.densityVariation`, not to this field, and surfaces only in a thrown `Error` message compared by `tests/evidence-backed-moneta.test.ts:210`.

### 5.6 Test coverage
- `tests/atlas-moneta-evidence-authority.test.ts:53` — `localDensityVariation: 0.61` (a value Rust cannot emit: the reachable set is `{0.1, 0.3}`).
- `tests/dataset-evidence-wiring.test.ts:69` — `localDensityVariation: 0.1`.
- `tests/helpers/moneta-kernel-fixture.ts:77` — `localDensityVariation: densityVariation` where `densityVariation = options.densityVariation ?? 0.2` (`:31`).
- `tests/evidence-backed-moneta.test.ts:72` — `heuristicLocalDensityVariation: densityVariation`.
- `tests/representation-preview-purity.test.ts:61` — `heuristicLocalDensityVariation: 0`.
- No test asserts on the two-valued behaviour, and no Rust test asserts on `local_density_variation`.
- Observation: fixtures use arbitrary continuous values (0.61, 0.2) that the producer cannot emit, so no test would detect replacement or removal of the field.

### 5.7 Blast radius of a rename (or removal)
Source if renamed: `wasm/src/data/profile.rs`, `src/data/evidence/RustStructureProfile.ts`, `src/data/evidence/StructureProfileEvidenceAdapter.ts`.
Source if **removed**: Rust struct field, `RustStructureProfile.ts`, and the adapter line — then the `density:global` evidence item retains `globalDensity`, `heuristicModeCount`, `isSparse`.
Tests: `tests/atlas-moneta-evidence-authority.test.ts`, `tests/dataset-evidence-wiring.test.ts`, `tests/helpers/moneta-kernel-fixture.ts`, `tests/evidence-backed-moneta.test.ts`, `tests/representation-preview-purity.test.ts`.
Persisted/serialized impact: **none**.
Compatibility alias: **not required.** This is the only one of the six whose documentation-prescribed remedy is removal rather than rename (`docs/STATISTICAL_FOUNDATIONS.md:113`), and removal is contained to three source files.

---

## 6. Moneta sample-count `confidence_weight`

### 6.1 Producer (Rust)
- This is a **local variable, not a struct field**. It is therefore not part of the `DatasetStructureProfile` ABI at all; it is an internal step in a cost-adjustment function.
- `wasm/src/moneta/evidence.rs:20` — `let confidence_weight = (ev.sample_count as f64 / 10.0).min(1.0);`
- `wasm/src/moneta/evidence.rs:25` — `let utility_delta = (ev.composite_utility - 0.5) * 30.0 * confidence_weight;`
- Function: `wasm/src/moneta/evidence.rs:10-29` (`adjust_candidate_cost_with_evidence(base_cost, evidence) -> (f64, f64)`), returning `(adjusted_cost, -utility_delta)` (`:26-28`).
- Input struct: `EmpiricalUtilityEvidence { sample_count: usize, composite_utility: f64 }` at `wasm/src/moneta/evidence.rs:5-8`.
- **Byte-identical duplicate exists:** `wasm/src/draco/evidence.rs` is identical to `wasm/src/moneta/evidence.rs` (`diff` exits 0, no differences) — `wasm/src/lib.rs:7` does `pub use moneta as draco;`, so `draco::evidence::*` and `moneta::evidence::*` are the same module reached two ways.
- The expression saturates at N=10; the in-code rationale is the comment at `wasm/src/moneta/evidence.rs:19` ("Confidence weighting based on sample count (approaches 1.0 at N=10)"). Sample count is used as a multiplier on a utility delta. It is not a confidence interval, standard error, or posterior quantity.

### 6.2 Transport
- No camelCase struct rename applies (local variable). The transported scalar is **`sampleCount`**, inside the input object `{ baseCost, evidence: { sampleCount, compositeUtility } }`.
- WASM export: `wasm/src/lib.rs:1958-1988` — `#[no_mangle] pub extern "C" fn draco_adjust_evidence(...)`, with a locally declared `#[serde(rename_all = "camelCase")] struct Input { base_cost, evidence }` (`:1966-1970`) producing `{ adjustedCost, delta }` (`:1983-1986`).
- Generated binding declarations: `wasm/pkg/nemosyne_wasm.d.ts:347`, `wasm/pkg/nemosyne_wasm_bg.wasm.d.ts:70`.
- TS host declaration: `src/wasm/runtime/RuntimeExports.ts:189`.
- TS transport wrapper: `src/wasm/runtime/KernelContractBridge.ts:119-133` — `adjustMonetaEvidence(baseCost, evidence)`; alias `adjustDracoEvidence` at `:135`; re-exported through the facade at `src/wasm/RuntimeBridge.ts:90-91`.
- **TS re-implementation of the same formula:** `src/moneta/evidence/EvidenceWeightedScorer.ts:24-25` (`const confidenceWeight = Math.min(1.0, utility.sampleCount / 10); const utilityDelta = (utility.compositeUtility - 0.5) * 30.0 * confidenceWeight;`) and again at `:42-43` with a different downstream weight (`(0.5 - u) * 20.0 * (confidenceWeight || 1.0)`). `sampleCount` originates from `EvidenceStore.computeUtilityForSpec` (`src/moneta/evidence/EvidenceStore.ts:151`) / `computeUtilityScores` (`:97`) as `n = matches.length`.

### 6.3 TypeScript consumers
- **No production consumer exists.** Grep for `adjustMonetaEvidence` / `adjustDracoEvidence` across the repo returns only: the bridge definition (`KernelContractBridge.ts:119`), the alias (`:135`), the facade re-exports (`RuntimeBridge.ts:90-91`), and two tests (`tests/runtime-bridge-module-boundaries.test.ts:44-45, 187`, `tests/wasm-runtime.test.ts:429`). No module under `src/vr/**`, `src/app/**`, `src/atlas/**`, or `src/moneta/**` calls it.
- `EvidenceWeightedScorer` is exported from the barrel at `src/moneta/evidence/index.ts:3` but its only callers are `tests/evidence-draco.test.ts:27, 120, 163`.
- **Decision-bearing if wired — and it is a ranking function, not a display value.** `src/moneta/evidence/EvidenceWeightedScorer.ts:52-65` (`reRankCandidates`) calls `adjustCandidateScore` for every candidate, overwrites `cost` with `adjustedCost`, and `.sort((a, b) => a.cost - b.cost)`. `adjustCandidateScore` (`:35-50`) is the path where the sample-count multiplier determines the magnitude of the cost shift. So this heuristic is a candidate-ordering input by construction — today it is prevented from affecting production only by having no caller, not by any guard or gate.
- `src/atlas/MonetaEvidenceAuthority.ts` and the `DatasetEvidence`/`DatasetSignature` pipeline are entirely separate from this path; the sample-count weight never enters evidence identity, admissibility, or the fitness model.

### 6.4 Persisted / serialized consumers
- None. `sampleCount` appears in `src/data/evidence/RustStructureProfile.ts` and `StructureProfileEvidenceAdapter.ts` only as part of the cluster-estimator parameter manifest (`StructureProfileEvidenceAdapter.ts:159, 171`; `RustStructureProfile.ts:63`), which is a different sample count (clustering bottom-k sample size), not the Moneta empirical sample count.
- `tests/fixtures/draco-golden/golden-pairs.json` contains no `confidenceWeight`, `confidence_weight`, or `sampleCount` keys (verified by inspection of the fixture structure: `description` + `pairs[]` with `id`, `topology`, `dataInput`, `expectedLayout`, `expectedGeometry`).
- No durable store: `src/persistence/ClientPersistence.ts` persists gesture profiles only (`:7`, `:14`).

### 6.5 Investigator-visible label
- None. No `src/vr/**` or `src/ui/**` string surfaces the field or a variant. The only prose describing it is the Rust comment at `wasm/src/moneta/evidence.rs:19` and its duplicate `wasm/src/draco/evidence.rs:19`.
- Adjacent: `MonetaEmpiricalTuner` produces a human-readable `rationale` (`src/moneta/evidence/MonetaEmpiricalTuner.ts:95-97`) mentioning "promoted"/"demoted" by N and utility — but that is a separate module with its own `sampleCount` and no `confidence_weight`, and it too has no production caller.

### 6.6 Test coverage
- `tests/evidence-draco.test.ts:105-134` — records 10 outcomes and asserts `adjustedCost < 50` and `empiricalDelta < 0` from `adjustCandidateScore`; the 10-outcome count is exactly the saturation point, so the test exercises the saturated branch.
- `tests/evidence-draco.test.ts:135-168` — asserts `reRankCandidates` places the empirically superior spec first. **This is the only test asserting the ranking consequence of the sample-count weight.**
- Rust unit tests: `wasm/src/moneta/evidence.rs:35-44` and the identical `wasm/src/draco/evidence.rs:35-44` — `adjust_cost_reduces_penalty_for_positive_utility` asserts `adjusted < 50` and `delta == -9.0` for `sample_count: 10`.
- `tests/wasm-runtime.test.ts:429` — calls `bridge.adjustMonetaEvidence(Number.NaN, {...})` only to assert non-finite inputs are refused (returns `null`).
- `tests/runtime-bridge-module-boundaries.test.ts:44-45, 187` — asserts the facade exports both names and that `adjustDracoEvidence === adjustMonetaEvidence`.
- No test asserts the name `confidence_weight` itself; the name exists only as a local binding and a Rust comment.

### 6.7 Blast radius of a rename
Source: `wasm/src/moneta/evidence.rs` (local variable + comment), `wasm/src/draco/evidence.rs` (identical duplicate), `src/moneta/evidence/EvidenceWeightedScorer.ts` (local variable, two sites).
No struct field or wire key changes, so `wasm/src/lib.rs`, `RuntimeExports.ts`, `KernelContractBridge.ts`, `RuntimeBridge.ts` and the generated `wasm/pkg/*.d.ts` do not change.
Tests: none reference the name; `tests/evidence-draco.test.ts` and the two Rust unit tests assert on numerical outcomes only and would be unaffected.
Persisted/serialized impact: **none**.
Compatibility alias: **not required** — renaming a local variable changes no ABI, no envelope, and no fixture.
Residual risk to record: renaming the variable does not change the fact that `EvidenceWeightedScorer.reRankCandidates` is a live ranking implementation of a sample-count multiplier. The terminology fix and the decision-surface question are separate.

---

## Summary

| Field | Rust source | TS decision-bearing? | Persisted? | User-visible? | Rename blast radius | Compatibility alias needed? |
| --- | --- | --- | --- | --- | --- | --- |
| `CorrelationProfile.significant_pairs_count` | `wasm/src/data/profile.rs:66`; computed `:922-927` (`abs(r) > 0.6`) | No — carried into signature + epistemic map only | Partially (corrected 2026-09-23): no receipt, no fixture — but signature key `dependence.significantPairsCount` persisted in `investigation/representation.json`, digest-bearing in v2 (RFC 0008) | No | Rust struct + `RustStructureProfile.ts:51` + adapter `:212` + `SignatureBuilder.ts` (2 sites) + `DatasetSignature.ts:55,170` + `DatasetEvidenceSignature.ts:447-450`; 4 test files | No (adapter already uses `strongCorrelationPairCount`) |
| `ClusterProfile.stability_confidence` | `wasm/src/data/profile.rs:77`; computed `:545-549` (`silhouette * 0.9`, clamp 0.1–1.0) | No — mapped to `legacySilhouetteDerivedScore`, then dropped; never enters `DatasetSignature` | No | No | Rust struct + `RustStructureProfile.ts:60` + adapter `:156`; 4 test files | No |
| `SpectralFacts.periodicity_confidence` | `wasm/src/data/spectral.rs:33`; computed `:316-321` (0.6·peak + 0.4·(1−entropy)) | Value: no. **Sibling `hasPeriodicity` is**: `FitnessModel.ts:282-285`, `MonetaHypothesisEngine.ts:429,935`, gate `DatasetEvidenceSignature.ts:516` | Partially (corrected 2026-09-23): no receipt, no fixture — but signature key `spectralStructure.periodicityConfidence` persisted in `investigation/representation.json`, digest-bearing in v2 (RFC 0008) | No | `spectral.rs` + `profile.rs` + 6 TS files (`RustStructureProfile.ts`, adapter `:270,297`, `DatasetSignature.ts:77-78,122-125`, `DatasetEvidenceSignature.ts:127-130,399`, `SignatureBuilder.ts:54-59`, `types.ts:243`) + 5 test files incl. Rust ABI test | **Yes for the Rust→TS hop** — `wasm/src/data/spectral.rs:416` freezes the camelCase name |
| `DensityProfile.global_density` | `wasm/src/data/profile.rs:92`; computed `:987-993` (row-count step: ≥50→0.7, ≥20→0.4, else 0.15) | No — no reader; `DatasetSignature` has no density section | No | No | Rust struct + `RustStructureProfile.ts:73` + adapter `:139`; 5 test files | No |
| `DensityProfile.local_density_variation` | `wasm/src/data/profile.rs:93`; computed `:994` (`has_clusters ? 0.3 : 0.1`) | No — adapter `:140` only. Adjacent `ClusterProfile.density_variation` (`:76`, `:544`) **is** used in `FitnessModel.ts:367-409` and gate `DatasetEvidenceSignature.ts:513` | No | No | Rust struct + `RustStructureProfile.ts:74` + adapter `:140`; 5 test files. Removal is viable and equally contained | No |
| Moneta sample-count `confidence_weight` | Local variable, not a field: `wasm/src/moneta/evidence.rs:20,25` and duplicate `wasm/src/draco/evidence.rs:20,25` | Mirror `EvidenceWeightedScorer.ts:24-25,42-43` **is a ranking function** (`reRankCandidates` `:52-65`) but has **no production caller**; WASM path `draco_adjust_evidence` (`lib.rs:1959`) also has no production caller | No (golden fixture has no such key) | No | 4 source sites in 3 files; no ABI/wire key changes; no test references the name | No |

---

## Open questions

1. **Which threshold is authoritative for `significant_pairs_count`?** Rust uses `abs(r) > 0.6` (`wasm/src/data/profile.rs:926`); `SignatureBuilder.ts:88` recomputes the same-named field with `abs >= 0.5`. The code does not state which is canonical, and no test pins either. Resolving this is a prerequisite to choosing the rename target.
2. **Is the `confidence_weight` path intended to become live?** `EvidenceWeightedScorer.reRankCandidates` is a complete, tested ranking implementation with no production caller, and the equivalent Rust kernel function `draco_adjust_evidence` is likewise wired to the bridge but never called. Whether this is dead code awaiting a caller or an intentionally parked capability cannot be determined from the code alone.
3. **Is `EvidenceReceiptStabilityV1` (`src/data/evidence/EvidenceReceipt.ts:33-37`) intended to receive a real resampling stability score in place of `stability_confidence`?** The receipt shape has `method`, `score`, `repetitions`, but no code path populates it and no producer emits repetitions.
4. **Why do fixtures use `globalDensity` values (`0.5`, `1`) and `localDensityVariation` values (`0.61`, `0.2`) that the Rust producer cannot emit?** The `{0.15, 0.4, 0.7}` and `{0.1, 0.3}` value sets are fully determined by the producer; the fixtures were evidently authored independently. This is recorded as an observation, not a defect claim. **(Resolved 2026-09-26 — see the Q4/Q5 fixture-fidelity closure record at the end. The values were corrected under the post-rename field names; no production numerics changed.)**
5. **`tests/helpers/moneta-kernel-fixture.ts:64` sets `stabilityConfidence: hasClusters ? 0.8 : 1`, inverting the producer** (which yields `0.0` when `has_clusters` is false, `profile.rs:548`). No test depends on the inverted value being realistic, but the fixture does not mirror the kernel contract. **(Resolved 2026-09-26 — see the Q4/Q5 fixture-fidelity closure record at the end. Under its post-rename name `heuristicSilhouettePartitionScore` the fixture now derives the fail-closed `0` case instead of inventing `1`.)**
6. **No human-visible label exists for any of the six fields.** This inventory found no UI string, panel label, tooltip, or telemetry key surfacing any of them, so the "investigator-visible label" sub-part is a verified negative for all six. If a label catalogue outside this repository's `src/` is used at runtime, it was not available to inspect.
7. **`assertRustDatasetStructureProfile` (`src/atlas/MonetaEvidenceAuthority.ts:38-79`) type-checks none of the six fields.** Whether boundary validators should be extended for the renamed fields is a design question this inventory does not answer; it is recorded because it makes renames fail silently rather than loudly.

---

## Verification addendum (independent spot-check)

The following claims were independently re-checked against source on receipt of this inventory, because they are the ones that would drive TEC1/TEC2 tranche selection:

| Claim | Verified | Evidence |
| --- | --- | --- |
| Two different thresholds under one name | **Confirmed** | Rust `profile.rs:926` is `absolute > 0.6`; `SignatureBuilder.ts:88` is `absolute >= 0.5` |
| Adapter narrows all six names | **Partly false, as recorded** | `globalDensity` is retained verbatim at `StructureProfileEvidenceAdapter.ts:139` while `heuristicLocalDensityVariation` (`:140`) and `heuristicModeCount` (`:141`) are narrowed |
| Rust ABI test freezes `periodicityConfidence` | **Confirmed** | `wasm/src/data/spectral.rs:416` requires the camelCase key; `:425-428` assert snake_case keys are absent |
| `reRankCandidates` has no production caller | **Confirmed** | Grep for `reRankCandidates` / `adjustCandidateScore` / `adjustMonetaEvidence` / `adjustDracoEvidence` across `src/` and `tests/` returns only bridge definitions, facade re-exports, and `tests/evidence-draco.test.ts` |
| `ClusterProfile.density_variation` reaches ranking | **Confirmed** | Rust `profile.rs:544` is `if has_clusters { 0.25 } else { 0.0 }`; `FitnessModel.ts:374-381` derives `densityRelevant` from `signature.clusterStructure.densityVariation` and returns 1 or scores the candidate |

Recorded by: audit pass, 2026-09-21. Base `main@3198ff87`.

---

## Closure record — implementation slice (2026-09-21)

This slice implements the six migrations enumerated above. It **does not close TEC2**: other heuristic-named surfaces remain, and `docs/ROADMAP.md:155` still records TEC1 as open.

Branch: `feat/tec2-heuristic-terminology-migration`.

### Applied renames

| Former Rust field | New Rust field | Wire name | Adapter key |
| --- | --- | --- | --- |
| `significant_pairs_count` | `pairs_above_magnitude_threshold` | `pairsAboveMagnitudeThreshold` | `strongCorrelationPairCount` (unchanged) |
| `is_strong` (pair) | `exceeds_magnitude_threshold` | `exceedsMagnitudeThreshold` | `isStrongByMagnitudeThreshold` (unchanged) |
| `stability_confidence` | `heuristic_silhouette_partition_score` | `heuristicSilhouettePartitionScore` | `legacySilhouetteDerivedScore` (unchanged) |
| `global_density` | `heuristic_scale_density_proxy` | `heuristicScaleDensityProxy` | `heuristicScaleDensityProxy` (**renamed**) |
| `local_density_variation` | *removed* | *removed* | `heuristicLocalDensityVariation` (**removed**) |
| `is_sparse` | `heuristic_sparse_by_row_count` | `heuristicSparseByRowCount` | `heuristicSparseByRowCount` (**renamed**) |
| `periodicity_confidence` | `periodicity_heuristic_score` | `periodicityHeuristicScore` | `periodicityHeuristicScore` (unchanged) |
| `confidence` (`PeriodicityProfile`) | `heuristic_score` | `heuristicScore` | `heuristicScore` (unchanged) |
| `confidence_weight` (local) | `sample_count_weight` (local) | — | local only |

Renames were applied **at the Rust transport**, in place, with no `#[serde(alias)]` anywhere in `wasm/src/`. `docs/STATISTICAL_FOUNDATIONS.md:174` prefers adapter-only wrapping with unchanged serialized shapes; that preference is conditional, and the conditions here favour the transport rename — `docs/ROADMAP.md:167` explicitly sanctions "Rename", `:166` requires RFC/ADR governance only for an ABI/public-format change and this profile is internal transport with no persistence, export, replay or external consumer (which is `:174`'s own stated condition), and the precedent `period_samples` → `period_time_units` was performed on this same struct in place.

**Material-ABI threshold judged not met (stated explicitly rather than left to inference).** `docs/ROADMAP.md:166` requires RFC/ADR governance for "any material ABI/public-format change". This slice judged `DatasetStructureProfile` **not** to be a public format, so no RFC/ADR was raised. The judgment rests on the inventory's evidence and was independently re-verified by the post-implementation review: no persistence, export, replay or external consumer **of the profile or the evidence envelope as such** exists anywhere in `src/` (no `localStorage`/`sessionStorage`/IndexedDB of the profile, evidence or signature), the only producer is the live two-call WASM ABI, and the Rust profile cache is in-process only. **(Corrected 2026-09-23.)** That profile/envelope claim stands, but the paragraph under-described the signature level: two *deleted* `DatasetSignature` fields (`dependence.significantPairsCount`, `spectralStructure.periodicityConfidence`) had been written into historical persisted representation decisions (`investigation/representation.json`) and are digest-bearing in the v2 investigation digest. The material-ABI judgment stands — the slice renamed transport names and deleted type-level signature fields without touching any persisted representation payload, and historical packages replay verbatim — but the signature-level persistence is now recorded and governed by RFC 0008, and the "no persistence, export, replay" warrant above must not be read as covering the signature fields. The counter-indication is real and should be named: `wasm/src/data/spectral.rs`'s own test is called `spectral_facts_serialize_camel_case_for_wasm_abi`, i.e. the code calls this surface an ABI. The precedent rename (`period_samples` → `period_time_units`, commit `78a8815d`) was also performed in place without governance, so the practice is consistent. **Falsifier that would flip this judgment:** the appearance of any persisted, exported or replayed *profile* — at which point this becomes a material public-format change and requires RFC/ADR retroactively plus the `-v4` bump already bound to that condition above. (Signature-level persistence is not such a flip: those keys live in the already-versioned representation decision, not the profile transport, and RFC 0008 binds any mutation of them to an explicit format migration.)

### Findings this slice created

1. **There was a live TypeScript shadow analytical authority.** `SignatureBuilder.correlationSummary` recomputed a pair count in TypeScript at `abs >= 0.5` while Rust uses `abs > 0.6`, and labelled the result `'measured'` with the note "Computed by supplied Rust kernel Facts". The count field and the recomputation were **deleted**, not harmonised: changing `0.5` to `0.6` would have left TypeScript holding shadow authority on the exact field TEC2 names. `dependence.maxCorrelation` remains a genuine TypeScript reduction over kernel-supplied pairs and is unchanged.
2. **Most of these names failed silently when wrong.** Only `significant_pairs_count` and `periodicity_confidence` reached a guard that throws; the rest degraded to `undefined`. `assertRustDatasetStructureProfile` (`src/atlas/MonetaEvidenceAuthority.ts`) type-checked none of the six. It now asserts each renamed field's presence and type, and rejects each retired name if it reappears — including a per-pair and per-periodicity check. This is not a closed key set, deliberately: the payload has no schema-version field and no `deny_unknown_fields`, so a closed set would turn every future additive Rust field into a hard throw with nothing to version it against.

### Decision held: `algorithmSuite` stays `-v3`

No algorithm changed; every computation site is numerically untouched apart from the removal of a two-valued constant. Bumping the suite label would falsely advertise an algorithmic change, and it is asserted in `tests/wasm-columnar-structure-profile.test.ts`. **Falsifier that would flip this:** if the profile JSON ever becomes a persisted, replay or exported format, or any consumer begins keying on `methodVersion`, then `-v4` becomes mandatory in that same change.

### Open questions resolved

- **Q1 (which threshold is authoritative)** — resolved by deletion. The TypeScript `abs >= 0.5` recomputation is gone, so Rust's rule is the only one, and its literal is now the named `CORRELATION_MAGNITUDE_THRESHOLD`.
- **Q7 (validator hardening)** — resolved; see finding 2.
- **Q4 and Q5 (fixture values the producer cannot emit; the inverted `stabilityConfidence` fixture)** — **recorded, deliberately not corrected.** The implementation changed names only. Correcting `globalDensity: 0.5` / `1`, `localDensityVariation: 0.61`, and `stabilityConfidence: hasClusters ? 0.8 : 1` would mix a value change into a rename and weaken the "numerics unchanged" falsifier. These remain owned findings.
- **`dependence.maxCorrelation` provenance** — resolved in the 2026-09-23 follow-up slice: the legacy `SignatureBuilder` reduction over Rust-owned correlation pairs retains the same numeric maximum but is now labelled `derived`; the canonical `DatasetEvidence` path remains a direct Rust measurement and retains its `dependency:correlations` evidence identity. RFC 0008 historical persisted signatures remain replayed verbatim.
- **Q2, Q3, Q6** — unchanged and out of this slice's scope.

### Deferred, with reasons

- **`ClusterProfile.density_variation`** is *not* renamed. Unlike the six above it is behaviour-bearing: it reaches `FitnessModel.scoreDensityHandling` and a throwing equality gate in `DatasetEvidenceSignature.ts`. Renaming it changes behaviour, not just names, and needs its own contract. **(Resolved 2026-09-25 by removal under its own contract — see the closure record at the end of this document.)**
- **`EvidenceWeightedScorer`** keeps its `20.0` scale and its `(sampleCountWeight || 1.0)` zero-weight inversion, which diverge from Rust's `30.0`; only the local was renamed. The scorer still has no production caller.
- **`wasm/src/moneta/evidence.rs`** is unreachable — only the `draco` twin is exported through `draco_adjust_evidence`. Kept byte-identical to its twin as a convention; separate cleanup. **(Corrected 2026-09-25 — this is backwards; see the evidence-scorer authority closure record at the end.** `lib.rs` declares no `mod draco;`, so `draco::evidence` in the export resolves through `pub use moneta as draco` to `crate::moneta::evidence` — the *moneta* file is the one compiled implementation, and the whole `wasm/src/draco/` directory was never compiled. It was removed in the 2026-09-25 slice.**)

### Post-implementation adversarial review

A distinct adversarial review was run against the exact head, per `AGENTS.md`'s high-risk tier. Verdict: **safe to open as a PR; no blockers.** It independently re-ran the affected integration and WASM files, and confirmed I1–I7 as recorded in the commit's contract, with three qualifications worth preserving:

- **No TypeScript shadow authority survives, and the deletion was the right call.** The review verified by reading the code (not the comments) that no threshold comparison remains in `SignatureBuilder.ts`. It also established that the removed assertion in `tests/representation-signature.test.ts` never discriminated the two thresholds — its fixture pair used `value: 0.75`, which satisfies both `>= 0.5` and `> 0.6` — so deleting it cost no falsifying power. That finding retroactively justifies not "fixing" `0.5` to `0.6`.
- **The validator cannot reject a valid payload, but that was deduction, not execution.** Field-by-field against `wasm/src`, no reachable non-finite or absent case exists: `pearson_pairwise` is total (returns `0.0` for `n < 2`, for `denominator <= 1e-12`, and therefore for `NaN`), `separation_score` is a clamped silhouette or `0.0`, and `serde_json` emits `null` — never a number — for non-finite floats. The gap was that no test executed the renamed `spectral`/`temporal` checks against a real kernel payload: `tests/moneta-known-structure-campaign-wasm.test.ts` and `tests/atlas-graph-lineage-wasm.test.ts` use datasets where both records are `null`. **Remediated** by calling `assertRustDatasetStructureProfile` on the live profile in `tests/wasm-columnar-structure-profile.test.ts`, whose typed fixture is the only real payload with a temporal column.
- **The evidence boundary now throws where it previously degraded.** Several newly-asserted fields (`correlations.maxCorrelation`, `isRankDeficient`, `clusters.separationScore`, `hasClusters`, `density.modeCount`, `spectral.hasPeriodicity`) were never validated before. None can be violated by a current producer, so this is not a false rejection today — but the throw on this path is uncaught (`RustAnalyticalEvidenceAdapter.ts` calls `datasetEvidenceFromKernelProfile` directly, without the `_call` wrapper used by its siblings). That converts a future serde drift into an outage rather than a degraded read. Fail-closed is the intended direction; recorded here as an explicit decision rather than a discovered defect. **Falsifier:** if a schema-versioned profile format is introduced, this should be revisited alongside the `-v4` question.

Two further review findings are **recorded, not corrected**, consistent with the rename-only discipline above: the fixture values the producer cannot emit (Q4/Q5 — including the inverted `stabilityConfidence`, which is inert only because its adapter field has no reader) and the wording of the name-honesty invariant, where the adapter's `limitations` text contains the words "confidence" and "significance" inside a sentence that *denies* those claims. That sentence is load-bearing epistemic text and must stay; the invariant should be read as applying to keys and values, not to disclaiming prose.

### Verification performed

Real-WASM round-trip over `computeDatasetStructureProfile` → `structureProfileToDatasetEvidence` asserting that no transported value is `undefined`, no key matches `/significant|confidence|localDensityVariation/i`, each renamed field is present with the right type, the transported pair count agrees with the transported per-pair flags, and `heuristicScaleDensityProxy` stays inside its reachable set `{0.15, 0.4, 0.7}`. Plus negative boundary cases proving a payload with a **missing** renamed field throws and one carrying a **retired** name throws.

---

## Correction record (2026-09-23)

During RFC 0008 review (`docs/rfcs/0008-historical-dataset-signature-persistence.md`), the following claims in this inventory were found **false** and are corrected in place above, each carrying an inline "(Corrected 2026-09-23)" marker:

1. **§1.4** — "Persisted / serialized consumers — None … No evidence-signature or replay format encodes it" and "The only durable form is the in-memory `DatasetEvidence` envelope". False for `dependence.significantPairsCount`: pre-TEC2 the value was written into `DatasetSignature`, and decisions with their full signature are persisted verbatim in `investigation/representation.json` and digested in v2.
2. **§1.7** — "Persisted/serialized format impact: **none** — no fixture, receipt, or replay format records the name." False at the signature level; the compatibility-alias judgment that restated on that premise is re-grounded on verbatim-restore replay.
3. **§3.4 and §3.7** — the same signature-level omission for `spectralStructure.periodicityConfidence`; §3.7's "no on-disk fixture recording the value" is true only of `tests/fixtures/**`, not of persisted representation decisions.
4. **Summary table** — the "Persisted?" cells for rows 1 and 3 now read "Partially (corrected)". The "Persisted? No" cells for `stability_confidence`, `global_density`, `local_density_variation` and `confidence_weight` stand: those four never entered `DatasetSignature`, so the signature-level persistence applies to exactly two of the six fields.
5. **Closure record** — the "no persistence, export, replay or external consumer" warrant is narrowed to the profile/envelope it was actually verified against.

Claims that stand and are deliberately unchanged: every wire-name/transport claim (`DatasetStructureProfile` and its camelCase wire keys are not persisted, replayed, or encoded into any fixture, receipt or envelope), the Rust ABI-contract observations, the decision-bearing analysis (§1.3, §2.3, §3.3, §4.3, §5.x, §6.x), the verification addendum, and the post-implementation review record. The forward rule that grew out of this correction is RFC 0008: historical persisted decisions are restored verbatim as legitimate history, and any future stripping/normalizing of these persisted keys is an explicit, versioned format migration.

---

## `ClusterProfile.density_variation` closure record (2026-09-25)

This slice removes the behaviour-bearing density proxy deferred by the 2026-09-21 closure record above. It is a removal under an explicit contract, not a rename, and it does **not** close TEC2: inventory-confirmed residuals remain.

Branch: `feat/tec2-cluster-density-variation-contract`.

### What was removed, and where

| Surface | Change |
| --- | --- |
| `wasm/src/data/profile.rs` | `ClusterProfile.density_variation` deleted from the struct, the empty-profile constructor, and the bounded estimator; the constant `if has_clusters { 0.25 } else { 0.0 }` is gone. All unrelated clustering numerics (silhouette, separation, sampling, provenance manifest) are untouched |
| `src/data/evidence/RustStructureProfile.ts` | `RustClusterProfile.densityVariation` deleted from the transport mirror, with a tombstone comment recording why removal (not rename) is the remedy |
| `src/data/evidence/StructureProfileEvidenceAdapter.ts` | `heuristicDensityVariation` deleted from the canonical `cluster:global` evidence payload |
| `src/moneta/representation/DatasetEvidenceSignature.ts` | `datasetEvidenceToSignature` no longer reconstructs `clusterStructure.densityVariation` from cluster evidence and no longer marks the fact path `heuristic`; the path stays at its `unknown` default. `assertDecisionRelevantSignatureMatchesEvidence` no longer compares the field, because canonical evidence no longer emits a value to compare against |
| `src/atlas/MonetaEvidenceAuthority.ts` | `requireRetiredFieldAbsent(clusters, 'clusters', 'densityVariation')` — the live-payload one-way ratchet extends to the retired key, so a stale kernel build or `#[serde(alias)]` fails closed instead of silently re-publishing the bogus density quantity |

### What was deliberately preserved

- **`DatasetSignature.clusterStructure.densityVariation` stays an optional field with its fact path.** Unlike `dependence.significantPairsCount` and `spectralStructure.periodicityConfidence` it was never a retired *name* at the signature level; it is a compatibility surface for historical persisted decisions (which may carry the key under RFC 0008's verbatim-restore contract) and for future explicitly measured/derived density evidence. No historical persisted signature is rewritten.
- **`FitnessModel.scoreDensityHandling` is unchanged.** Its epistemic gate (`measured`/`derived` only) already ignored the heuristic value the canonical path used to manufacture; genuinely explicit measured/derived `densityVariation` continues to make density handling relevant. The removal therefore changes canonical behaviour (the proxy can no longer reach the ranking path at all) without touching the legitimate explicit-evidence semantics.
- **RFC 0008 replay is untouched.** The v2 falsifier (`tests/rfc0008-historical-dataset-signature-replay.test.ts`) runs verbatim against this change.

### Governance judgment

No new RFC is required. The Rust transport removal is the same class as the 2026-09-21 slice's material-ABI judgment: `DatasetStructureProfile` remains internal, non-persisted, non-replayed transport, and the falsifier recorded there (any persisted/exported/replayed *profile* flips the judgment) still has not fired. The signature-level surface that *is* persisted is preserved, not mutated, so no digest-changing format migration is triggered and RFC 0008's decision 2 is not engaged.

### Verification performed

Real-WASM round trip asserting the live `clusters` record no longer carries `densityVariation` and that no transported evidence key matches the retired terminology; boundary-validator negative case proving a payload re-introducing `clusters.densityVariation` throws; Rust unit test proving the serialized clustered profile JSON omits the key while still detecting a partition; canonical-signature assertions that `clusterStructure.densityVariation` is undefined with an `unknown` epistemic source on both the adapter path and the Atlas production path; an evidence-backed boundary case proving a legacy caller value is tolerated but not consumed; FitnessModel falsifiers proving heuristic/unknown-marked values cannot make density relevant while measured- and derived-marked values still can; and the RFC 0008 historical replay falsifier — run verbatim for the original two keys, plus a companion falsifier (`tests/rfc0008-cluster-density-variation-replay.test.ts`) proving a historical decision carrying the retired `clusterStructure.densityVariation` with its `heuristic` epistemic fact replays byte-verbatim, is digest-bearing, and fails closed on the manifest digest if the key is deleted or its value mutated. The original RFC 0008 suite file is untouched.

---

## Evidence-scorer authority closure record (2026-09-25)

This slice closes the sample-count scorer residual deferred by the 2026-09-21 closure record above: the TypeScript `EvidenceWeightedScorer` shadow ranking implementation, and the `wasm/src/draco/` stale twin directory. It does **not** close TEC2: inventory-confirmed residuals remain.

Branch: `feat/tec2-evidence-scorer-authority`. Base: `main@2c5aff4ebfd86e8f6e69e98cc07e62428590fc21`.

### Reachability re-proved at this head (not assumed from this inventory)

- `EvidenceWeightedScorer` had **no production caller**. Repo-wide grep at the base found only its own file, the barrel re-export (`src/moneta/evidence/index.ts:3`), and `tests/evidence-draco.test.ts`. Nothing under `src/vr/**`, `src/app/**`, `src/atlas/**`, `src/moneta/**` (outside its own directory) imported it; the `src/moneta/index.ts` barrel's only external consumers of the evidence barrel were the direct-file `PerceptualFitnessEvidence` imports, which do not touch the scorer. No persisted, serialized, replayed or fixture surface referenced it (§6.4 stands).
- `adjustMonetaEvidence` / `adjustDracoEvidence` also had no production caller, but they are thin transports that bind the single WASM export `draco_adjust_evidence` and contain **no TypeScript formula** — they are the sole path to the Rust authority, asserted by `tests/runtime-bridge-module-boundaries.test.ts` (export names + alias identity) and `tests/wasm-runtime.test.ts` (non-finite refusal). They were therefore **retained**: deleting the export would change the wasm ABI surface (generated `wasm/pkg` bindings) for a dormant-but-authoritative path, which this slice does not attempt.
- **The 2026-09-21 "Deferred" note about `wasm/src/moneta/evidence.rs` being unreachable was wrong and is corrected here.** `wasm/src/lib.rs` declares `pub mod moneta;` and `pub use moneta as draco;` and declares no `mod draco;` anywhere. Every `draco::*` path in `lib.rs` — including `draco_adjust_evidence` — resolves to `crate::moneta::*`. `wasm/src/moneta/evidence.rs` was therefore the one **compiled and exported** implementation, and the entire `wasm/src/draco/` directory (constraints.rs, evidence.rs, mod.rs, solver.rs, types.rs) was **never compiled**: no module declaration, no Cargo `[lib] path` attribute, no `#[path]` include anywhere in the crate. Its evidence twin was byte-identical; its constraints/solver/types twins had silently drifted from the compiled moneta versions.

### What was removed

| Surface | Change |
| --- | --- |
| `src/moneta/evidence/EvidenceWeightedScorer.ts` | Deleted. The 30.0 path, the divergent 20.0 path with `(sampleCountWeight \|\| 1.0)` (which inverted the kernel's fail-closed zero-observation semantics into a full-weight shift), and `reRankCandidates`'s evidence-adjusted candidate ordering are gone. Removal, not harmonisation: aligning the TS formula to Rust would have preserved a second ranking authority on the exact defect TEC2 names. |
| `src/moneta/evidence/index.ts` | Barrel export line removed. The barrel's remaining exports (`types`, `EvidenceStore`, `MonetaEmpiricalTuner`) are untouched; `src/draco/index.ts` compatibility facade re-exports the same barrel unchanged. |
| `wasm/src/draco/` (all five files) | Deleted as never-compiled dead source. This is behaviour-preserving by construction (nothing compiled it) and removes a stale source of truth a future reader could have "fixed" independently of the compiled moneta twin — the precise shadow-authority hazard this tranche closes. |

### What was deliberately preserved

- **`wasm/src/moneta/evidence.rs` numerics are untouched**: the 30.0 scale, the 0.5 neutral-utility baseline, the N=10 saturation, the `.max(0.0).round()` clamps, the zero-sample fail-closed path and the honest `sample_count_weight` naming (renamed by the 2026-09-21 slice) all stand. The only additions are `#[cfg(test)]` unit tests pinning these exact values.
- **`EvidenceStore`** is retained: it aggregates investigator study outcomes into the empirical input (`sampleCount`, `compositeUtility`) that the Rust authority consumes — TypeScript-owned interaction/orchestration data per `AGENTS.md` boundary 3, not a Rust duplicate. Its two surviving tests in `tests/evidence-draco.test.ts` cover this aggregation; the two scorer tests were removed with the scorer.
- **`MonetaEmpiricalTuner` and `EvidenceInformedRecommender`** are retained untouched. They remain dormant with no production caller (open question Q2 remains a product decision), but they are distinct study-outcome weight adjusters, not reimplementations of the Rust cost adjustment, and removing them is out of this slice's contract.
- **`EmpiricalOutcome.confidenceRating`** is retained: it is a participant's self-reported rating — a genuinely measured human response, not a manufactured statistical confidence.

### Falsifiers added

- `tests/moneta-evidence-scorer-authority.test.ts` (fast lane): fails if a TypeScript file reappears that recomputes the sample-count saturation weight (`sampleCount / 10`), uses `sampleCountWeight`, multiplies by the kernel cost-adjustment scales (`* 30 *` / `* 20 *`, with or without the `.0`), computes a utility delta from the 0.5 neutral baseline, or exports the removed ranking symbols; fails if `wasm/src/draco/` reappears or `lib.rs` stops routing `draco_adjust_evidence` through `draco::evidence::adjust_candidate_cost_with_evidence`; fails if the bridge alias stops mapping to the single WASM export; fails if sample-count weighting is relabelled confidence in the kernel or in `src/moneta/evidence/**`. Comments are stripped before scanning, so explanatory prose cannot trip the falsifier, and reintroduction of the deleted formula verbatim was verified to fail the suite (then pass again on removal).
- `wasm/src/moneta/evidence.rs` unit tests: absent evidence, zero sample count (fail closed to base cost), N=5 sub-saturation (delta `(-4.5).round() = -5`, documenting the half-away-from-zero rounding), N=100 saturation cap, below-neutral utility, and the zero floor.
- `tests/wasm-runtime.test.ts` real-WASM bridge test: exact adjustedCost/delta values through `bridge.adjustMonetaEvidence` and the alias for the same cases, including zero-sample and `null`-evidence fail-closed behaviour — production-path evidence that the sole authority path enforces the pinned semantics.

### Residual risk

The bridge and WASM export remain dormant (no production caller); their liveness is question Q2, unchanged by this slice. The Rust unit tests and a fresh `wasm:dev` build were not runnable in the authoring environment (no MSVC host linker locally; the pre-existing `wasm/pkg` is behaviour-identical because the kernel diff is test-only plus never-compiled deletions); both run in CI, whose result governs promotion.

---

## Q4/Q5 fixture-fidelity closure record (2026-09-26)

This slice closes the fixture residuals the 2026-09-21 closure record deliberately deferred ("recorded, deliberately not corrected… remain owned findings"). It is a test-contract slice: **no production code, kernel numerics, ABI, wire key or persisted format changes.** It does **not** close TEC2; Q2, Q3 and Q6 remain open, and any further inventory-confirmed residuals remain open.

Branch: `feat/tec2-residual-reconciliation`. Base: `main@02627e1a384a37590980973917e586fa6ae8d02b` (#817).

### Reachability re-proved at this head (not assumed from this inventory)

Under the post-rename field names, the invented values had **no production reader**:

- `heuristicSilhouettePartitionScore` is transported as `legacySilhouetteDerivedScore` (`StructureProfileEvidenceAdapter.ts`), which has no destination in `DatasetSignature` and no decision reader (`FitnessModel` gates on `clusterStructure.hasClusters`/`separationScore`, never on the silhouette-derived score).
- `heuristicScaleDensityProxy` and `heuristicSparseByRowCount` are transported into the `density:global` evidence item, which `DatasetEvidenceSignature` never reconstructs (`DatasetSignature` has no density section) and no decision path reads.
- No digest, snapshot, golden file or persisted payload records any of these values. The only assertions on the invented literals were the adapter-mapping assertions echoing the same fixtures themselves (the density block of `tests/dataset-evidence-wiring.test.ts`), which this slice updated in lockstep with the fixtures; no independent assertion pinned them to the producer.

So the defect was **contract fidelity, not behaviour**: every mock-seam test validated the adapter/boundary against payloads the kernel can never emit, and the shared helper taught the *inverse* of the producer's fail-closed silhouette rule (1 when no partition detected, where the producer reports 0). The concrete drift-masking mechanism: a producer change to these value rules (or an adapter/validator change that coerced them) would leave every mock-seam test green, because the fixtures never encoded the producer contract. The real-WASM lane pinned only reachable-set *membership* for the density proxy on a single 8-row dataset, and no test anywhere pinned the empty-profile silhouette rule or the clustered silhouette/separation affine relation. A fresh adversarial pass against the slice's first head additionally established that the shared helper's cluster *sampling manifest* was producer-unreachable above 65,536 rows (`method: 'full-complete-row-kmeans'`, `samplingSeed: null`, `sampleCount = rowCount`, `sourceObservationsPerSample: 1` at `rowCount` up to the 10,000,000 used by `tests/moneta-scale-exit.test.ts`, where the producer switches to the fixed-seed bottom-k method and caps the sample at 65,536); that infidelity is corrected in the same slice rather than deferred, because `tests/moneta-scale-exit.test.ts` drives exactly that large-N regime.

### What was corrected

| Surface | Former (invented) | Now (mirrors the Rust producer, `wasm/src/data/profile.rs`) |
| --- | --- | --- |
| `tests/helpers/moneta-kernel-fixture.ts` — `heuristicSilhouettePartitionScore` | `hasClusters ? 0.8 : 1` (inverted: 1 when no partition) | `hasClusters ? clamp(separationScore * 0.9, 0.1, 1.0) : 0` — the exact affine rescale and the fail-closed zero |
| `tests/helpers/moneta-kernel-fixture.ts` — `heuristicScaleDensityProxy` | constant `0.5` (unreachable) | derived from `rowCount`: `>= 50 -> 0.7`, `>= 20 -> 0.4`, else `0.15` |
| `tests/helpers/moneta-kernel-fixture.ts` — `heuristicSparseByRowCount` | constant `false` | derived: `rowCount < 15` |
| `tests/dataset-evidence-wiring.test.ts` (fixture + narrowing assertion) | `0.5` with `rowCount: 42` | `0.4` (the producer's `>= 20` branch for 42 rows; sparse `false` was already correct) |
| `tests/atlas-moneta-evidence-authority.test.ts` | `0.4` with `rowCount: 128` | `0.7` (the `>= 50` branch) |
| `tests/evidence-backed-moneta.test.ts` (density item, `rowCount: 10`) | `heuristicScaleDensityProxy: 1`, `heuristicSparseByRowCount: false`, `heuristicModeCount: 1` constant | `0.15`, `true`, and `clustered ? 2 : 1` mirroring `mode_count = estimated_count` |
| `tests/evidence-backed-moneta.test.ts` (cluster item) | `legacySilhouetteDerivedScore: clustered ? 0.7 : 0` alongside `heuristicSeparationScore: 0.7` | `clustered ? 0.63 : 0` — the producer relation (score = separation * 0.9); `0.7` was reachable in isolation but not jointly with separation `0.7` |
| `tests/representation-preview-purity.test.ts` (density item, `rowCount: 10`) | `1` / `false` | `0.15` / `true` |
| `tests/helpers/moneta-kernel-fixture.ts` — bounded sampling manifest (found by this slice's adversarial pass) | `method: 'full-complete-row-kmeans'`, `samplingSeed: null`, `sampleCount: rowCount`, `sourceObservationsPerSample: 1` at any `rowCount`, including > 65,536 | derived: `method`/`samplingSeed: 0x4e4d5359`/`sampleCount`/`sourceObservationsPerSample`/`silhouetteSampleCount` follow the producer's `MAX_CLUSTER_SAMPLE_ROWS` (65,536) bottom-k contract |

All other fixture fields (including `heuristicSeparationScore`, `heuristicEstimatedCount`, `heuristicPartitionDetected`, and the deliberately synthetic provenance block of the fake kernel) are unchanged, because they were already producer-consistent or are explicit caller options.

### Falsifiers added

- `tests/moneta-kernel-fixture-producer-contract.test.ts` (fast lane): fails if the shared helper regresses to a value outside the density-proxy reachable set `{0.15, 0.4, 0.7}` or to a constant sparse flag; fails on any positive partition score when no partition is detected (the exact prior inversion); pins the `clamp(separation * 0.9, 0.1, 1.0)` relation, `modeCount === estimatedCount`, and the bounded bottom-k sampling manifest on both sides of the 65,536-row boundary.
- `tests/wasm-columnar-structure-profile.test.ts` (real-WASM lane): row-count-parameterized datasets pin the exact producer thresholds on the real kernel — 3 and 14 rows give proxy `0.15` and sparse `true`, 19 gives `0.15`/`false`, 20 and 49 give `0.4`/`false`, 50 gives `0.7`/`false` — and pin the empty-profile path (fewer than six complete rows): `hasClusters: false`, `heuristicSilhouettePartitionScore: 0`, `separationScore: 0`, `estimatedCount: 1`, `modeCount: 1`. A two-blob dataset pins the clustered affine relation `heuristicSilhouettePartitionScore === clamp(separationScore * 0.9, 0.1, 1.0)` with a non-vacuous `hasClusters` precondition. These are the authoritative anchors the mock-seam fixture mirrors; if the producer semantics ever change, these tests force the fixture change with them instead of letting the seam silently absorb the drift.

### Deliberately not changed

- **No Rust code, no production TypeScript, no ABI/wire/persistence surface.** No WASM rebuild was performed and none is needed (`wasm/pkg` is a gitignored local build artifact, not a committed surface; CI rebuilds it keyed on the Rust source hash); the real-WASM falsifiers run against the same build the production path loads.
- **The fake kernel's synthetic provenance** (`kernelVersion: 'wasm-kernel-test-fixture'`, `algorithmSuite: 'structure-profile-v1'`) is unchanged: it is deliberately synthetic identity for a stand-in kernel, presence-checked by the boundary validator, and changing it would mix value-mirroring into identity-synthesis.
- **`estimatedCount`/`hasClusters` option semantics in the helper** are unchanged: callers may still request combinations (e.g. `clusterCount: 4` with `hasClusters: false`) that the producer's internal derivation would not pair, and `separationScore`/`hasClusters` pairings below the producer's 0.35 silhouette-detection threshold remain caller-requestable. Only the four identified invented-value defects were corrected (the three from the inventory plus the large-N sampling manifest found by this slice's adversarial pass); a full option-consistency sweep is not warranted by evidence and would expand the test-contract diff.
- **Q2 (`MonetaEmpiricalTuner` / `EvidenceInformedRecommender` / `draco_adjust_evidence` liveness)** remains an open product decision. Fresh audit at this head confirms both adjusters have no production caller (barrel re-exports and their own tests only) and that neither reimplements the Rust cost adjustment: they aggregate human study outcomes (accuracy/F1/duration/NASA-TLX, success rates) into study-outcome weights, which is TypeScript-owned interaction/orchestration data under `AGENTS.md` boundary 3, not analytical dataset facts. `EvidenceInformedRecommender`'s hardcoded layout priors (`tda_mapper: 1.2` etc.) are an invented preference table worth revisiting **if** that module is ever wired live; dormancy plus boundary-3 ownership means deletion is not warranted now.
- **Q3 (`EvidenceReceiptStabilityV1`)** remains open by design: the receipt slot is honest (`stability: null` means not established, per `STATISTICAL_FOUNDATIONS.md`), and populating it requires a real resampling stability implementation that does not exist.
- **Q6** remains a verified negative (no investigator-visible label for any of the inventoried fields).

### Verification performed

Every fast-lane and integration-lane file touched by or consuming this change passes at this head, including every consumer of the shared helper and `tests/helpers/kernelMock.ts`, and the real-WASM `wasm-columnar-structure-profile` suite passes. `typecheck`, `lint` (0 errors; the 260 warnings are pre-existing and none are in touched files) and `docs:check` pass. The full fast and integration lanes additionally show pre-existing environment-specific failures in the `pt4b-*`, `pt6c-*`, `pt6d-*` and `pt8-*` governance planes on this Windows host; they reproduce identically on clean `main@02627e1a` (verified by stashing this slice) and are unrelated to it. CI governs those lanes. The Rust/host `cargo test` lane could not run locally (no MSVC host linker); no Rust source changed in this slice, so CI's Rust lane is unaffected beyond re-running.

---

## Topology-absence epistemic honesty closure record (2026-09-26)

This slice closes the absence-as-`derived` epistemic mislabel inventoried in `docs/audits/TEC3_FALSIFIER_COVERAGE_INVENTORY_2026-09-21.md` §4.2 (Collapse 1) and its open question 2, which that inventory's verification addendum classified as TEC2/TEC3 remediation debt ("a fixture and a label fix") and named "the single most load-bearing line" of the no-structure/insufficient-information collapse. It is a label fix on the canonical epistemic map: **no analytical value, wire key, ABI, kernel numerics or persisted historical format changes.** It does **not** close TEC2; Q2, Q3 and Q6 remain open, and any further inventory-confirmed residuals remain open.

Branch: `feat/tec2-topology-absence-epistemic`. Base: `main@61073bc44ccdf84bd50a31c5b181efee428d2bc1` (#818).

### The defect

`datasetEvidenceToSignature` (`src/moneta/representation/DatasetEvidenceSignature.ts`) recorded the epistemic fact `topologicalStructure.topology` with source `derived` — an established classification — whenever no structured-topology evidence item existed, with a note asserting that the "canonical structure profile classifies the dataset as TABULAR". Neither claim held:

- the Rust producer's non-emission of a topology record conflates not-applicable, fail-closed (e.g. a spectral sampling gap) and not-declared states across the four topology families (TEC3 inventory, Collapse 3), so it is not a topology classification;
- the `TABULAR` value comes from that module's own `inferTopology` fall-through, not from the kernel — a TypeScript-side classification manufactured over absence, the exact second-authority hazard this tranche closes.

The identical class of absence was already recorded honestly one branch below as `unknown` (`topologicalStructure.hasCycles`, "Rust graph profile did not include cycle analysis"), making the two branches mutually inconsistent.

### What changed

| Surface | Change |
| --- | --- |
| `src/moneta/representation/DatasetEvidenceSignature.ts` | The topology-absence branch now records source `unknown` (was `derived`) with an honest note stating the TABULAR value is a compatibility default, "not a measured or derived classification"; the stable `structure-profile/topology-absence` method identifier is retained |

### What was deliberately preserved

- **The `TABULAR` compatibility value and `inferTopology` are unchanged.** The TEC3 addendum established that no production code reads the epistemic source of `topologicalStructure.topology`, and the value is used only to *grant* boosts, never to deny them — the absent-structure case "simply fails to earn a boost". The mislabel was a latent integrity defect, not a demonstrated decision error, so a value or decision-behavior change was not warranted by evidence.
- **The presence branch is unchanged**: a topology evidence item still marks the fact `derived` with that item's evidenceId/method.
- **`cardinality.edgeCount` graph-absence marking is not the same defect and is unchanged.** `analyze_graph` (`wasm/src/data/profile.rs:610-613`) returns `None` iff the dataset's declared edges are empty — exactly one meaning — so `edgeCount: 0` marked `derived` is a true statement about the declared schema. The topology absence, by contrast, spans four families whose `None` has multiple meanings.
- **`FitnessModel`, the decision-relevance equality gate and RFC 0008 replay are untouched.** Verified at this head that the only production readers of epistemic sources are `FitnessModel.ts` (`clusterStructure.hasClusters`, `distribution.highVariance`, `cardinality.depth`, `clusterStructure.densityVariation`); none reads topology's source, so no ranking or gating behavior changes. The equality gate compares topology *values*, not sources. Historical persisted decisions carrying the old `derived` fact replay verbatim per RFC 0008.

### Falsifiers added (`tests/rf045-signature-evidence-truth.test.ts`)

- **Topology-absence case:** canonical signature from a profile with no graph/hierarchy/temporal/spatial records asserts `topologicalStructure.topology === 'TABULAR'` (value compatibility unchanged) with epistemic source `unknown`, method `structure-profile/topology-absence`, and a note that matches /not a measured or derived classification/.
- **Presence regression guard:** the graph-present case now additionally asserts `topologicalStructure.topology` is `derived` with evidenceId `topology:graph`, so over-correcting the presence branch fails the suite.

Reintroducing `derived` on the absence branch fails the first falsifier; over-correcting the presence branch fails the second; changing the compatibility value fails the first plus the existing FitnessModel/equality-gate suites.

### Verification performed

Integration-lane suites covering every consumer of the canonical signature path pass at this head: `rf045-signature-evidence-truth`, `evidence-backed-moneta`, `representation-signature`, `dataset-evidence-wiring`, `atlas-moneta-evidence-authority`, `moneta-scale-exit`, `signature-epistemic-maxCorrelation`, `moneta-stability-certificate`, `atlas-graph-lineage-wasm`; real-WASM lane: `frequency-field`, `moneta-known-structure-campaign-wasm`, `wasm-columnar-structure-profile` (no Rust source changed, so no WASM rebuild is involved). `typecheck` passes and `eslint` reports no issues on both touched files. CI governs the full lanes.

### Residual reconciliation at this head

- **Q2** — re-verified: `MonetaEmpiricalTuner` and `EvidenceInformedRecommender` still have no production caller (their own modules, the barrel re-exports, and `tests/draco-empirical-tuner.test.ts` / `tests/research-position-draco-hardware.test.ts` only); the durable disposition recorded in the Q4/Q5 closure record above stands unchanged. This slice does not touch them.
- **Q3** — `EvidenceReceiptStabilityV1` remains honest-null; populating it requires a real resampling stability implementation that does not exist (implementation-sequence step 8 in `docs/STATISTICAL_FOUNDATIONS.md`; promotable stability remains governed by RFC 0006). Not populated by this slice.
- **Q6** — re-verified negative: no investigator-visible label surfaces any inventoried field. A full `src/**` scan at this head finds remaining `confidence`/`significance` tokens only where honest: researcher self-reported judgement vocabulary (`DiscoveryEpisode`, `EpistemicObject`, `Finding.confidence: 'preliminary'|'validated'|'definitive'`), interaction-layer intent-parse match scores (`IntentCompiler`, TypeScript-owned orchestration per boundary 3, not analytical evidence), hardware gesture-recognition confidence, and `PromotionGate`'s `GROUP_WIN_EVIDENCE_NOT_SIGNIFICANT`, which is backed by an actual one-sided exact sign-test p-value over independent groups — an explicit testing procedure, satisfying the governing principle 8.
