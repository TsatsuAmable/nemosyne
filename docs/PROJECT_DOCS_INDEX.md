# Project documentation index

This repository keeps one governing product/research/architecture specification, separate implementation/status and technical-reference layers, a study layer, and a historical archive. Archived documents are context only and never override the authorities below.

## Governing specification

- [Nemosyne_Definitive_Vision_and_Roadmap.md](Nemosyne_Definitive_Vision_and_Roadmap.md) — **V3**, the canonical discovery-centric product, research and architecture specification. It defines the five ontologies, canonical authority boundaries, the 15-module target architecture, V3 Gates 0–10, reproducibility requirements and the path from bootstrap heuristics to validated compositional representation intelligence. All other product documents are subordinate to it.

## 1. Product implementation and status

This layer describes the code that exists now and the migration toward V3. It must not restate superseded vision as current direction.

Canonical files:

- [ROADMAP.md](ROADMAP.md) — implementation status and V3 migration workstreams. Historical gate/sprint numbering remains historical evidence only.
- [IMPLEMENTATION_PLAN_V3.md](IMPLEMENTATION_PLAN_V3.md) — V3 module sequencing, dependency graph, verification gates and deletion/migration policy; `ROADMAP.md` governs live status.
- [DEVELOPER_EXPLAINER.md](DEVELOPER_EXPLAINER.md) — developer onboarding and codebase mental model.
- [ARCHITECTURE.md](ARCHITECTURE.md) — current modular subsystem reference; where it conflicts with V3, V3 governs until this reference is migrated.
- [PRE_P1_SYSTEMATIC_AUDIT.md](PRE_P1_SYSTEMATIC_AUDIT.md) — current adversarial architecture, UX/VR, performance, resilience, security, maintainability, test, use-case and documentation audit.
- [MIGRATION.md](MIGRATION.md)
- [STATISTICAL_METHOD_REGISTER.md](STATISTICAL_METHOD_REGISTER.md)
- [GETTING_STARTED.md](GETTING_STARTED.md)
- [README.md](../README.md)

Use this layer to answer what is implemented, active, planned, blocked or deferred. Do not infer V3 completion from older completed sprint/gate labels.

Historical context:

- [Roadmap history](archive/ROADMAP_HISTORY.md)
- [Phases 21–26 completed archive](archive/ROADMAP_PHASES_21-26_COMPLETED.md)
- [Phases 1–20 completed archive](archive/ROADMAP_PHASES_1-20_COMPLETED.md)

## 2. Study protocol and research governance

Canonical files:

- [study/README.md](study/README.md)
- [study/PROTOCOL.md](study/PROTOCOL.md)
- [study/ANALYSIS_PLAN.md](study/ANALYSIS_PLAN.md)
- [study/CONFOUNDS.md](study/CONFOUNDS.md)
- [study/REPRESENTATION_EQUIVALENCE.md](study/REPRESENTATION_EQUIVALENCE.md)

V3 reframes 2D-vs-VR as one controlled experiment within the broader meaningful-discovery programme. Existing protocol documents remain operational inputs but must be revised before being treated as evidence that the V3 research programme is study-ready.

## 3. Study operations, compliance and reproducibility

Canonical files:

- [study/CONSENT.md](study/CONSENT.md)
- [study/DATA_DICTIONARY.md](study/DATA_DICTIONARY.md)
- [study/version.json](study/version.json)

## Historical archive

- [Archive index](archive/README.md) — superseded roadmaps, design material and study drafts.

## Ownership and authority

- Product direction, research thesis, architecture boundaries and implementation gates: [Nemosyne_Definitive_Vision_and_Roadmap.md](Nemosyne_Definitive_Vision_and_Roadmap.md).
- Current implementation status: [ROADMAP.md](ROADMAP.md).
- Executable V3 migration sequencing: [IMPLEMENTATION_PLAN_V3.md](IMPLEMENTATION_PLAN_V3.md).
- Technical reference: [ARCHITECTURE.md](ARCHITECTURE.md), subordinate to V3 while migration is in progress.
- Study design and operations: [study/](study/), subordinate to V3 research safeguards.

No archived document is an active source of truth. If an active document conflicts with V3, V3 wins and the conflicting document must be updated or archived as part of the next touching change.
