# Project documentation index

Nemosyne keeps a small set of authoritative documents and a larger body of subordinate reference/history. The machine-readable lifecycle map is [`DOCS_MANIFEST.json`](DOCS_MANIFEST.json). Archived documents are context only and never override active authorities.

## Governing authorities

- [`Nemosyne_Definitive_Vision_and_Roadmap.md`](Nemosyne_Definitive_Vision_and_Roadmap.md) - canonical product, research, and architecture direction.
- [`ROADMAP.md`](ROADMAP.md) - canonical live implementation status, programme order, current Streams A-D ownership/collision rules, and review findings.
- [`../AGENTS.md`](../AGENTS.md) - canonical tool-neutral engineering/agent contract.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - active technical reference, subordinate to the governing vision where migration remains incomplete.

Executable facts such as commands, dependency/tool versions, CI topology, coverage thresholds, and package metadata are authoritative only in their executable configuration (`package.json`, workflows, test configs, toolchain files, and source). Documentation should link to those sources instead of copying values that can drift.

## Engineering governance

- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) - contribution and verification workflow.
- [`../SECURITY.md`](../SECURITY.md) - vulnerability reporting and security model.
- [`OWNERSHIP.md`](OWNERSHIP.md) - semantic ownership and specialist review map.
- [`RFC_PROCESS.md`](RFC_PROCESS.md) - lightweight threshold for durable architecture/trust-boundary changes.
- [`rfcs/0003-production-data-lifecycle-and-event-boundary.md`](rfcs/0003-production-data-lifecycle-and-event-boundary.md) - proposed PT3 production identity, purpose-scoped consent, lifecycle, event-envelope and runtime-provenance boundary.
- [`architecture/decisions/README.md`](architecture/decisions/README.md) - accepted Architecture Decision Records.

## Implementation and engineering reference

- [`IMPLEMENTATION_PLAN_V3.md`](IMPLEMENTATION_PLAN_V3.md) - V3 sequencing and dependency structure; `ROADMAP.md` governs live status.
- [`DEVELOPER_EXPLAINER.md`](DEVELOPER_EXPLAINER.md) - developer onboarding and codebase mental model.
- [`MIGRATION.md`](MIGRATION.md) - migration reference where still applicable.
- [`CI_TEST_ACCELERATION_STRATEGY.md`](CI_TEST_ACCELERATION_STRATEGY.md) - CI evidence/latency strategy and measured sharding work.
- [`STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md`](STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md) - quality-process contract created under the previous A/B/C wave; still useful as engineering guidance but not the current Stream A mission.
- [`STREAM_C_SECURITY_ASSURANCE.md`](STREAM_C_SECURITY_ASSURANCE.md) - security/live-path finding set created under the previous A/B/C wave; unresolved findings are now owned by current Stream D.
- [`STATISTICAL_METHOD_REGISTER.md`](STATISTICAL_METHOD_REGISTER.md) - governed statistical method inventory.
- [`GETTING_STARTED.md`](GETTING_STARTED.md) - user/developer setup reference.
- [`../README.md`](../README.md) - repository entry point.

These documents may describe current implementation but must not override the governing authorities above. Historical stream labels retained in active evidence/reference documents are provenance, not current execution ownership.

## Product and spatial interaction reference

- [`Nemosyne_UX_Flow_and_Spatial_Interface_Design_Spec.md`](Nemosyne_UX_Flow_and_Spatial_Interface_Design_Spec.md)
- [`Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`](Nemosyne_VR_UI_Design_System_and_Agent_Spec.md)
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)

## Study and research governance

- [`study/README.md`](study/README.md)
- [`study/PROTOCOL.md`](study/PROTOCOL.md)
- [`study/ANALYSIS_PLAN.md`](study/ANALYSIS_PLAN.md)
- [`study/CONFOUNDS.md`](study/CONFOUNDS.md)
- [`study/REPRESENTATION_EQUIVALENCE.md`](study/REPRESENTATION_EQUIVALENCE.md)
- [`study/CONSENT.md`](study/CONSENT.md)
- [`study/DATA_DICTIONARY.md`](study/DATA_DICTIONARY.md)
- [`study/version.json`](study/version.json)

Study material is operational research governance; it does not override product/architecture authority.

## Historical archive

- [`archive/README.md`](archive/README.md) - archive index.
- Historical roadmaps, completed sprint plans, superseded designs, audits, and point-in-time readiness reports belong under `archive/`.
- The former root `TEST_READY.md`, `TEST_INFRA.md`, and `draco_viso.md` are archived because their counts, naming, or migration assumptions no longer describe the live project.

## Documentation rules

1. A document may have only one lifecycle/authority classification in `DOCS_MANIFEST.json`.
2. Canonical authorities should be few. New status documents should normally update `ROADMAP.md` instead.
3. Historical documents must live under `archive/` and may not be cited as current authority.
4. Machine-readable facts are not duplicated in agent prose.
5. Any change to documentation authority or engineering instructions must pass `npm run docs:check`.
6. If an active document conflicts with a governing authority, update it, clearly subordinate its operational status to `ROADMAP.md`, or archive it as part of the next touching change.
