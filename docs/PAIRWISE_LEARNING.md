# Offline Pairwise Fitness Learning

## Purpose

Wave 4 may learn only from curated, partitioned human judgement evidence. A pairwise judgement names a preferred and alternative `RepresentationGraph`, but graph IDs alone are not model features. The learning boundary therefore requires a frozen feature snapshot for each judged graph before an example can be materialized.

## Feature snapshot contract

`PairwiseCandidateFeatureSnapshot` binds graph ID, dataset fingerprint, bootstrap FitnessModel version, feature-schema version, a finite numeric feature vector, and bootstrap utility for the same candidate.

Materialization fails the affected judgement closed when either candidate snapshot is absent or its provenance disagrees with the judgement. This prevents joining a preference to features produced by another dataset or FitnessModel version.

## Baseline learner

`trainPairwiseLinearModel` is a deterministic offline logistic pairwise learner over preferred-minus-alternative feature deltas. It consumes only `train` examples and emits a training artifact with judgement-weighted holdout diagnostics. That diagnostic is useful for development but is **not promotion evidence**.

Before promotion, `withGroupBalancedHoldoutEvaluation` must evaluate the frozen model weights on holdout examples grouped by the curation boundary (`dataset fingerprint + researcher`). Accuracy is computed inside each independent group first and then averaged with equal group weight. This prevents a prolific researcher/dataset group from dominating the headline metric simply by contributing many more judgements.

The resulting promotion-ready artifact uses `group-balanced-pairwise-accuracy` as its metric and records both holdout judgement count and independent group count. `assessFitnessModelPromotion` requires this group-balanced metric by default. A caller may explicitly request a different metric for exploratory/legacy evaluation, but that choice is protocol-visible rather than an accidental fallback.

Creating or evaluating an artifact does **not** register or activate it automatically. Registry promotion remains a separate explicit operation after evidence review; runtime activation and historical execution remain pinned to immutable artifact hashes.

## Research boundary

This module does not invent features from graph IDs, use validation/holdout evidence for fitting, or mutate active Moneta policy. Group balancing does not create statistical independence where none exists; it only prevents unequal judgement counts among already-separated partition groups from changing their relative contribution to the promotion metric. Stronger uncertainty estimates and held-out discovery-outcome validation remain separate evidence requirements.
