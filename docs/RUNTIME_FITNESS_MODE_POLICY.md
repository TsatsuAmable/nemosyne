# Runtime Fitness Mode Policy

## Purpose

Controlled studies and reproducible investigations must identify not only the FitnessModel version but, for learned execution, the exact immutable model artifact.

## Modes

- `bootstrap`: uses the canonical bootstrap FitnessModel and carries no artifact hash.
- `pinned-learned`: requires both a non-empty model version and an exact immutable artifact hash.

`currentStudyRuntimeVersions` records this identity in the study runtime version vector. `StudyFreezeGuard` treats artifact-hash changes as runtime drift, so a frozen session cannot silently switch between learned artifacts that happen to share a model version.

## Boundary

This policy does not execute learned scoring and does not activate registry artifacts. It is deliberately independent of the learned runtime adapter so study provenance can merge and stabilize before live opt-in composition-root wiring.
