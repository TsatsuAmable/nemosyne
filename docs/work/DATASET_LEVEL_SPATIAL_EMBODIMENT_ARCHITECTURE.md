# Dataset-Level Spatial Embodiment Architecture Critique

**Status:** CRITIQUE COMPLETE / PROPOSED ADAPT DECISION UNDER OWNER REVIEW
**Date:** 2026-10-04  
**Scope:** Full Moneta / Forma representation abstraction boundary + semantic LOD / Quest performance  
**Owner lane:** Astra architecture

**Proposed resolution:** [`../architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md`](../architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md). This document remains the intake critique and falsification brief; the linked design owns the proposed solution, research gaps, FM0-FM8 reconciliation and DSE0-DSE6 roadmap.

## Problem

Current Nemosyne code distinguishes semantic abstraction levels including `DATASET`, `REGION`, `SUBSTRUCTURE`, `OBSERVATION_SET` and `OBSERVATION`. However, this does not establish that a dataset is itself a first-class spatially representable entity.

The current `RepresentationGraph` vocabulary contains primitives such as `POINT_IDENTITY`, `DENSITY`, `FIELD`, `CLUSTER`, `TRAJECTORY`, `HIERARCHY`, `GRAPH`, `MATRIX`, `MANIFOLD`, `DISTRIBUTION`, `TEMPORAL` and `SPECTRAL`, but no explicit dataset-level representation primitive or equivalent first-class contract.

The conventional renderer reinforces the distinction: GRID_3D, FORCE_DIRECTED_3D, RADIAL_ORBITAL, VECTOR_STREAMLINE, TIME_RIBBON, GEO_SURFACE and SPECTRAL_VOLUME predominantly arrange rows/observations or within-dataset structure. ICOSA_NODE is likewise a datum/entity glyph. These must not be described as dataset representations merely because they consume a dataset.

Forma provides a more promising path because a compiled spatial slice can bypass raw-row layout, and composed representation validation already understands dataset-level semantic identity. The architectural question is whether that machinery is sufficient, should be extended, or needs a distinct dataset-embodiment contract.

## Dataset-first principle

Treat the dataset, not the observation glyph, as the default first-class representational subject. Observation-level geometry becomes progressively disclosed detail beneath that subject rather than the mandatory base representation.

This is the architectural form of the **Stickman -> Mona Lisa** principle: do not spend compute and rendering budget painting detail that is neither semantically nor perceptually useful at the current investigative scale. The intended pipeline is:

`dataset -> governed semantic structure -> dataset-level embodiment -> task/perceptual budget -> geometry`

rather than:

`dataset -> N rows -> N spatial objects -> render all -> optimize afterwards`

The core performance invariant to evaluate is:

> **Representation complexity should scale primarily with information required for the current investigative task and perceptual context, not with raw dataset cardinality.**

This is semantic level-of-detail (semantic LOD), not merely geometric mesh LOD. It may reduce CPU work, GPU load, object/draw-call count, transforms, interaction bookkeeping, memory pressure and Moneta reasoning work, especially on Quest-class hardware. It is a hypothesis to measure, not a performance claim: semantic aggregation, representation search or dynamic recomposition can erase or reverse the gain if poorly bounded.

FM-DSE should therefore be evaluated jointly with FM3/FM4 resolution adaptation and the QCA performance programme, while keeping analytical authority and performance qualification separate.

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
11. Can existing FM3/FM4 resolution adaptation become true semantic LOD over a dataset-first hierarchy, or does it currently adapt only already-instantiated lower-level geometry?
12. Where should perceptual/task budgets be owned so Quest constraints can influence resolution without allowing renderer/device heuristics to become analytical authority?
13. What asymptotic behavior should we expect as raw cardinality grows if visible semantic information is held approximately constant?
14. Which costs move upstream into semantic aggregation/search/recomposition, and what caching/incremental compilation boundaries prevent those costs from overwhelming rendering savings?
15. How should dataset-first and record-first paths coexist for controlled A/B measurement and fallback?

## Mandatory falsifiers

Do not promote the capability if any of these remain true:

- Removing row glyphs leaves no independently meaningful/addressable dataset object.
- The purported dataset embodiment is only a bounding box, label or decorative container around an existing point layout.
- Dataset identity cannot survive persistence/replay independently of observation mesh identity.
- Two datasets cannot coexist without semantic/provenance collision.
- Geometry encodes analytical claims that lack Atlas/governed evidence.
- The implementation merely adds a `DATASET` enum without a distinct compilation/rendering/interaction behavior.
- A user cannot traverse from dataset-level object to governed finer detail and back while retaining identity/context.
- Dataset-first rendering still instantiates work approximately proportional to every raw observation when the current semantic/perceptual task does not require it.
- The performance case relies only on reduced triangle count while object count, draw calls, transforms, interaction state or Moneta recomputation remain cardinality-bound.
- Device/perceptual heuristics silently alter analytical meaning rather than only choosing the resolution at which governed meaning is embodied.

