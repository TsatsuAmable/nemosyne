# TEC3-MA2 Control Harness — First Slice Calibration Report

- **Status:** first bounded slice of MA2 (deterministic control fixtures + this calibration report for five metric families). This is **not** MA2 completion, and it makes no promotion-eligibility statement. TEC3 remains open; every disposition below is family-specific and none is a universal calibration claim.
- **Date:** 2026-10-02
- **Base:** `main` @ `1a66850b` (branch `feat/tec3-ma2-control-harness`, in-progress worktree)
- **Scope discipline:** no production source was changed. `src/**` untouched; the only Rust changes are new `#[cfg(test)]` tests appended to the existing test module in `wasm/src/data/profile.rs`. No ABI, wire key or persisted-format surface was touched. No threshold, weight or floor was changed or added; where a control's design conflicted with the current behaviour of a threshold, the current behaviour was recorded and the refusal noted here (see §1, §4).
- **Entry ids** (`F-*`, `K-*`) cite `docs/audits/TEC3_METRIC_ADMISSIBILITY_INVENTORY_2026-10-02.md` ("MA1") throughout.
- **Governing rule** (`docs/ROADMAP.md`, TEC3-MA table): metric presence is not metric admissibility; each decision-bearing metric needs evidence it can discriminate a positive from a negative control in its declared regime, recorded here DRF-like as the observed positive/negative separation on the metric's own decision scale — reported as measured, not massaged — plus family-specific diagnostics, or an explicit `NOT_CALIBRATABLE_FOR_DECISION` disposition.
- **Rust lane note:** per the standing record, cargo does not run on this Windows authoring host (no MSVC toolchain); the Rust control tests in `wasm/src/data/profile.rs` execute in CI only. Every numeric value asserted in them was verified before being pinned by an exact TypeScript transcription of the invoked kernel kernels — `statistics_columnar.rs` (`numeric_stats`, `outlier_count`, `median_of`, `iqr_and_multimodality`), the profile.rs cluster/silhouette pipeline including the bit-exact u64 `cluster_sample_key`/`mix_cluster_hash` subsample ordering, and `spectral.rs` (Hann-windowed DFT, power/entropy thresholds) — executed locally with the exact fixtures (including the external `statify` crate's skewness, which supplies `max_skewness` — its symmetric-deviation cancellation keeps the `1e-9` pin safe under rounding residue of order `1e-15`). The pinned numbers below therefore carry the same provenance: verified by transcription, CI-confirmation outstanding.
- **Verification (this host):** `npm run test:fast -- tests/tec3-ma2` (equivalent to `npx vitest run --config vitest.fast.config.ts` over the three files) → 3 files, 10 tests, all passing; `npm run test:fast -- tests/tec3`, `npm run typecheck`, `npm run lint`, `npm run docs:check` recorded at the end of this slice's lane log.

---

## 1. F-1/F-9 (CLUSTER boost): canonical positive/negative separation is zero

**Controls** (kernel-mock `RustDatasetStructureProfile` intake through the canonical path — `structureProfileToDatasetEvidence` → `datasetEvidenceToSignature` → production `BootstrapFitnessModel.evaluate` on the `CLUSTER_REGIONS` candidate; `tests/tec3-ma2-fitness-model-controls.test.ts`):

- **Positive:** 200 rows, `hasClusters: true`, three clusters, `separationScore: 0.8`.
- **Negative:** identical shape, `hasClusters: false`, `separationScore: 0`.

**Observed control separation (D, on the structure rawScore scale, range [0,1]):** `D = (s_pos − s_neg)/(1 − 0) = (0.58 − 0.58)/1 = 0.0`. Utility scores were likewise observed identical during authoring (`0.7920909…` both) but are not pinned by a fixture — the pinned facts are the rawScores. The gate blocks the boost because the canonical producer labels `clusterStructure.hasClusters` `heuristic` (`DatasetEvidenceSignature.ts:261-271`) and `FitnessModel`'s gate admits only `measured|derived` (`FitnessModel.ts:247-255`).

**Diagnostic — the reachability route is the epistemic flip, not either intake path:** flipping only the label via `markDatasetSignatureFact(pos.epistemic, 'clusterStructure.hasClusters', 'measured')` moves the structure score to `0.965`, i.e. the full ladder step minus baseline is reachable (`D = 0.385`). The discrimination the metric could in principle provide is fully present in the evidence and fully discarded by the gate.

**MA1 §4 correction (observed, not reconciled):** MA1 §4 states the affected boosts fire "only through the legacy `buildDatasetSignature`/`SignatureBuilder` path or historical persisted signatures." The first (legacy) half is **false in this build for the CLUSTER boost and the high-variance half of the DISTRIBUTION boost**: the legacy producer leaves `clusterStructure` empty in both branches (its "Do NOT populate" contract at `SignatureBuilder`), never populates `highVariance`, and consequently the legacy structure score for the same positive/negative fixture pair is the same `0.58` — `D = 0.0` on the legacy path too. Legacy *does* produce `distribution.hasOutliers` as `measured` (see §2). The canonical half of §4's finding is confirmed exactly. No production change was made to reconcile this; it is recorded here as observed truth for MA2's purposes (controls authored against the legacy route would falsify nothing, as MA1 warned — indeed the legacy route does not even exist as a firing route for these two facts).

Family diagnostics: none beyond the gate itself; the underlying kernel metric (K-1) has its own confounds, measured in §4.

## 2. Distribution boost halves (F-10 highVariance; K-8 hasOutliers): one gated dead, one ungated and firing on a `heuristic` label

**Controls** (same intake path, `DISTRIBUTION_FIELD` candidate, `DISTRIBUTION` family; same test file):

- **High-variance positive:** identical profile with `globalHighVariance: true` (no outliers). Observed source of `distribution.highVariance`: `heuristic`. Structure rawScore `0.43`.
- **Negative:** the same profile with neither flag set. Structure rawScore `0.43` (measured in the suite alongside the positive, `tests/tec3-ma2-fitness-model-controls.test.ts`, not inferred from ladder arithmetic).
- **Outlier positive:** profile with the kernel-coupled outlier pairing (`globalHasOutliers: true` OR-coupled to `anomalies.hasAnomalies`, mirrored from the Rust producer). Canonical source of `distribution.hasOutliers`: `heuristic`. Structure rawScore `0.78`.

**Observed control separations:** highVariance half `D = (0.43 − 0.43)/1 = 0.0`; outlier half `D = (0.78 − 0.43)/1 = 0.35`.

**Diagnostic (gate asymmetry):** the DISTRIBUTION boost branch is not epistemically gated, so it fires on a fact the canonical producer labels `heuristic` — the exact label class the CLUSTER branch refuses. The two halves of one boost behave oppositely under the same labels: the variance half is gated dead (`D = 0`), the outlier half fires (`D = 0.35`) on `heuristic`. This asymmetry is itself evidence that the boost ladder is not applying one uniform epistemic policy, and that `D = 0.35` is not a calibration of anything — it is a hand-set ladder step taken by an ungated heuristic label.

**Disposition: NOT_CALIBRATABLE_FOR_DECISION** for the DISTRIBUTION structural boost as an admissibility input (MA1 §4; F-1's ladder is a hand-set table by MA1 §1). The high-variance half additionally retains MA1 F-10's recorded confound (absolute raw-unit threshold `var > 100.0`, unit-dependent — see the kernel-side unit-rescaling control in §3's Rust companion, which demonstrates the identical-information flip).

## 3. K-8 (anomaly-score floor): the floor binds only in a degenerate regime, and the value does not survive canonical TS intake

**Kernel-side controls** (companion `#[cfg(test)]` tests in `wasm/src/data/profile.rs`, cargo/CI-only):

- **Planted positive:** 24 rows at `0.0` plus one at `1000.0`. Observed: `total_anomalies = 1`, `max_anomaly_score = √24/5 ≈ 0.9798` — **not** the 0.2 floor. With population variance the score is `max_deviation/std/5`, and `rms ≤ max_deviation` implies the clamped ratio can never fall below 0.2 for an extreme outlier; the floor is mathematically unreachable for the planted-outlier regime the rule seems written for. Pinned as honest observed truth (the tentative prediction of a floor-bound score in the slice brief was rejected in favour of the measured value).
- **Floor-binding (degenerate) control:** 24 rows at `0.0` plus one at `1e-12`. Observed: `max_anomaly_score == 0.2` exactly — but only because the column's population std (`≈1.96e-13`) falls below the `std > 1e-9` guard (`profile.rs:903`) that excludes it from the deviation-normalized maximum; the same column is simultaneously classified constant (range `1e-12`). The floor is reachable only through columns the same kernel calls constant while counting their outlier.
- **Clean negative:** 25-row arithmetic progression (max modified z `0.6745·12/6 = 1.349 < 3.5`). Observed: zero anomalies, `max_anomaly_score = 0.0`.

**TS readback controls** (`tests/tec3-ma2-anomaly-floor-readback.test.ts`, canonical intake): the floor value does transport into `DatasetEvidence` (`anomaly:global` item: `totalAnomalies`, `anomalyFraction`, `heuristicAnomalyDetected`, `maxAnomalyScore: 0.2`), but **the decision signature has no `maxAnomalyScore` field at all** — it carries only `hasOutliers`/`outlierFraction`/`anomalyCount`/`highVariance`. Any downstream consumer reading the signature (including the F-1 distribution family) cannot read the floor-quantitative value; the negative control readbacks (`0`/`false`) are cleanly distinguishable.

**Refusal recorded:** the temptation to make the floor "bind" on the planted control by retuning the normalization or the guard was refused — no production value was changed; the honest truth is that the floor is a near-dead term whose only reachable binding regime simultaneously flags the column as constant, and whose value is not decision-reachable through the signature.

**Disposition: NOT_CALIBRATABLE_FOR_DECISION** as an anomaly-severity input: the score is not measurable in the ordinary regime (saturates at the clamp), is unreachable except in a degenerate regime, and is not transported to the decision signature. `anomaly_fraction` remains separately confounded per MA1 K-8 (heuristic-labelled fractions) and was not re-litigated here.

## 4. K-1 separation/cluster estimation: cap confound and subsample-ordering confound, measured

**Kernel-side controls** (companion `#[cfg(test)]` tests in `wasm/src/data/profile.rs`, cargo/CI-only; values verified by exact TS transcription of the k-means + silhouette pipeline and bit-exact u64 subsample ordering):

- **Positive (5 separated clusters):** 60 rows, five well-separated 12-row planar clusters (within-cluster jitter 0.2, between-centroid distance 10). Observed at kernel subsample order: `has_clusters = true`, best silhouette `0.6812` (k=3 selected), **`estimated_count = 3 = MAX_CANDIDATE_CLUSTERS`** — the kernel detects a real partition but cannot report more than three groups, so five true clusters are admitted as three. `density.mode_count` inherits the capped estimate, propagating the confound into the density family (K-10).
- **Negative (20×20 lattice, 400 rows):** perfect grid, no partition structure. Observed: `has_clusters = false`, best silhouette `0.2832` — a genuine but thin margin (0.067 below the 0.35 threshold at kernel order).
- **Refusal recorded — uniform random noise is NOT a usable negative control for this family, and was not massaged into one:** under the kernel's exact hash-ordered silhouette subsample, 500 rows of uniform noise in the plane yield silhouette `0.381 > 0.35` → `has_clusters = true`. Uniform random noise, the textbook absence-of-clustering control, is classified as clustered by this estimator at its default subsample order. Permutation stress (48 hash-order variants) pushed several noise-like, ring and Kronecker candidates across the 0.35 line (up to `0.478`), so the metric's verdict is materially subsample-order-coupled for noise-scale inputs; only the lattice fixture is robustly negative in all sampled orders while remaining negative at the kernel's own order. The false-positive behaviour was recorded, not tuned away — changing the estimator, the seed, the sample count or the threshold is a production change outside this slice's remit.

**Disposition: NOT_CALIBRATABLE_FOR_DECISION** as a cluster-count or cluster-strength ranking input: the count is capped at 3 (K-1 confound, now demonstrated rather than inferred from code), the strength scale is subsample-order-coupled near the threshold, and the textbook negative control classifies as positive. A DRF-like separation between the lattice negative (0.2832) and the five-cluster positive (0.6812) is **non-zero (D ≈ 0.398 raw, 0.398 on the [0,1] scale)**, but the cap confound and noise false-positive make that separation unusable for a count-or-strength decision; it is recorded as a fixture-level diagnostic for MA3, not a calibration.

## 5. K-5 periodicity: kernel negative control supplied; null closure measured at the TS layer

**Positive control** already exists (`tests/uxr3-spectral-transfer-wasm.test.ts:61-103`, sine series through the live wasm lane) — referenced, not duplicated. Its negative counterpart was the MA1-recorded gap (§5, K-5).

**Kernel-side negative control** (companion `#[cfg(test)]` test in `wasm/src/data/profile.rs`, cargo/CI-only): 256 rows at regular `Δt = 1.0`, values drawn from an Irwin–Hall (12-lap) sum with fixed seed `0x4e4d_5359` — bell-shaped, spectrum-flat, reproducible. Observed: `method = "regular-time-fft"`, `power_spectrum_peak = 0.036` (margin 0.314 below the 0.35 threshold), `spectral_entropy = 0.921` (margin 0.171 above the 0.75 threshold), `has_periodicity = false`, `has_seasonality = false`. The negative control closes the missing piece far from the decision boundary on both AND-branches; the region *near* the thresholds (the regime one would need for a separation measurement) is deliberately not sampled here and remains uncalibrated.

**TS null-closure controls** (`tests/tec3-ma2-spectral-null-closure.test.ts`):

- **Refusal (null):** a profile with `spectral: null`. Observed: no `spectral:global` evidence item; `signature.spectralStructure === null`; `epistemic.facts['spectralStructure.hasPeriodicity'].source = 'unknown'`. Nothing in the intake payload distinguishes the **invalid-domain refusal (irregular sampling)** from the **insufficient-information refusal (< 4 observations)**: both collapse to the identical `null` wire value at the ABI (`wasm/src/lib.rs` `data_compute_spectral_facts`; MA1 cites the pre-drift lines 813-826 — the export region sits near line 852 at this base, a line drift only) and are reproduced as null by the TS bridge (`DatasetHandleBridge.ts` `computeSpectralFacts`). Consumers cannot re-classify or re-quantify the refusal reasons from canonical intake.
- **Emitted negative (distinguishable):** a profile carrying an emitted negative result (the magnitudes of the §5 kernel control). Observed: `spectralStructure.hasPeriodicity === false` with the spectral numbers present, epistemic source `heuristic`. "No result" and "result says no" are therefore distinguishable at the TS layer only when the kernel emits; domain and information refusals are not.
- Trend evidence survives a spectral refusal and the seasonality claim is withheld (`temporalStructure.isTimeSeries` set, `spectralStructure` null), matching the adapter's documented withholding contract.

**Disposition: NOT_CALIBRATABLE_FOR_DECISION** for the periodicity boolean as an admissibility input (MA1 §4 FREQUENCY-boost reachability applies like §1, and the family has no threshold-proximate controls); the *null-closure* property itself is now measured and passes (refusals fail closed to an unobservable, uniformly-typed value), which is the K-5 finding MA3 will need.

---

## Families covered vs open

**Covered by this slice:** F-1/F-9 CLUSTER canonical + gate-flip + legacy-route check (§1); DISTRIBUTION boost halves — outlier half + highVariance half (§2); K-8 anomaly floor kernel + TS readback (§3); K-1 cap and subsample-ordering confounds (§4); K-5 periodicity negative + null closure (§5). Test artefacts: `wasm/src/data/profile.rs` (7 new `#[cfg(test)]` controls, CI-only lane), `tests/tec3-ma2-fitness-model-controls.test.ts`, `tests/tec3-ma2-anomaly-floor-readback.test.ts`, `tests/tec3-ma2-spectral-null-closure.test.ts` (registered in `tests/config/test-groups.ts` fast lane).

**Open for MA2 (MA1 §5's remaining uncalibrated families, none started):** F-3 scale envelope, F-4 informationPreservation, F-5 densityVariation term, F-7 perceptualFitness, F-13 p≥n gate, F-14 DecisionPolicy thresholds, F-15 sensitivity rate, F-16 mismatch gate; K-3 correlation magnitude rule, K-6 periodicityHeuristicScore, K-7 trend/seasonality, K-9 graph, K-10 density bands, K-11 geospatial name-sniff, K-12 effective dimensions, K-13 dormant sample-count weight; P-1..P-5 (PT9 accuracy, sign test, LOO floor, feature vector, gesture quality bar).

## Dispositions summary

| Family | Metric(s) | Disposition | Basis |
| --- | --- | --- | --- |
| CLUSTER boost (canonical) | F-1/F-9 | `NOT_CALIBRATABLE_FOR_DECISION` | `D = 0.0` canonical and legacy; boost reachable only via manual epistemic flip (`D = 0.385`) |
| DISTRIBUTION boost, highVariance half | F-10 | `NOT_CALIBRATABLE_FOR_DECISION` | `D = 0.0` (gated dead); absolute-unit threshold confound demonstrated |
| DISTRIBUTION boost, outlier half | K-8 `hasOutliers` | `NOT_CALIBRATABLE_FOR_DECISION` | fires (`D = 0.35`) on a `heuristic` label via an ungated branch — hand-set ladder step, not evidence |
| Anomaly severity score | K-8 `max_anomaly_score` | `NOT_CALIBRATABLE_FOR_DECISION` | saturates in ordinary regime; floor binds only in a degenerate constant-column regime; not transported to the decision signature |
| Cluster count / strength | K-1 | `NOT_CALIBRATABLE_FOR_DECISION` | count capped at 3 (5→3 demonstrated); threshold verdict subsample-order-coupled; textbook uniform-noise negative is a positive at kernel order |
| Periodicity boolean | K-5 `has_periodicity` | `NOT_CALIBRATABLE_FOR_DECISION` | no threshold-proximate controls; gate reachability per §1; null-closure property itself measured and holding |

Every disposition is MA2-slice-1 evidence, not an MA3 certificate: MA3's governed record (metric identity, regime, control digests, pre-specified rule) is a separate authority surface and has not been created here.