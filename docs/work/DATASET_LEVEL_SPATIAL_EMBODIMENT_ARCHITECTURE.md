# Dataset-Level Spatial Embodiment Architecture Critique

**Status:** CRITIQUE COMPLETE / PROPOSED ADAPT DECISION UNDER OWNER REVIEW
**Date:** 2026-10-04  
**Scope:** Full Moneta / Forma representation abstraction boundary

**Proposed resolution:** [`../architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md`](../architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md). This document remains the intake critique and falsification brief; the linked design owns the proposed solution, research gaps, FM0-FM8 reconciliation and DSE0-DSE6 roadmap.

## Problem

Current Nemosyne code distinguishes semantic abstraction levels including `DATASET`, `REGION`, `SUBSTRUCTURE`, `OBSERVATION_SET` and `OBSERVATION`. However, this does not establish that a dataset is itself a first-class spatially representable entity.

The current `RepresentationGraph` vocabulary contains primitives such as `POINT_IDENTITY`, `DENSITY`, `FIELD`, `CLUSTER`, `TRAJECTORY`, `HIERARCHY`, `GRAPH`, `MATRIX`, `MANIFOLD`, `DISTRIBUTION`, `TEMPORAL` and `SPECTRAL`, but no explicit dataset-level representation primitive or equivalent first-class contract.

The conventional renderer reinforces the distinction: GRID_3D, FORCE_DIRECTED_3D, RADIAL_ORBITAL, VECTOR_STREAMLINE, TIME_RIBBON, GEO_SURFACE and SPECTRAL_VOLUME predominantly arrange rows/observations or within-dataset structure. ICOSA_NODE is likewise a datum/entity glyph. These must not be described as dataset representations merely because they consume a dataset.

Forma provides a more promising path because a compiled spatial slice can bypass raw-row layout, and composed representation validation already understands dataset-level semantic identity. The architectural question is whether that machinery is sufficient, should be extended, or needs a distinct dataset-embodiment contract.

## Required architecture analysis

An architecture-level agent must inspect current `main` before proposing implementation and answer:

1. What is the precise semantic and product definition of a **dataset-level spatial embodiment**?
2. Must `DATASET` become a `RepresentationPrimitiveKind`, or would that incorrectly mix semantic subject with representational technique?
3. Should dataset embodiment instead be represented as a root/container in `SemanticEmbodimentGraphV1`, `RepresentationGraph`, Forma compiled output, or a new bounded contract?
4. How should the hierarchy dataset -> region/substructure -> observation-set -> observation survive compilation, rendering, interaction, persistence and deterministic replay?
5. Can multiple datasets be represented simultaneously as independently addressable spatial objects, compared, nested or related without collapsing their provenance?
6. Which properties may legitimately shape dataset geometry: topology, distributions, provenance, measurement regime, uncertainty, temporal structure, missingness, relationships, semantic ontology? Which require governed evidence?
7. How do deterministic/reproducible and conjectural/predictive Moneta modes apply to dataset embodiments?
8. What is the minimum vertical slice that proves a dataset is represented as an entity rather than merely serving as input to a point/layout renderer?
9. What existing abstractions can be reused without creating duplicate analytical authority or a new representation god object?
10. What claims must remain explicitly unmade until human/device qualification demonstrates that dataset-level embodiment provides useful comprehension?

## Mandatory falsifiers

Do not promote the capability if any of these remain true:

- Removing row glyphs leaves no independently meaningful/addressable dataset object.
- The purported dataset embodiment is only a bounding box, label or decorative container around an existing point layout.
- Dataset identity cannot survive persistence/replay independently of observation mesh identity.
- Two datasets cannot coexist without semantic/provenance collision.
- Geometry encodes analytical claims that lack Atlas/governed evidence.
- The implementation merely adds a `DATASET` enum without a distinct compilation/rendering/interaction behavior.
- A user cannot traverse from dataset-level object to governed finer detail and back while retaining identity/context.

## Minimum proof target

Design a bounded experiment with at least two materially different datasets. Each must compile to an independently addressable dataset-level spatial object whose structure is derived from governed dataset semantics, not merely row placement. Demonstrate:

- stable dataset identity and provenance;
- dataset -> substructure -> observation traversal;
- deterministic replay equality for deterministic mode;
- explicit provenance/uncertainty for conjectural contributions;
- simultaneous multi-dataset composition or comparison;
- reverse explanation of why major geometric features exist;
- a falsification test distinguishing dataset embodiment from an ordinary row layout.

## Decision required

The architecture agent should return one of:

- **ADOPT:** specify the smallest implementation tranches, contracts, ownership boundaries, tests and qualification gates;
- **ADAPT:** show that existing Forma/RepresentationGraph machinery already provides the correct abstraction and specify only the missing bounded extensions;
- **REJECT:** demonstrate that a separate dataset-level embodiment concept is architecturally unnecessary or harmful, with evidence.

No implementation should begin merely from the assumption that adding `DATASET` to a union is the solution.

## Relevant current code

- `src/moneta/representation/RepresentationGraph.ts`
- `src/moneta/representation/SemanticEmbodimentGraphV1.ts`
- `src/moneta/representation/ComposedRepresentationValidation.ts`
- `src/moneta/forma/FormaSpatialCompiler.ts`
- `src/moneta/embodiment/FormaSpatialEmbodiment.ts`
- `src/moneta/VRTopologyTranslator.ts`

## Exit

Architecture decision is documented, adversarially reviewed, and translated into bounded roadmap tranches only if ADOPT/ADAPT. Do not claim “Nemosyne represents datasets” until the minimum proof target is implemented and qualified.
