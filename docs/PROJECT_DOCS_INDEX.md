# Project documentation index

This repository keeps a single governing product spec, separate implementation/status and
technical-reference layers, a study layer, and one historical archive. Archived documents are
context only and never override the authorities below.

## Governing spec

- [Nemosyne_Definitive_Vision_and_Roadmap.md](Nemosyne_Definitive_Vision_and_Roadmap.md) — the
  canonical product + implementation spec. Defines target architecture, principles, the Gate 0–7
  model, release governance, documentation policy, and the Stable Alpha definition. All other
  product docs are subordinate to this file.

## 1. Product implementation and status
This layer covers the shipped product, roadmap state, architecture, and engineering decisions.

Canonical files:
- [ROADMAP.md](ROADMAP.md) — implementation status; structured around the vision's Gate 0–7 model and public testing sprints.
- [DEVELOPER_EXPLAINER.md](DEVELOPER_EXPLAINER.md) — developer onboarding, codebase mental model, data lifecycle, Rust/WASM ABI, and cookbooks.
- [ARCHITECTURE.md](ARCHITECTURE.md) — modular subsystems reference, semantic ownership, and boundaries.
- [STANDARDIZATION_REVIEW.md](STANDARDIZATION_REVIEW.md) — comprehensive open-source standardization audit, library replacements, and reduction of custom maintenance footprint.
- [OSS_MIGRATION_PROPOSAL.md](OSS_MIGRATION_PROPOSAL.md) — open-source library adoption plan to reduce maintenance footprint.
- [MIGRATION.md](MIGRATION.md)
- [STATISTICAL_METHOD_REGISTER.md](STATISTICAL_METHOD_REGISTER.md)
- [GETTING_STARTED.md](GETTING_STARTED.md)
- [README.md](../README.md)

Use this layer to answer:
- What is implemented?
- How does the system work under the hood?
- What is active, planned, blocked, or deferred?
- What is the engineering state of the codebase?

Historical context:
- [Roadmap history](archive/ROADMAP_HISTORY.md) — completed and superseded phases index
- [Phases 21–26 completed archive](archive/ROADMAP_PHASES_21-26_COMPLETED.md)
- [Phases 1–20 completed archive](archive/ROADMAP_PHASES_1-20_COMPLETED.md)

## 2. Study protocol and research governance
This layer covers the design of a controlled study, including hypotheses, confounds, equivalence, and analysis rules.

Canonical files:
- [docs/study/README.md](study/README.md)
- [docs/study/PROTOCOL.md](study/PROTOCOL.md)
- [docs/study/ANALYSIS_PLAN.md](study/ANALYSIS_PLAN.md)
- [docs/study/CONFOUNDS.md](study/CONFOUNDS.md)
- [docs/study/REPRESENTATION_EQUIVALENCE.md](study/REPRESENTATION_EQUIVALENCE.md)

Use this layer to answer:
- What are we testing?
- What comparisons are pre-registered?
- What confounds are controlled or recorded?
- What is the valid interpretation of the result?

## 3. Study operations, compliance, and reproducibility
This layer covers participant-facing disclosure, data capture, retention, versioning, and reproducibility.

Canonical files:
- [docs/study/CONSENT.md](study/CONSENT.md)
- [docs/study/DATA_DICTIONARY.md](study/DATA_DICTIONARY.md)
- [docs/study/version.json](study/version.json)

Use this layer to answer:
- What exact data are collected?
- How is consent handled?
- What version of the build and dataset generated the data?
- Can the study be reconstructed later?

## Proposals and research inputs

- [USER_STORIES_AND_UX_ANALYSIS.md](USER_STORIES_AND_UX_ANALYSIS.md) — product research input, not
  an authority.

## Historical archive

- [Archive index](archive/README.md) — superseded roadmaps, design material, and study drafts.

## Ownership and authority
- Product direction, architecture boundaries, release governance, and documentation policy remain
  authoritative in [Nemosyne_Definitive_Vision_and_Roadmap.md](Nemosyne_Definitive_Vision_and_Roadmap.md).
- Implementation status remains authoritative in [docs/ROADMAP.md](ROADMAP.md).
- Technical reference remains authoritative in [docs/ARCHITECTURE.md](ARCHITECTURE.md).
- Study design remains authoritative in [docs/study](study).
- Operational data package and consent remain authoritative in [docs/study](study).

No archived document is an active source of truth.

The governing spec is authoritative; the implementation, study, and technical-reference layers are
related but subordinate, not interchangeable.