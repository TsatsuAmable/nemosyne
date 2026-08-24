# Study package overview

Status: Draft package — canonical structure, not yet frozen for collection.

This directory is the canonical source for the study protocol and operational governance associated with the Nemosyne experimental work. It is intentionally separate from the product-roadmap and engineering documentation in [docs/ROADMAP.md](../ROADMAP.md).

## Purpose

This package keeps three things separate:

1. Product governance and implementation status
2. Study design and methodological governance
3. Operational compliance and data reproducibility

Those are related, but they are not equivalent documents and they should not be merged.

## Structure

- [PROTOCOL.md](PROTOCOL.md) — study purpose, conditions, participant flow, researcher role, and limitations
- [ANALYSIS_PLAN.md](ANALYSIS_PLAN.md) — frozen comparison plan and missing-data rules
- [CONFOUNDS.md](CONFOUNDS.md) — known confounds, controls, and residual risk
- [REPRESENTATION_EQUIVALENCE.md](REPRESENTATION_EQUIVALENCE.md) — controlled vs. experimental differences across conditions
- [CONSENT.md](CONSENT.md) — participant-facing consent text and disclosure of recorded data
- [DATA_DICTIONARY.md](DATA_DICTIONARY.md) — complete field inventory for the study dataset
- [version.json](version.json) — release binding for build, protocol, and dataset identity

## Authority model

- The product roadmap remains authoritative for engineering status.
- This study package remains authoritative for methodological and operational decisions.
- No file in this directory should be edited casually after an experiment is frozen; any change after freeze must be documented as a protocol deviation.

## Freeze policy

A study package is considered frozen only after:

- protocol content is complete
- the analysis plan is fixed before collection begins
- consent and data dictionary are aligned to the actual recorded fields
- the version file is populated with the build and dataset identity

The intended design is a 2D-versus-VR crossover. It remains draft until assignment, estimand,
task artifact, order/carry-over handling, exclusions, missing-data rules, multiplicity policy, and
Atlas Core provider/version are fixed. Atlas Core is part of the Stable Alpha analytical substrate
and must be identical across both study conditions. Richer adaptive guidance and exploratory
analytical structures remain out of scope unless separately versioned and registered.
