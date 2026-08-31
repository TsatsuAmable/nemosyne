# P1-R6B Rank-effective family membership review — 31 August 2026

**Base:** `main@a00388eaa1476b3b3fe4b31d99f3770b1b42ac88` (#583 merged)  
**Branch:** `fix/p1r-r6-family-membership-treatment`  
**Disposition before exact-head CI:** IMPLEMENTATION COMPLETE / REVIEW ACTIVE

## Reviewed invariant

A semantic representation candidate has one canonical reasoning-family identity. Cross-task usefulness comes from explicit candidate capabilities and information contracts, not from relabelling the same candidate under multiple families. A family label must not manufacture scientific evidence, a configured prior, or an unrelated macro-layout variant.

## Pre-change finding

`FAMILY_TO_CANDIDATE_IDS` contained three duplicate candidate memberships:

- `DENSITY_FIELD` in `DISTRIBUTION` and `CLUSTER`;
- `RELATIONSHIP_GRAPH` in `GRAPH` and `TOPOLOGY`;
- `TEMPORAL_TRAJECTORY` in `TEMPORAL` and `FREQUENCY`.

This was rank-effective rather than descriptive. `MonetaHypothesisEngine` generated every family × compatible-layout × family-candidate combination, while `BootstrapFitnessModel` used family identity for structure scoring and configured priors.

The most material case was density. After RF-065, `DENSITY_FIELD` supports bounded `binned-empirical-mass`; it does not support `cluster-partition`. Nevertheless, authoritative cluster evidence could boost a density variant emitted under `CLUSTER`, and on graph-shaped inputs the same alias made a `FORCE_DIRECTED_3D` density variant part of the search space.

The other aliases had the same architectural defect even where their cross-task semantics were legitimate: relational topology and periodicity are already expressed by `RELATIONSHIP_GRAPH.supports` and `TEMPORAL_TRAJECTORY.supports`. Duplicate family labels were not needed to preserve that applicability.

## R6B correction

- `CANDIDATE_TO_REASONING_FAMILY` is the sole editable family-membership authority.
- `FAMILY_TO_CANDIDATE_IDS` is derived mechanically from it and cannot drift independently.
- every `SemanticRepresentationId` occurs exactly once across reasoning families;
- `BootstrapFitnessModel.evaluate()` rejects a candidate/family mismatch instead of assigning a score;
- family-specific structure evidence is gated by the candidate capability that makes the family evidence meaningful;
- requirement/task coverage remains capability-driven, so legitimate cross-task utility survives without duplicate aliases;
- numeric bootstrap weights remain unchanged;
- the rank-effective treatment advances to `bootstrap-fitness-v3` / `fitness-treatment-v3` and remains recorded in decision provenance.

## Candidate dispositions

### `DENSITY_FIELD`

Canonical family: `DISTRIBUTION`.

Reason: finite bivariate empirical bin mass is distributional enough for search organization, but it is not a cluster partition and not a univariate empirical-distribution summary. Consequently:

- `CLUSTER` is inadmissible;
- cluster evidence and a configured CLUSTER prior cannot boost it;
- the `DISTRIBUTION` family label alone does not grant the 0.9 univariate-distribution structure boost because the candidate lacks `univariate-distribution` capability;
- density-task credit continues to come from `binned-empirical-mass` and `empirical-bivariate-bin-mass`.

### `RELATIONSHIP_GRAPH`

Canonical family: `GRAPH`.

Its `relational-topology` capability continues to satisfy connectivity/topology requirements. A second `TOPOLOGY` family alias is unnecessary and previously expanded the candidate into the topology family's additional GRID layout variant.

### `TEMPORAL_TRAJECTORY`

Canonical family: `TEMPORAL`.

Its `periodic-spectrum` capability continues to satisfy periodicity requirements. A second `FREQUENCY` alias is unnecessary and previously expanded the candidate into the frequency family's spectral-layout variant.

## Treatment-version review

This correction changes both the candidate search universe and raw structure/prior scores, so retaining v2 would make replay/provenance ambiguous. R6B therefore mints v3 while preserving the frozen numeric weights.

Historical decisions and density artifacts retain whatever v1/v2 model identity they actually recorded. No historical provenance is rewritten. The pinned learned runtime inherits the bootstrap decision's `fitnessTreatmentId` in provenance while separately recording the learned model/artifact identity, so downstream learned decisions remain attributable to the changed upstream candidate treatment.

## Regression/falsification coverage

The R6B tests prove:

1. every semantic candidate occurs in exactly one reasoning family;
2. the reverse family index agrees with the canonical candidate map;
3. invalid density/cluster, graph/topology and temporal/frequency pairings throw;
4. authoritative cluster evidence cannot be consumed through a density CLUSTER alias;
5. high-variance/outlier distribution evidence does not give binned density the univariate-distribution family boost;
6. a CLUSTER configured prior does not boost a distribution-family density candidate;
7. periodicity coverage for `TEMPORAL_TRAJECTORY` remains capability-driven and intact;
8. bootstrap search no longer emits the removed duplicate family/layout variants;
9. current decisions record `bootstrap-fitness-v3` and `fitness-treatment-v3`.

## Residual boundary

R6B does not prove that every family-level macro-layout is semantically ideal for every still-unmigrated candidate within that family. Candidate-specific layout restrictions may still be required when those candidates receive a governed semantic-embodiment tranche. In particular, R2D must decide `CLUSTER_REGIONS` analytical authority and presentation behavior explicitly rather than inferring cluster science from `GRID_3D` or `FORCE_DIRECTED_3D` positions.

This residual does not reopen the duplicate-family score leak fixed here.

## Exit

R6B may merge only after exact-head typecheck/lint/tests/CI/CodeQL/governance gates pass and no unresolved review finding contradicts the treatment decision. After merge, R6 stops. R2D Cluster Regions may then be planned from a fresh `main`, beginning with the scientific authority contract rather than renderer geometry.
