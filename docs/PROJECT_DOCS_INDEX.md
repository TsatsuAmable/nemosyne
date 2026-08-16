# Project documentation index

This repository keeps three separate documentation layers and one historical archive. Archived
documents are context only and never override the authorities below.

## 1. Product governance and implementation
This layer covers the shipped product, roadmap state, architecture, and engineering decisions.

Canonical files:
- [ROADMAP.md](ROADMAP.md)
- [PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md](PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [STATISTICAL_METHOD_REGISTER.md](STATISTICAL_METHOD_REGISTER.md)
- [GETTING_STARTED.md](GETTING_STARTED.md)
- [README.md](../README.md)

Use this layer to answer:
- What is implemented?
- What is active, planned, blocked, or deferred?
- What is the engineering state of the codebase?

Historical context:
- [Roadmap history](archive/ROADMAP_HISTORY.md) — completed and superseded phases only; not an active status source

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

- [nemosyne-concept-paper-architecture.md](nemosyne-concept-paper-architecture.md) — concept
  reconciliation and target architecture; subordinate to governance and roadmap.
- [Atlas upgrade of Draco Recommender.md](Atlas%20upgrade%20of%20Draco%20Recommender.md) —
  subordinate Atlas proposal; not a release specification.
- [Nemosyne_Concept_Paper_v1.0.md](Nemosyne_Concept_Paper_v1.0.md) — concept narrative, not
  implementation status.
- [USER_STORIES_AND_UX_ANALYSIS.md](USER_STORIES_AND_UX_ANALYSIS.md) — product research input.

## Historical archive

- [Archive index](archive/README.md) — superseded roadmaps, design material, and study drafts.

## Ownership and authority
- Product state and engineering status remain authoritative in [docs/ROADMAP.md](ROADMAP.md).
- Study design remains authoritative in [docs/study](study).
- Operational data package and consent remain authoritative in [docs/study](study).

No archived document is an active source of truth.

This is intentionally a three-layer model; the layers are related but not interchangeable.
