# Project documentation index

This repository keeps three separate documentation layers.

## 1. Product governance and implementation
This layer covers the shipped product, roadmap state, architecture, and engineering decisions.

Canonical files:
- [ROADMAP.md](ROADMAP.md)
- [PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md](PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [ANALYTICS.md](ANALYTICS.md)
- [STATISTICAL_METHOD_REGISTER.md](STATISTICAL_METHOD_REGISTER.md)
- [GETTING_STARTED.md](GETTING_STARTED.md)
- [README.md](../README.md)

Use this layer to answer:
- What is implemented?
- What is active, planned, blocked, or deferred?
- What is the engineering state of the codebase?

Historical context:
- [Roadmap history](archive/ROADMAP_HISTORY.md) — completed and superseded phases only; not an active status source

Reviews and proposals:
- [Nemosyne concept paper v1.0](Nemosyne_Concept_Paper_v1.0.md) — long-term product/research concept
- [Concept paper v1.0 initial review](Nemosyne_Concept_Paper_v1.0_REVIEW.md) — non-authoritative review recommendations for deeper analysis

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

## Legacy / superseded draft documents
The following files are deprecated staging notes. They are flagged for deletion after link
verification, not active sources of truth:
- [docs/confound-register.md](confound-register.md)
- [docs/reconciliation-note.md](reconciliation-note.md)
- [docs/representation-equivalence.md](representation-equivalence.md)
- [docs/analysis-plan.md](analysis-plan.md)
- [docs/protocol.md](protocol.md)
- [docs/data-dictionary.md](data-dictionary.md)
- [docs/consent.md](consent.md)

These were replaced by the canonical study package under [docs/study](study). They may contain
historical feature assumptions, including the retired Desktop 3D study condition.

`docs/Roadmap to stable alpha release.md` is also historical. Its unique gate detail should be
merged into `ROADMAP.md` or the study package before the file is archived or deleted. The Atlas
proposal remains useful design background but is subordinate to
[PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md](PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md).

## Ownership and authority
- Product state and engineering status remain authoritative in [docs/ROADMAP.md](ROADMAP.md).
- Study design remains authoritative in [docs/study](study).
- Operational data package and consent remain authoritative in [docs/study](study).

This is intentionally a three-layer model; the layers are related but not interchangeable.
