# Nemosyne Statistical Foundations

Status: active methodological architecture

This document defines the statistical boundary between raw data, Rust/WASM analytical evidence, Moneta representation reasoning, and Investigation/Discovery validation. It refines the governing Dataset Evidence contract without changing the product thesis.

## Governing principles

1. Domain precedes computation. Storage type is not measurement semantics.
2. Analytical geometry is explicit. Metrics, scaling, transformations, weighting, missingness policy, and assumptions are provenance-bearing inputs.
3. Rust/WASM establishes analytical evidence. Moneta consumes evidence and reasons about representation; it does not manufacture analytical facts.
4. An algorithm output is not automatically a scientific claim.
5. Estimate, uncertainty, stability, effect size, significance, model fit, predictive performance, and representation utility are distinct concepts.
6. Confidence terminology is reserved for calibrated probabilistic or coverage claims with stated assumptions.
7. Stability terminology is reserved for robustness under an explicitly defined perturbation or resampling procedure.
8. Significance terminology requires an explicit null/testing procedure and multiplicity policy where applicable.
9. Absence of detected evidence is not evidence of absence.
10. Abstention, unknown applicability, unresolved assumptions, and insufficient sample support are valid outputs.
11. Interactive exploration changes the inferential context. Investigation must preserve enough selection history to distinguish exploratory from independently validated claims.
12. Learning from researcher behaviour must not turn Moneta's own recommendation exposure into ground truth.
13. Reproducibility includes measurement semantics, geometry, preprocessing, analytical parameters, versions, seeds, exclusions, assumptions, and limitations.

## Foundational contracts

The Rust contracts evolve as:

```text
Column storage/schema
    ↓
MeasurementModelRecord
    ├── MeasurementModel
    ├── semantic status
    └── provenance basis
    ↓
semantic admission policy
    ↓
metric applicability
    ↓
AnalyticalGeometry
    ↓
analytical method
    ↓
EvidenceClaim<T>
    ├── sample support
    ├── assumptions
    ├── uncertainty
    ├── stability/sensitivity
    └── limitations
    ↓
DatasetEvidence
    ↓
Moneta
```

Storage/schema evidence may propose semantics, but it must not silently certify them. Numeric storage does not establish interval, ratio, count, proportion, circular, identifier, or compositional meaning. Categorical storage does not establish nominal versus ordinal meaning. Temporal storage can support an inferred temporal measurement scale but does not establish that observations form a dependent time series.

`AnalyticalGeometry` records the geometry actually used for an analytical result. It is not a claim that the geometry is uniquely correct.

`EvidenceClaim<T>` deliberately does not contain a universal `evidenceStrength` scalar. Sample support, uncertainty, stability, sensitivity, assumptions, and limitations remain separate because they answer different questions and are not naturally commensurate.

## Measurement semantic provenance

Every constructed measurement model carries one of these statuses:

- `Inferred`: suggested from storage/schema evidence only;
- `Declared`: explicitly supplied by a researcher, dataset manifest, or domain adapter;
- `Confirmed`: a declaration confirmed for the current analytical context;
- `Ambiguous`: multiple materially different semantic interpretations remain plausible;
- `Unknown`: there is no defensible interpretation yet.

The status is not a probability and must never be rendered as statistical confidence.

Analytical callers choose an explicit semantic admission policy:

- `AllowInferred`: inferred semantics may be used, but ambiguous and unknown models fail closed;
- `RequireDeclared`: only declared or confirmed semantics may drive the analysis;
- `RequireConfirmed`: research-critical analyses require explicit confirmation.

This policy is independent of mathematical metric applicability. A model may be semantically authoritative but mathematically incompatible with a requested geometry, or mathematically compatible but too weakly sourced for a strict research analysis.

## Sample support and missingness

Every research-relevant analytical claim records how much of the dataset actually contributed to the result. `SampleSupport` records total rows, rows used and excluded, analytical column scope, support policy, and counted exclusion reasons.

Support is method-specific. Dataset cardinality must not be copied into a statistic when the method excluded rows. A per-column descriptive statistic can therefore have different support from a two-column Pearson coefficient or a multivariate structural analysis.

Missingness is evidence in its own right. The kernel records per-column observed/missing counts and cross-column missingness patterns. `MCAR`, `MAR`, and `MNAR` are not inferred from missing-value percentages or pattern counts. The mechanism remains `Unknown` unless explicitly declared or established by a separately provenance-bearing model.

A support policy states what the method did, not whether that policy was inferentially valid. `CompleteCase`, for example, records row selection and does not imply complete-case analysis is unbiased.

For numeric methods, support accounting must match actual computational eligibility. Null, non-numeric, and non-finite values excluded by an analyzer must also be excluded from its support count.

## Applicability states

Analytical combinations use three states:

- `Applicable`: the declared measurement semantics permit the operation as specified.
- `RequiresTransformation`: the operation may become meaningful only after an explicit, provenance-bearing transformation or encoding.
- `NotApplicable`: the operation is incompatible with the declared analytical domain.

