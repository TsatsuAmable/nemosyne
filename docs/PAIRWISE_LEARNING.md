# Offline Pairwise Fitness Learning

## Purpose

Wave 4 may learn only from curated, partitioned human judgement evidence. A pairwise judgement names a preferred and alternative `RepresentationGraph`, but graph IDs alone are not model features. The learning boundary therefore requires a frozen feature snapshot for each judged graph before an example can be materialized.

## Feature snapshot contract

`PairwiseCandidateFeatureSnapshot` binds:

- graph ID;
- dataset fingerprint;
- bootstrap FitnessModel version;
- feature-schema version;
- finite numeric feature vector;
- bootstrap utility for the same candidate.

Materialization fails the affected judgement closed when either candidate snapshot is absent or its provenance disagrees with the judgement. This prevents joining a preference to features produced by another dataset or FitnessModel version.

## Baseline learner

`trainPairwiseLinearModel` is a deterministic offline logistic pairwise learner over preferred-minus-alternative feature deltas. It consumes only `train` examples and evaluates candidate and bootstrap pairwise accuracy only on `holdout` examples.

The result is a `FitnessModelArtifact`. Creating that artifact does **not** register or promote it automatically. Registry promotion remains a separate explicit operation and should occur only after empirical review of held-out evaluation evidence.

## Research boundary

This module does not invent features from graph IDs, does not use validation/holdout evidence for fitting, and does not mutate active Moneta policy. The feature-snapshot producer is the next integration boundary: it must freeze the actual candidate facts used by Moneta at judgement time.