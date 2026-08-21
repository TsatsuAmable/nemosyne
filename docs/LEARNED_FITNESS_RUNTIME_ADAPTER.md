# Learned Fitness Runtime Adapter

## Purpose

This adapter is the first opt-in runtime seam for evaluated learned FitnessModels. It does not replace Moneta's bootstrap feature computation or hard feasibility rules.

`rankWithActiveLearnedFitnessModel` takes already-scored Moneta candidates and re-ranks only feasible candidates using the canonical six raw fitness dimensions.

## Safety gates

A learned model is usable only when:

- it is the exact active artifact in `FitnessModelRegistry`;
- it passes the declared `FitnessModelPromotionPolicy`;
- it uses the supported pairwise feature schema;
- its weight vector matches the canonical Moneta feature dimension;
- every feasible candidate exposes all canonical raw features.

Any mismatch fails closed.

## Boundary

This PR does not wire learned re-ranking into `MonetaHypothesisEngine` by default. Bootstrap remains the default runtime path. A later integration slice may opt into this adapter under explicit study/operator configuration with the exact model artifact pinned by freeze controls.
