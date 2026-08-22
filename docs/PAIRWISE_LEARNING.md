# Offline Pairwise Fitness Learning

## Purpose

Wave 4 may learn only from curated, partitioned human judgement evidence. A pairwise judgement names a preferred and alternative `RepresentationGraph`, but graph IDs alone are not model features. The learning boundary therefore requires a frozen feature snapshot for each judged graph before an example can be materialized.

## Feature snapshot contract

`PairwiseCandidateFeatureSnapshot` binds graph ID, dataset fingerprint, bootstrap FitnessModel version, feature-schema version, a finite numeric feature vector, and bootstrap utility for the same candidate.

Materialization fails the affected judgement closed when either candidate snapshot is absent or its provenance disagrees with the judgement. This prevents joining a preference to features produced by another dataset or FitnessModel version.

## Baseline learner

`trainPairwiseLinearModel` is a deterministic offline logistic pairwise learner over preferred-minus-alternative feature deltas. It consumes only `train` examples and emits a training artifact with judgement-weighted holdout diagnostics. That diagnostic is useful for development but is **not promotion evidence**.

Before promotion, `withGroupBalancedHoldoutEvaluation` evaluates frozen model weights on holdout examples grouped by the curation boundary (`dataset fingerprint + researcher`). Accuracy is computed inside each independent group first and then averaged with equal group weight. This prevents a prolific group from dominating the headline metric by contributing many more judgements.

The evaluation records whether candidate or bootstrap wins within each independent group. Tied groups are excluded from a one-sided exact sign test of candidate wins versus bootstrap wins. The immutable artifact also records a deterministic leave-one-group-out improvement floor: for every independent holdout group, remove that group and recompute the equally weighted candidate-minus-bootstrap effect; the smallest remaining effect is the floor.

By default `assessFitnessModelPromotion` therefore requires three complementary signals: a minimum group-balanced mean improvement, a group-win sign-test p-value at or below 0.05, and a leave-one-group-out improvement floor that still meets the declared robust-effect threshold. A candidate cannot become eligible merely because one influential group lifts the point estimate above threshold.

The sign test and leave-one-group-out floor answer different narrow questions. The sign test asks whether wins are distributed across existing groups. The leave-one-group-out floor asks whether the mean effect survives removal of any one group. The floor is **not a confidence interval**, does not assign a sampling probability to the effect, and does not prove generalization to new researchers or datasets. A future inferential interval may be added only with an explicit resampling/sampling protocol and reproducibility contract.

Creating or evaluating an artifact does **not** register or activate it automatically. Registry promotion remains a separate explicit operation after evidence review; runtime activation and historical execution remain pinned to immutable artifact hashes.

## Research boundary

This module does not invent features from graph IDs, use validation/holdout evidence for fitting, or mutate active Moneta policy. Group balancing, sign consistency and leave-one-group-out robustness operate only on frozen holdout evidence and do not create independence where the curation design does not provide it. Held-out discovery-outcome validation remains a separate evidence requirement.