These states describe mathematical applicability, not empirical truth.

## Immediate terminology migration targets

Current bootstrap heuristics remain useful, but several names overstate their evidence:

| Current field / concept | Current computation | Required migration | Status |
| --- | --- | --- | --- |
| `CorrelationProfile.significant_pairs_count` | counts pairs with `abs(r) > 0.6` | rename to magnitude-based terminology unless an actual inferential test is introduced | **RESOLVED (TEC2)** — Rust `pairs_above_magnitude_threshold` (wire `pairsAboveMagnitudeThreshold`); the `0.6` literal is now the named `CORRELATION_MAGNITUDE_THRESHOLD`; the TypeScript recomputation of this count at a different threshold was deleted outright |
| `ClusterProfile.stability_confidence` | deterministic function of silhouette score | rename as heuristic separation/partition score until resampling stability exists | **RESOLVED (TEC2)** — Rust `heuristic_silhouette_partition_score` (wire `heuristicSilhouettePartitionScore`); adapter key `legacySilhouetteDerivedScore` unchanged |
| `SpectralFacts.periodicity_confidence` | weighted combination of peak power and spectral entropy | rename as heuristic periodicity score until calibration exists | **RESOLVED (TEC2)** — Rust `periodicity_heuristic_score` (wire `periodicityHeuristicScore`), on both the kernel-ABI facts and the structure profile; the legacy `DatasetSignature` alias field and fact path were deleted rather than kept |
| `DensityProfile.global_density` | row-count threshold heuristic | label as heuristic scale/density proxy or replace with a defined density estimand | **RESOLVED (TEC2)** — Rust `heuristic_scale_density_proxy` (wire `heuristicScaleDensityProxy`), narrowing both the transport and the adapter value |
| `DensityProfile.local_density_variation` | fixed value conditioned on heuristic cluster detection | remove or replace with an actual local-density statistic | **RESOLVED (TEC2)** — removed from the Rust struct, the transport mirror, and the adapter value. A real local-density estimand must arrive under a new name with its own contract |
| `ClusterProfile.density_variation` (outside the enumerated six; same defect class) | two-valued proxy: `0.25` iff heuristic cluster detection succeeded, else `0` | remove; no density-variation estimand exists behind it | **RESOLVED (TEC2, 2026-09-25)** — removed from the Rust producer, the transport mirror, the canonical cluster evidence payload, and the canonical signature reconstruction; the boundary validator rejects the retired key in live kernel payloads. The optional `DatasetSignature.clusterStructure.densityVariation` field and fact path are retained for historical persisted signatures (RFC 0008 verbatim replay) and for future explicitly measured/derived density evidence, which `FitnessModel` admits only through its measured/derived epistemic gate |
| Moneta sample-count `confidence_weight` | saturating sample-count multiplier | rename as sample-count weight; it is not statistical confidence | **RESOLVED (TEC2)** — `sample_count_weight` in `wasm/src/moneta/evidence.rs` (the sole compiled implementation; `draco` is a `pub use` alias of `moneta`). No wire key was involved. **Follow-up (2026-09-25):** the TypeScript `EvidenceWeightedScorer` re-ranking twin — a divergent 20.0-scale reimplementation with a `(weight \|\| 1.0)` zero-sample inversion that flipped the kernel's fail-closed zero-observation semantics — was deleted outright rather than harmonised, and the never-compiled `wasm/src/draco/` stale twin directory was removed; the kernel's `30.0` scale, saturation at N=10 and fail-closed zero-sample path are pinned by unit tests and a real-WASM bridge test |

Compatibility changes must inventory serialized consumers before removing or renaming fields. That inventory is `docs/audits/TEC2_HEURISTIC_TERMINOLOGY_INVENTORY_2026-09-21.md`. At the **wire/transport level** it records that none of these six names reaches persistence, export, replay or an external consumer: `DatasetStructureProfile` is internal transport, so the renames were applied in place with **no compatibility alias**. At the **signature level** (corrected 2026-09-23, RFC 0008) two deleted fields — `dependence.significantPairsCount` and `spectralStructure.periodicityConfidence` — had been carried inside historical persisted `RepresentationDecision.datasetSignature` payloads (`investigation/representation.json`) and are digest-bearing in the v2 investigation digest; packages carrying them continue to replay because replay restores decisions verbatim, and any future stripping or normalization of those persisted keys is an explicit, versioned format migration. The same signature-level persistence applies to `clusterStructure.densityVariation` (2026-09-25): the key survives inside historical decisions as legitimate history, the optional field and fact path are retained rather than deleted, and the decision-relevance equality gate no longer compares it because canonical evidence no longer emits it. Re-publishing a retired name through `#[serde(alias)]` is prohibited — it would reinstate exactly the overstatement this section removes. The boundary validator rejects a retired name if it ever reappears **in a live wire payload from the kernel**; per RFC 0008 that rejection never applies to historical persisted representation decisions.

## Measurement semantics

The first supported vocabulary includes:

