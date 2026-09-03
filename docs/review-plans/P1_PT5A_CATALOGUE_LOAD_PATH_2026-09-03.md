# P1-PT5A Catalogue Load Path — Pre-Implementation Adversarial Review

Date: 2026-09-03  
Base: `main@0cfe54c2e2824328cf33cc738769ae68602820f8`  
Status: IMPLEMENTATION ACTIVE

## Mission

Make the ordinary product data-loader consume the canonical `TsatsuAmable/nemosyne-data` catalogue through an immutable, governed, integrity-checked acquisition contract before any dataset reaches Atlas/Rust parsing and the existing `LoadDatasetUseCase` / Moneta representation path.

## Existing production path

`FileLoaderUI` already has a remote-corpus browse/load surface and sends verified bytes through `AtlasCore.parseBytes`, so a second parser or analytical implementation is neither needed nor allowed.

The material defect is contract drift at the acquisition boundary:

- production `NemosyneDataCatalogClient` is pinned to an obsolete corpus revision and requires catalogue schema `1.0`;
- canonical `nemosyne-data` is now pinned at `8e6b2dfc74ea1c60283790668cc93030c61423f8`, catalogue schema `2.2`, corpus `nemosyne-corpus-v0.4.0`;
- schema 2.2 adds dataset version, governance state, privacy/licence/provenance, intended-use and measurement-schema requirements that product loading must not discard at admission;
- a second qualification-only `GitHubCorpusConnector` independently carries the obsolete 1.0/main-branch assumptions, creating a future divergence trap.

## Adversarial implementation contract

**High-risk data-boundary change.** The implementation must satisfy all of the following:

1. Pin product and qualification acquisition to the same immutable reviewed nemosyne-data revision.
2. Accept only the exact supported catalogue schema version and fail closed on schema drift.
3. Validate the v2.2 governance/measurement identity needed to decide whether a dataset is loadable.
4. Refuse non-governed datasets before artifact download or kernel ingest.
5. Preserve path/origin, byte ceiling, exact byte-count and SHA-256 checks.
6. Do not trust catalogue topology as analytical authority; Rust/Atlas inference remains authoritative after bytes arrive.
7. Do not add a TypeScript CSV/JSON parser or scientific fallback.
8. Keep qualification and product connectors on one corpus revision/schema contract even if their final consumers differ.
9. Falsify obsolete-schema acceptance, non-governed loading, malformed measurement metadata, duplicate dataset identity and digest/size drift.
10. Do not claim XR parity from this tranche merely because the desktop loader can browse the catalogue. XR browse/schema-correction interaction remains subsequent PT5 work unless production XR wiring is added and proven here.

## Primary attack questions

- Can a candidate/retired corpus entry be downloaded or presented as governed evidence?
- Can a mutable branch silently change the qualification corpus?
- Can the product and qualification connectors validate different catalogue generations?
- Can a malformed measurement schema cross the product admission boundary?
- Can catalogue topology override Rust inference?
- Can path traversal, redirect, size or digest drift bypass the acquisition fence?

## Intended bounded disposition

ADOPT only if the literal final head proves the canonical v2.2 catalogue can be admitted under the immutable governed contract while obsolete/non-governed/malformed inputs fail closed, with the ordinary repository promotion suite green.
