# Learned FitnessModel Promotion Gate

## Purpose

An evaluated model artifact is not automatically safe to activate. `assessFitnessModelPromotion` performs a pure, reviewable eligibility check before any registry promotion is considered.

## Current gate

A candidate must:

- use a supported learned ranking model kind;
- report the declared held-out metric;
- meet minimum holdout judgement and group counts;
- beat the bootstrap metric;
- exceed the configured minimum absolute improvement.

Passing the gate does not activate the model. `FitnessModelRegistry.promote` remains a separate explicit operation so study freeze, operator review, and rollback policy remain authoritative.

## Research boundary

Thresholds are protocol/configuration values, not universal statistical guarantees. Future empirical work may add confidence intervals, repeated-dataset evaluation, calibration, subgroup checks, and drift criteria before live adaptive mode is permitted.