## Minimum proof target

Design a bounded experiment with at least two materially different datasets. Each must compile to an independently addressable dataset-level spatial object whose structure is derived from governed dataset semantics, not merely row placement. Demonstrate:

- stable dataset identity and provenance;
- dataset -> substructure -> observation traversal;
- deterministic replay equality for deterministic mode;
- explicit provenance/uncertainty for conjectural contributions;
- simultaneous multi-dataset composition or comparison;
- reverse explanation of why major geometric features exist;
- a falsification test distinguishing dataset embodiment from an ordinary row layout;
- an A/B benchmark against the current record/layout-first path across increasing cardinalities at approximately equivalent information utility;
- CPU frame cost, GPU/frame timing where available, object/draw-call count, memory, compilation/recomposition latency and interaction bookkeeping;
- evidence that the dataset-first cost curve is materially flatter with cardinality, or an explicit REJECT/ADAPT finding if it is not;
- a Quest-targeted qualification plan, without claiming device performance until physical evidence exists.

## Decision required

The architecture agent should return one of:

- **ADOPT:** specify the smallest implementation tranches, contracts, ownership boundaries, tests and qualification gates;
- **ADAPT:** show that existing Forma/RepresentationGraph machinery already provides the correct abstraction and specify only the missing bounded extensions;
- **REJECT:** demonstrate that a separate dataset-level embodiment concept is architecturally unnecessary or harmful, with evidence.

No implementation should begin merely from the assumption that adding `DATASET` to a union is the solution.

## Astra architecture lane instructions

Astra owns the architecture analysis and planning pass. Before editing conclusions, sync to remote `main` and inspect the live implementation rather than relying on this critique as ground truth.

1. Trace the full authority/data path from dataset ingest and semantic graph through RepresentationGraph/Forma compilation, embodiment, renderer, persistence/replay, interaction and FM3/FM4 resolution adaptation.
2. Produce a concrete abstraction map identifying what is a semantic subject, analytical result, representation primitive, layout, glyph, compiled spatial object and renderer concern. Flag every boundary where these are currently conflated.
3. Test the strongest alternative designs, including: dataset as RepresentationGraph root; dataset as semantic root with representation techniques below it; a bounded DatasetEmbodiment contract; and reuse of existing Forma composition without a new type. Reject unnecessary abstractions.
4. Treat semantic LOD/performance as a first-class architectural requirement. Model expected cost by raw cardinality and visible semantic complexity; identify which costs can become sublinear/cardinality-insensitive and which cannot.
5. Preserve the dual epistemic modes. Deterministic embodiment must replay identically; conjectural/predictive geometry must remain visibly and cryptographically/provenance-distinct where applicable and may never masquerade as observed structure.
6. Preserve Rust/WASM/Atlas/Moneta analytical authority. Device budget, Quest performance or renderer heuristics may select representational resolution but must not invent analytical facts.
7. Define a minimum vertical slice and A/B benchmark that can falsify both the dataset-first semantic claim and the performance hypothesis.
8. Identify exact reuse points in FM3/FM4 and QCA, dependencies, collision risks and obsolete work that the new design supersedes.
9. Return ADOPT, ADAPT or REJECT with evidence. If ADOPT/ADAPT, split implementation into the smallest independently verifiable tranches, assign appropriate lanes, and update the roadmap by links rather than expanding roadmap prose.
10. Do not implement the architecture during this analysis pass unless a change is purely documentary and necessary to record the decision.

### Astra deliverables

- architecture decision/addendum with alternatives and trade-offs;
- current-vs-target authority/data-flow diagram or precise textual equivalent;
- semantic-LOD cost model and benchmark protocol;
- bounded implementation tranche plan with dependencies and owners;
- roadmap reconciliation, including FM3/FM4 and QCA links;
- explicit list of claims still requiring physical Quest and/or human qualification;
- adversarial review of the recommended design before implementation begins.

## Relevant current code

- `src/moneta/representation/RepresentationGraph.ts`
- `src/moneta/representation/SemanticEmbodimentGraphV1.ts`
- `src/moneta/representation/ComposedRepresentationValidation.ts`
- `src/moneta/forma/FormaSpatialCompiler.ts`
- `src/moneta/embodiment/FormaSpatialEmbodiment.ts`
- `src/moneta/VRTopologyTranslator.ts`

## Exit

Architecture decision is documented, adversarially reviewed, and translated into bounded roadmap tranches only if ADOPT/ADAPT. Do not claim “Nemosyne represents datasets” until the minimum proof target is implemented and qualified.