```text
Unknown
Identifier
Nominal
Ordinal
Interval
Ratio
Count
Proportion
Compositional
Circular
Temporal
SpatialCoordinate
```

Observation dependence is modeled separately:

```text
Unknown
IID
Grouped
RepeatedMeasures
TemporalSequence
Spatial
Spatiotemporal
```

Variable semantics and observation dependence must not be collapsed into one enum.

## Evidence claims

An evidence claim records at minimum:

```text
claim id
estimand/question
result
method + version
kernel version
dataset fingerprint
parameters
analytical geometry
assumption checks
sample support
uncertainty, when actually estimated
stability, when actually measured
sensitivity results
limitations
```

A missing uncertainty or stability value means it was not established. It must not be silently converted to zero.

Legacy analytical result structs may be wrapped by evidence adapters while their numerical algorithms and serialized compatibility shapes remain unchanged. This is the preferred migration path when a breaking ABI change is not justified.

## Advanced methods

Persistent homology, spectral methods, HDBSCAN, HSIC, knockoffs, PoSI, preference learning, counterfactual estimators, and contextual/slate bandits are method families, not governing architecture.

They may be introduced only when:

1. input semantics are represented;
2. applicability assumptions are defensible;
3. the output maps to a precise `EvidenceClaim` or learning target;
4. uncertainty or limitations are represented honestly;
5. computational behaviour is compatible with the intended execution tier;
6. deterministic/provenance requirements are met where research mode requires them;
7. falsification tests exist.

## Interactive discovery

Investigation should evolve toward preserving a statistical selection history, including variables inspected, transformations tried, filters/subgroups examined, representations viewed, tests requested, hypothesis timing, and independent confirmation still available.

This does not make every UI event a hypothesis test. It preserves enough information to distinguish a pre-specified claim from one discovered after extensive adaptive exploration.

Pattern-fragility / exploration-risk signals remain vectors of inspectable evidence conditions. They must not become psychological scores for investigators or calibrated probabilities without validation.

## Test strategy

Correctness tests must include positive structure, null structure, invalid-domain combinations, and correct abstention.

Initial adversarial fixtures should cover:

- identifier columns encoded numerically;
- ordinal variables offered to Euclidean covariance geometry;
- compositional closure;
- circular wraparound;
- grouped/repeated observations;
- nonlinear dependence with weak Pearson correlation;
- Simpson-style subgroup reversal;
- Gaussian/null data where algorithms may produce accidental structure;
- deterministic replay of measurement and geometry provenance;
- missing/null/non-numeric/non-finite observations whose support counts must exactly match analyzer eligibility.

For null datasets the invariant is not that no algorithm may ever return structure. The invariant is that accidental algorithmic structure must not be mislabeled as strong, stable, or independently validated scientific evidence.


## Roadmap closure gate: P1-TEC

The foundational architecture above is already established and partially implemented. The remaining roadmap work is therefore a **closure programme**, not a restart of the statistical-foundations effort.

`docs/ROADMAP.md` owns live sequencing and status. P1-TEC closes five residual failure classes before PT9 learning and downstream Full-Moneta representation expansion:

1. **Propagation loss:** determine whether measurement semantics, geometry, assumptions, sample support, uncertainty, stability, sensitivity, limitations and provenance survive from Rust `EvidenceClaim<T>` through the production transport/adapters into Moneta and semantic embodiment.
2. **Transport/identity gaps:** close blocker-grade losses while keeping Rust/WASM as analytical authority. Prefer stable evidence references/receipts over duplicating scientific truth into TypeScript structures when that preserves the authority boundary more cleanly.
3. **Migration debt:** remove or quarantine legacy terminology that overstates heuristic computations. Compatibility must never turn a magnitude threshold into significance, a silhouette-derived score into stability confidence, or sample count into statistical confidence.
4. **Falsification coverage:** qualify exposed analytical families against positive structure, null structure, invalid-domain combinations and correct abstention, including the adversarial fixtures already specified in this document.
5. **Downstream handoff:** prove that evidence/admissibility gates execute before representation utility, learned ranking or synthesis and that persistence/replay preserves the governing evidence identity.

P1-TEC does not require implementing every advanced method named in this document. A method family enters production when a concrete analytical question/representation requirement justifies its estimand and the seven advanced-method admission conditions above are met. The gate closes when the evidence that Nemosyne actually exposes is trustworthy end to end.

## Implementation sequence

1. Measurement and observation semantics.
2. Semantic provenance and analytical admission policy.
3. Analytical applicability and geometry provenance.
4. Generic evidence claims.
5. Sample-support and missingness evidence.
6. Wrap existing descriptive/dependency analyzers with exact evidence support without changing numerical output or legacy ABI.
7. Add robust foundational statistics.
8. Add stability/sensitivity machinery.
9. Expand dependency, dimensionality, temporal, grouped, spatial, compositional, topological, and spectral evidence as domain-conditional analyzers.
10. Add selection-aware Discovery validation.
11. Only then expand learned/counterfactual/adaptive Moneta methods where held-out evidence justifies them.
