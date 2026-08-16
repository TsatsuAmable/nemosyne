# Roadmap History

This document archives completed, superseded, and deprecated roadmap material removed from the
live roadmap. It is historical context only. Do not use it to determine current implementation
status or planned work.

The live roadmap is [`../ROADMAP.md`](../ROADMAP.md). Product direction and governance are in
[`../PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md`](../PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md).

## Completed Phase Index

The following phases were completed or substantially implemented before the current
Stable Alpha / Atlas planning cycle:

| Phase | Historical scope | Current interpretation |
| --- | --- | --- |
| 1 | Foundation | Runtime, WebXR, input, telemetry, and tests established |
| 2 | Specification | Draco constraints and serializable visual specifications |
| 3 | Core framework | Dataset model, topology translation, panels, streams, and menus |
| 4 | Examples and documentation | Initial product and example documentation |
| 5 | Artefact library | Artefact variants, topology layouts, TDA glyphs, and transforms |
| 6 | Real-world deployment | Build/deploy pipeline, desktop fallback, serializers, collaboration scaffolding |
| 7 | Comfort and scalability | Anchoring, feedback, instancing, spatial index, LOD, and metaphors |
| 8 | Analytics and TDA | Statistical facts, clustering, anomaly operations, chart planes, and TDA summaries |
| 9 | Production polish | Inspector, tooltips, menus, dashboards, locomotion, tour, gestures, and themes |
| 10A | Validate and harden | CSV import, session persistence, export, accessibility, telemetry, gesture coaching |
| 10B | Scale and collaborate | Networking, shared state, avatars, annotations, and desktop companion scaffolding |
| 11 | Runtime intelligence and ergonomics | Torso anchor, wheel redesign, guided tour, UX analysis, pooling |
| 12 | AI tuning and validation | Gesture harness, recommender evaluation, feedback loop, benchmarks, and polish |
| 13 | Ingestion and provenance export | Import mapping, binary parser experiments, export and recovery work |
| 14 | Runtime performance | Texture caching, buffer updates, frame governor, and memory work |
| 15 | Collaborative palaces | WebRTC state, peer presence, annotations, and collaborative benchmark scaffolding |
| 16 | Voice and natural language | Speech query and audio feedback experiments |
| 17 | Architectural hardening | World decomposition, worker experiments, networking, and governor integration |
| 18 | Runtime integration | Scene/workspace wiring, workers, binary pose, and governor integration |
| 19 | Zero-copy protocol | Binary peer IDs, event dispatch, workspace lifecycle, and protocol hardening |
| 20 | Graphics optimization | Instanced buffers, canvas upload, context recovery, and frame shedding |
| 21.1-21.2 | Rust/WASM foundation and data layer | Tooling and data operations completed; later migration remains gated |
| 22.1-22.2 | UX convergence and low-strain polish | Quick wins, TDA visibility, tour, controls, and presets completed |

These entries describe historical workstreams, not a guarantee that every capability is fully
wired, production-qualified, or suitable as study evidence. The audit documents retain the
original evidence and caveats:

- [`../AUDIT_PHASES_1_20.md`](../AUDIT_PHASES_1_20.md)
- [`../AUDIT_RECOMMENDATION.md`](../AUDIT_RECOMMENDATION.md)
- [`../PHASE_22_3_VALIDATION_REPORT.md`](../PHASE_22_3_VALIDATION_REPORT.md)

## Superseded Planning

- The former “Validate & Harden OR Scale & Collaborate” fork is closed as a planning model.
  Stable Alpha now has its own research-instrument gates; collaborative analysis remains
  deferred.
- The former stable-alpha roadmap is historical. Its unique study-harness requirements are
  represented in the live roadmap and canonical study package.
- The former broad AI, voice, TDA, connector, and multiplayer expansion lists are not active
  priorities unless promoted through a current roadmap decision.
- The former Atlas proposal remains detailed design background, but the approved release split
  and governance are in the product architecture document.

## Deprecated Claims

The following claims must not be carried forward merely because they appeared in completed
phase headings:

- A class with tests is not necessarily production-wired.
- Existing session persistence is not analytical provenance or deterministic replay.
- Existing clustering/TDA utilities are not automatically validated statistical methods.
- Existing collaboration code is not a Stable Alpha requirement.
- Runtime tests and benchmarks do not demonstrate user benefit or VR superiority.

## Archive Policy

Add future historical summaries here when a live roadmap section is retired. Keep the live
roadmap focused on active work, blockers, acceptance criteria, and decisions. Do not append
completed feature inventories to `docs/ROADMAP.md`.
