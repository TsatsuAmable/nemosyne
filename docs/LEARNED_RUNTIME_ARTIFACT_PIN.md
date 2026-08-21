# Learned Runtime Artifact Pin

## Purpose

Reproducible learned execution must not mean merely "whatever learned model is active now". A running study or investigation needs the exact immutable model artifact it declared.

`rankWithPinnedLearnedFitnessModel` therefore requires an expected artifact hash and refuses execution unless that hash exactly matches the registry-active artifact. Promotion eligibility, feature schema checks, canonical feature extraction, and hard-constraint preservation remain unchanged.

## Consequence

A later registry promotion or rollback cannot silently alter an already-pinned runtime context. The caller must explicitly change its runtime provenance before a different learned artifact can be used.

## Boundary

Operator-controlled exploratory code may continue to use `rankWithActiveLearnedFitnessModel`. Controlled studies and reproducible sessions should use the pinned variant once composition-root integration lands.
