# Project documentation index

Nemosyne keeps a small set of authoritative documents and a larger body of subordinate reference/history. The machine-readable lifecycle map is [`DOCS_MANIFEST.json`](DOCS_MANIFEST.json). Archived documents are context only and never override active authorities.

## Governing authorities

- [`Nemosyne_Definitive_Vision_and_Roadmap.md`](Nemosyne_Definitive_Vision_and_Roadmap.md) - canonical product, research, and architecture direction.
- [`ROADMAP.md`](ROADMAP.md) - canonical live implementation status, programme order, current authorized forward tranche, collision rules, and review findings.
- [`../AGENTS.md`](../AGENTS.md) - canonical tool-neutral engineering/agent contract.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - active technical reference, subordinate to the governing vision where migration remains incomplete.

Executable facts such as commands, dependency/tool versions, CI topology, coverage thresholds, and package metadata are authoritative only in their executable configuration (`package.json`, workflows, test configs, toolchain files, and source). Documentation should link to those sources instead of copying values that can drift.

## Engineering governance

- [`rfcs/0013-fm8-composition-evidence-binding.md`](rfcs/0013-fm8-composition-evidence-binding.md) - proposed FM8 composition evidence-binding rule (family-match vs positional/primary fallback) for owner review; decides SHADOW-0017 fix shape.
- [`rfcs/0012-minimum-nemosyne-architecture.md`](rfcs/0012-minimum-nemosyne-architecture.md) - proposed minimum architecture and removal-first disposition register; start here for what to delete, merge, defer or externalize before implementing the dataset design.

- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) - contribution and verification workflow.
- [`../SECURITY.md`](../SECURITY.md) - vulnerability reporting and security model.
- [`OWNERSHIP.md`](OWNERSHIP.md) - semantic ownership and specialist review map.
- [`RFC_PROCESS.md`](RFC_PROCESS.md) - lightweight threshold for durable architecture/trust-boundary changes.
- [`rfcs/0003-production-data-lifecycle-and-event-boundary.md`](rfcs/0003-production-data-lifecycle-and-event-boundary.md) - accepted PT3 production identity, purpose-scoped authorization, lifecycle, event-envelope and runtime-provenance boundary.
- [`rfcs/0004-governed-data-plane-vertical-slice.md`](rfcs/0004-governed-data-plane-vertical-slice.md) - accepted PT4 trust-boundary contract for the first authenticated consent-aware ingestion, storage, export and erasure slice.
- [`rfcs/0005-persistence-architecture-rationalisation.md`](rfcs/0005-persistence-architecture-rationalisation.md) - accepted persistence architecture: PostgreSQL is the canonical production server database, one versioned IndexedDB database is the canonical durable browser database, and database implementations remain behind explicit persistence ports.
- [`rfcs/0009-persisted-governed-evidence-replay.md`](rfcs/0009-persisted-governed-evidence-replay.md) - accepted TEC1 receipt-bearing package/replay contract: the V3 evidence format and the governed replay contract that consumes it.
- [`architecture/decisions/README.md`](architecture/decisions/README.md) - accepted Architecture Decision Records.

## Implementation and engineering reference

- [`roadmap/P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md`](roadmap/P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md) - dedicated downstream Moneta compositional-representation workstream; reuses RepresentationGraph, semantic/spatial embodiment contracts and keeps evolutionary synthesis/search separate.
- [`architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md`](architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md) - **canonical Full-Moneta target architecture**: consolidates evidence/semantic authority, human-grounded metaphor knowledge, deterministic Forma compilation, perspective, semantic resolution, System-1/System-2 roles, feedback/evolution loops and machine-addressable build lanes.
- [`architecture/ARCHITECTURE_2027_REVIEW.md`](architecture/ARCHITECTURE_2027_REVIEW.md) - ERA-ASTRA1 adjudication of the target architecture against actual source topology; records KEEP/CHANGE/INVESTIGATE decisions, falsifiers and RFC/ADR triggers. It is an active review artifact, not a second target architecture.
- [`architecture/A27_1_DUAL_EPISTEMIC_REASSESSMENT.md`](architecture/A27_1_DUAL_EPISTEMIC_REASSESSMENT.md) - reassessment against merged dual-purpose vision; scopes retained invariants and affected implementation gates.
- [`rfcs/0011-dual-epistemic-embodiment-and-preservation.md`](rfcs/0011-dual-epistemic-embodiment-and-preservation.md) - accepted-as-amended adjudication with concrete snapshot/context boundaries, validated conjectural bindings, V4 static preservation and lane clearance.
- [`architecture/A27_0_AUTHORITY_VERSION_DECISION.md`](architecture/A27_0_AUTHORITY_VERSION_DECISION.md) - accepted A27-0 snapshot, obligation, admission-purpose and replay/version decision with bounded L0/L1/L2 handoffs; A27-1 qualifies readiness at the dual-purpose context/admission/preservation seams.
- [`rfcs/0010-moneta-semantic-snapshot-and-forma-admission.md`](rfcs/0010-moneta-semantic-snapshot-and-forma-admission.md) - accepted public/trust-contract extension for A27-0; project-owner acceptance recorded on 3 October 2026, with production implementation and evidence still required.
- [`DEVELOPER_EXPLAINER.md`](DEVELOPER_EXPLAINER.md) - developer onboarding and codebase mental model.
- [`MIGRATION.md`](MIGRATION.md) - migration reference where still applicable.
- [`CI_TEST_ACCELERATION_STRATEGY.md`](CI_TEST_ACCELERATION_STRATEGY.md) - CI evidence/latency strategy and measured sharding work.
- [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) - generated human projection of desired service boundaries, implementation/deployment states, and verification obligations. `governance/production-readiness.json` is its machine-readable source; `ROADMAP.md` still governs sequencing and completion claims.
- [`STATISTICAL_METHOD_REGISTER.md`](STATISTICAL_METHOD_REGISTER.md) - governed statistical method inventory.
- [`GETTING_STARTED.md`](GETTING_STARTED.md) - user/developer setup reference.
- [`../README.md`](../README.md) - repository entry point.

