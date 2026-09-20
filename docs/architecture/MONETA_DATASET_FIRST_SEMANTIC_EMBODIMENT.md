# Moneta Dataset-First Semantic Embodiment Architecture

**Status:** design checkpoint for audit and experimentation  
**Date:** 2026-09-18  
**Baseline audited:** `b22559c22d9cc0d41cb99468c512d4d3baecbf5d`

## 1. Problem

Moneta's primary subject is a **dataset**, not a cloud of observations. Conventional layouts such as grids, spectral layouts, force-directed graphs, scatter/point sets, and polygonal meshes can be useful presentation mechanisms, but they must not silently become Moneta's semantic ontology.

The high-level spatial answer should embody properties of the dataset: populations, distributions, regions, relationships, topology, temporal change, uncertainty, anomalies, and multiscale structure. Individual observations become primary only when an investigator deliberately drills down to that level.

This distinction is constitutional:

> **Moneta chooses and governs the semantic world. Geometry is a phenotype of that world, not its analytical authority.**

## 2. Required abstraction hierarchy

```
Dataset
  -> Rust/WASM analytical authority
  -> evidence-bearing dataset structure
       global properties
       regional structure
       relationships/topology
       distributions/density
       temporal structure
       uncertainty/provenance
  -> Moneta semantic-world decision
  -> semantic embodiment graph
       dataset object
       region/population/relationship
       substructure
       observation subset
       individual observation
  -> spatial embodiment compiler/runtime
  -> XR geometry + interaction + transitions
```

Point-oriented layouts belong primarily near the observation end of this hierarchy. They may also be implementation primitives underneath a semantic embodiment, but their use must not redefine the semantic object as a collection of points.

## 3. Separation of responsibilities

### Rust/WASM analytical authority

Owns analytical facts, membership, identity, evidence, provenance, and admissible transformations. TypeScript and Three.js must not infer analytical truth from geometry.

### Moneta representation intelligence

Chooses **what deserves spatial existence**, at what semantic abstraction, under what evidence and information-loss contract. Moneta may choose multiple coordinated semantic objects rather than one monolithic visualization.

### Semantic embodiment graph

A durable, evidence-bound description of the dataset-level world. Nodes are semantic objects, not meshes. Edges express semantic relationships and drill-down/refinement relations. Each object binds dataset fingerprint, decision identity, analytical provenance, information preserved/lost, and permitted refinement.

This graph is the missing general architectural seam to validate in the audit.

### Spatial embodiment compiler/runtime

Compiles semantic objects into disposable XR presentation. It may use surfaces, fields, volumes, glyphs, trajectories, graphs, particles, instancing, grids, force-directed placement, spectral transforms, or other geometry. Those are **rendering strategies**, subordinate to the semantic contract.

This role resembles the useful historical separation associated with Draco, but this document does not require resurrecting that name. A Draco-like declarative grammar may be appropriate at the spatial-compilation boundary.

### Semantic detail runtime

Drill-down traverses the semantic hierarchy while preserving stable identity and analytical authority:

```
dataset -> region -> substructure -> subset -> observation
```

Refinement is not permission to rematerialize arbitrary source rows. Presentation resources remain disposable and bounded.

## 4. Compute-conditioned semantic fidelity

Additional compute should purchase the opportunity to reveal **defensible additional meaning**, not merely more polygons or faster rendering.

A low budget may support a coarse but truthful dataset-level embodiment. Larger budgets may support more regional structure, conditional relationships, uncertainty, counterfactual alternatives, semantic depth, and richer interaction, provided each increment remains evidence-bound.

The target experimental relationship is:

```
compute budget
  -> analytical/search/evidence budget
  -> semantic representational capacity
  -> retained + newly revealed meaningful structure
```

A higher-compute representation must not be considered superior merely because it is more detailed.

## 5. Evolutionary representation search

Representation search should eventually evolve **semantic embodiments**, not merely choose among fixed point-layout templates.

A candidate genome may encode:

- semantic object families and hierarchy;
- topology and relationships between objects;
- aggregation and abstraction boundaries;
- spatial allocation and geometry strategies;
- information-preservation/loss contracts;
- interaction and drill-down affordances;
- semantic-detail policies;
- transition rules;
- analytical transformations that are explicitly authorized by Rust/WASM evidence.

Variation may mutate these components. Recombination may reuse successful substructures. Existing representation candidates are seeds/baselines/primitives, not necessarily the terminal search space.

The evolutionary record should preserve lineage, rejected alternatives, evidence, failure reasons, model/protocol versions, and artifact hashes. "Road not taken" geometry can therefore correspond to actual evolutionary siblings/ancestors rather than decorative alternatives.

## 6. Fitness and admissibility

No single scalar aesthetic or complexity score may govern selection. Evidence axes remain independently governed where appropriate.

Candidate evaluation should include, where admissible:

- preservation of investigation-relevant global and regional meaning;
- information retained and explicitly lost;
- perturbation stability;
- ability to expose known structure without inventing unsupported structure;
- semantic identity continuity across refinement;
- interpretability/navigation in immersive space;
- latency, memory and resource budgets;
- provenance and deterministic replay;
- human/Quest evidence for comfort, discoverability and meaning where required.

Missing governing criteria produce **ABSTAIN**, not an improvised fitness value. Model consensus is not a decision rule.

## 7. Point-level boundary

`POINT_SET`, grid, spectral, radial, force-directed and related techniques remain legitimate when:

1. the semantic target actually is individual observations;
2. an investigator explicitly drills to observation-level detail; or
3. the technique is an internal rendering primitive for a higher-level semantic object and cannot masquerade as analytical authority.

Fallback from an unavailable semantic embodiment directly to raw rows is therefore architecturally suspect and should be audited.

## 8. Architectural invariants

1. Dataset-level semantics are the default Moneta abstraction.
2. Geometry never becomes analytical authority.
3. Every semantic object has stable dataset-bound identity and provenance.
4. Information loss is explicit.
5. Drill-down changes abstraction deliberately and reversibly.
6. Presentation eviction never destroys analytical meaning.
7. Additional compute may expand semantic depth/search/evidence, but may not relax truth constraints.
8. Evolution operates over governed semantic representations; point layouts alone are insufficient search genes.
9. Lower-compute representations should remain truthful summaries, not degraded guesses.
10. Claims about richer meaning require evidence that the additional structure is real and useful.

## 9. Audit questions

The implementation audit must determine:

- Which dataset-level semantic families are genuinely Rust/WASM-authoritative today?
- Does `SemanticEmbodimentBridge` provide a general semantic graph or only family-specific envelopes?
- Does `VRTopologyTranslator` keep geometry subordinate, or can raw-row fallback bypass semantic authority?
- Are `RepresentationCandidate` entries semantic strategies, rendering strategies, or an unsafe mixture?
- Is semantic drill-down truly dataset -> region -> subset -> observation, with stable identity at every transition?
- Where can raw rows cross into presentation without an explicit abstraction transition?
- Which candidate families exist only as declarations versus production-wired embodiments?
- Can a representation compose several semantic phenomena at once?
- Is there a general recursive/multiscale embodiment grammar?
- Is evolutionary search currently capable of generating/composing representations, or only selecting fixed candidates?
- Can compute budget alter semantic search depth and evidence depth independently of rendering fidelity?
- What part of the historical Draco role remains in `solveDraco` and related code, and should any of it become the spatial embodiment compiler?
- Do UXR2/UXR3 lifecycle governors preserve semantic identity independently of presentation resources?
- Which missing mechanisms must be implemented before the compute/evolution staircase can test the Moneta thesis rather than point-layout performance?

## 10. Experimental consequence

The representation-search staircase is paused as an architectural qualification target until the audit classifies the current implementation. Data-size, repeatability, perturbation, lifecycle, and authority tests may continue.

The eventual evolutionary staircase should vary compute while measuring a **semantic capability frontier**, not merely throughput:

- dataset scale;
- analytical dimensionality/effective structure;
- semantic hierarchy depth;
- candidate population/search breadth;
- perturbation/evidence depth;
- representation composition complexity;
- XR working-set complexity;
- latency/memory/comfort budgets.

Promotion requires reproducible evidence and adversarial adjudication. Physical Quest/human claims retain their existing evidence requirements.

## 11. Immediate next step

Audit the current implementation against this document, classify each invariant and mechanism as **implemented**, **partial**, **declared-only**, **missing**, or **contradicted**, then convert the resulting delta into roadmap work and experimental falsifiers before expanding representation evolution.


## 12. Workstream ownership refinement — 20 September 2026

The implementation audit has now produced concrete `SemanticEmbodimentGraphV1` and
`SpatialEmbodimentPlanV1` contracts alongside the older `RepresentationGraph` contract. Their roles
are fixed as follows:

- `SemanticEmbodimentGraph` carries evidence-bound semantic truth, abstraction/refinement identity and
  information-preservation/loss contracts.
- `RepresentationGraph` is Moneta's compositional hypothesis over those semantic objects: which
  phenomena should coexist, how they coordinate, and which interaction/detail policies are admissible.
- `SpatialEmbodimentPlan` is the disposable spatial phenotype compiled from the semantic +
  representation contracts. Geometry, layout, glyphs, fields and other presentation choices live here.
- `RepresentationGenome` belongs to the separate evolutionary synthesis/laboratory programme. It may
  eventually encode candidate choices across the representation/spatial layers, but it is not a
  production truth source and does not replace any of the three contracts above.

The dedicated production workstream is
[`P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md`](../roadmap/P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md).
It deliberately proves hand-authored/deterministic multi-phenomenon composition before allowing an
evolutionary search algorithm to exploit the space. This resolves the earlier tendency in Sections 5
and 10 to discuss composition and evolution as one implementation tranche: the scientific objective
remains compatible, but their engineering ownership and promotion gates are now separate.
