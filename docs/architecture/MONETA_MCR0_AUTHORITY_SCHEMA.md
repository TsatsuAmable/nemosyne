# Moneta MCR0 Authority and Schema Decision

**Status:** accepted for MCR0 implementation

## Ownership map

| Contract                    | Owns                                                                                                         | Must not own                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `SemanticEmbodimentGraphV1` | governed semantic phenomena, abstraction, information preservation/loss, evidence references and refinement  | renderer geometry, layout or utility ranking                              |
| `RepresentationGraph`       | representation primitives, semantic bindings, composition relations, representation policies and limitations | analytical facts/evidence or transient world transforms                   |
| `SpatialEmbodimentPlanV1`   | bounded presentation phenotype and stable spatial element identity                                           | analytical inference, evidence admissibility or semantic reinterpretation |

`RepresentationGenome` remains external laboratory search/provenance state and is not a production analytical authority.

## Stable identity chain

`SemanticEmbodimentNodeV1.id -> RepresentationPrimitive.id -> SpatialEmbodimentElementV1.id`.

A representation primitive may consume multiple semantic node IDs. A new compositional spatial element carries both `semanticNodeId` and `representationPrimitiveId`. The latter is optional only for V1 compatibility with existing producers. Spatial or representation identity cannot replace semantic/evidence identity.

## Compatibility fields

Dataset identity repeated in provenance/plan is a fail-closed cross-check, not a new authority. `decisionId` remains semantic decision lineage. `presentationHints` are non-authoritative. `visualEncoding`, graph policy fields and `semanticMappings` remain compatibility surfaces pending MCR1/MCR2 validation/compiler work.

## Structural admission bounds

These are safety ceilings, not device-performance claims:

- semantic graph: 256 nodes, 64 roots, 64 child/refinement refs per node;
- representation graph: 256 primitives, 512 edges, 256 semantic mappings, 64 semantic inputs per primitive;
- spatial plan: 1024 elements, 64 parameters per element.

Exceeding a ceiling fails validation. UXR/resource qualification, not these constants, owns usable operating envelopes.

## Version decision

MCR0 is a backwards-compatible V1 tightening. Validators gain finite bounds and the spatial element gains one optional provenance/binding field. No existing field changes meaning and no trust authority moves. No schema major bump/RFC is required for MCR0. Making the binding mandatory, moving evidence authority, or changing serialization semantics requires a fresh version/RFC decision.

## Falsifiers

MCR0 fails if oversized structures pass validation, spatial identity substitutes for semantic identity, geometry/layout manufactures analytical meaning, or the legacy runtime silently flattens multiple renderable primitives. The existing multi-renderable fail-closed restriction remains deliberately intact until MCR3.