These documents may describe current implementation but must not override the governing authorities above. Historical stream labels retained in active evidence/reference documents are provenance, not current execution ownership.

## Product and spatial interaction reference

- [`SEMANTIC_EMBODIMENT_VISION_CLARIFICATION.md`](SEMANTIC_EMBODIMENT_VISION_CLARIFICATION.md) - concise vision clarification: Moneta Forma as a semantic-to-perceptual responsibility, dataset-level embodiment, multimodal encoding and perturbation as sensory interrogation; subordinate to the Definitive Vision and live roadmap.
- [`architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md`](architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md) - detailed dataset-first dual-mode contracts, FM0-FM8 evidence, performance and research gaps; RFC 0012 narrows initial delivery and makes advanced extensions conditional.
- [`NEMOSYNE_USER_EXPERIENCE_DESIGN_DOCTRINE.md`](NEMOSYNE_USER_EXPERIENCE_DESIGN_DOCTRINE.md) - normative UX doctrine for semantic fidelity, semantic level of detail, progressive streaming, bounded resource use, long-session stability, and hardware-scaled headroom; subordinate to the Definitive Vision.
- [`Nemosyne_UX_Flow_and_Spatial_Interface_Design_Spec.md`](Nemosyne_UX_Flow_and_Spatial_Interface_Design_Spec.md)
- [`Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`](Nemosyne_VR_UI_Design_System_and_Agent_Spec.md)
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)

## Current Full Moneta review

- [`review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md`](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) — source-grounded completeness audit at f00b3f90, prioritized defects and ordered repair handoffs; ROADMAP owns execution status.
- [`review-plans/DSE0_PREFLIGHT_AND_REMOVAL_INVENTORY.md`](review-plans/DSE0_PREFLIGHT_AND_REMOVAL_INVENTORY.md) — DSE0 reduction preflight, candidate removal caller inventory, direct deterministic compile path specification, and production falsifiers under RFC 0012 / ADR-0013.

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

## GitHub Wiki

The repository GitHub Wiki is a generated reference surface, not an independent documentation authority. `scripts/generate-wiki.mjs` projects every non-historical entry in `DOCS_MANIFEST.json` into Wiki pages and also builds a codebase index from exported TypeScript symbols under `src/`.

`.github/workflows/wiki-sync.yml` validates the projection on pull requests and republishes the Wiki after relevant changes land on `main`. The publish job mirrors the generated output, so manually edited Wiki pages are intentionally replaced rather than allowed to diverge from version-controlled sources.

If information in the Wiki conflicts with repository documentation or executable configuration, the repository source is authoritative. Changes intended for the Wiki must therefore be made to the corresponding source document or generator, reviewed through the normal pull-request process, and then published automatically.

## Historical archive

The documentation lifecycle review of 21 September 2026 demoted `IMPLEMENTATION_PLAN_V3.md`, `STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md`, and `STREAM_C_SECURITY_ASSURANCE.md` from active authority. They now live under `docs/archive/` as repository history/reference; they must not be used as live sequencing, concurrency, or finding-status authority. Point-in-time stream reviews were consolidated under `docs/archive/review/` on 2026-10-06.


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
7. GitHub Wiki pages are generated projections and must not be edited as independent sources of truth.
8. Service/deployment/test-readiness debt belongs in `governance/production-readiness.json`; update the generated `PRODUCTION_READINESS.md` with `node scripts/render-production-readiness.mjs --write` rather than maintaining a parallel hand-written status list.
