# Nemosyne Statistical Foundations

Status: active methodological architecture

This document defines the statistical boundary between raw data, Rust/WASM analytical evidence, Moneta representation reasoning, and Investigation/Discovery validation. It refines the V3 Dataset Evidence gate without changing the product thesis.

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

## Applicability states

Analytical combinations use three states:

- `Applicable`: the declared measurement semantics permit the operation as specified.
- `RequiresTransformation`: the operation may become meaningful only after an explicit, provenance-bearing transformation or encoding.
- `NotApplicable`: the operation is incompatible with the declared analytical domain.

These states describe mathematical applicability, not empirical truth.

## Immediate terminology migration targets

Current bootstrap heuristics remain useful, but several names overstate their evidence:

| Current field / concept | Current computation | Required migration |
| --- | --- | --- |
| `CorrelationProfile.significant_pairs_count` | counts pairs with `abs(r) > 0.6` | rename to magnitude-based terminology unless an actual inferential test is introduced |
| `ClusterProfile.stability_confidence` | deterministic function of silhouette score | rename as heuristic separation/partition score until resampling stability exists |
| `SpectralFacts.periodicity_confidence` | weighted combination of peak power and spectral entropy | rename as heuristic periodicity score until calibration exists |
| `DensityProfile.global_density` | row-count threshold heuristic | label as heuristic scale/density proxy or replace with a defined density estimand |
| `DensityProfile.local_density_variation` | fixed value conditioned on heuristic cluster detection | remove or replace with an actual local-density statistic |
| Moneta sample-count `confidence_weight` | saturating sample-count multiplier | rename as sample-count weight; it is not statistical confidence |

Compatibility changes must inventory serialized consumers before removing or renaming fields.

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
- deterministic replay of measurement and geometry provenance.

For null datasets the invariant is not that no algorithm may ever return structure. The invariant is that accidental algorithmic structure must not be mislabeled as strong, stable, or independently validated scientific evidence.

## Implementation sequence

1. Measurement and observation semantics.
2. Semantic provenance and analytical admission policy.
3. Analytical applicability and geometry provenance.
4. Generic evidence claims.
5. Inventory and rename misleading confidence/significance/stability terminology.
6. Adapt existing descriptive/correlation/cluster/temporal/spectral outputs into evidence claims without changing their mathematical strength.
7. Add robust foundational statistics and missingness evidence.
8. Add stability/sensitivity machinery.
9. Expand dependency, dimensionality, temporal, grouped, spatial, compositional, topological, and spectral evidence as domain-conditional analyzers.
10. Add selection-aware Discovery validation.
11. Only then expand learned/counterfactual/adaptive Moneta methods where held-out evidence justifies them.
