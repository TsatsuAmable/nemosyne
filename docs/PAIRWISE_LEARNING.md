# Offline Pairwise Fitness Learning

## Purpose

Wave 4 may learn only from curated, partitioned human judgement evidence. A pairwise judgement names a preferred and alternative `RepresentationGraph`, but graph IDs alone are not model features. The learning boundary therefore requires a frozen feature snapshot for each judged graph before an example can be materialized.

## Feature snapshot contract

`PairwiseCandidateFeatureSnapshot` binds graph ID, dataset fingerprint, bootstrap FitnessModel version, feature-schema version, a finite numeric feature vector, and bootstrap utility for the same candidate.

Materialization fails the affected judgement closed when either candidate snapshot is absent or its provenance disagrees with the judgement. This prevents joining a preference to features produced by another dataset or FitnessModel version.

## Baseline learner

`trainPairwiseLinearModel` is a deterministic offline logistic pairwise learner over preferred-minus-alternative feature deltas. It consumes only `train` examples and emits a training artifact with judgement-weighted holdout diagnostics. That diagnostic is useful for development but is **not promotion evidence**.

Before promotion, `withGroupBalancedHoldoutEvaluation` evaluates frozen model weights on holdout examples grouped by the curation boundary (`dataset fingerprint + researcher`). Accuracy is computed inside each independent group first and then averaged with equal group weight. This prevents a prolific group from dominating the headline metric by contributing many more judgements.

The evaluation also records whether the candidate or bootstrap wins within each independent group. Tied groups are excluded from a one-sided exact sign test of candidate wins versus bootstrap wins. The resulting p-value is persisted in the immutable artifact alongside the win/tie counts. By default `assessFitnessModelPromotion` therefore requires two complementary signals: a minimum group-balanced mean improvement and a group-win sign-test p-value at or below 0.05. A large mean gain concentrated in only a few groups is not sufficient.

The sign test deliberately answers a narrow robustness question: whether wins are consistently distributed across the existing independent partition groups. It does not estimate effect-size uncertainty, repair a bad grouping design, or prove generalization to new researchers/datasets. Discovery-outcome validation remains a separate evidence requirement.

Creating or evaluating an artifact does **not** register or activate it automatically. Registry promotion remains a separate explicit operation after evidence review; runtime activation and historical execution remain pinned to immutable artifact hashes.

## Research boundary

This module does not invent features from graph IDs, use validation/holdout evidence for fitting, or mutate active Moneta policy. Group balancing and the sign test operate only on frozen holdout evidence and do not create independence where the curation design does not provide it.
