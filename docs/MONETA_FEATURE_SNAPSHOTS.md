# Moneta Pairwise Feature Snapshots

## Purpose

Wave 4 learning requires the exact numeric candidate features that existed when a researcher compared representation alternatives. Graph IDs alone are not trainable evidence.

`captureMonetaPairwiseFeatureSnapshots` converts each feasible `CandidateScore` in a `RepresentationDecision` into a frozen `PairwiseCandidateFeatureSnapshot`.

## Feature semantics

The feature vector is the canonical bootstrap fitness-dimension order:

1. structure
2. task
3. scale
4. information preservation
5. density handling
6. configured prior

Raw component scores are captured rather than weighted scores. This prevents the bootstrap weight vector from being baked into the learning features.

## Identity and provenance

The caller must supply a concrete `RepresentationGraph` ID for every feasible candidate that may be compared by the researcher. Missing graph identity, missing fitness components, missing dataset provenance, or missing FitnessModel provenance fails closed.

This module records evidence only. It does not train, promote, or activate a learned FitnessModel.
