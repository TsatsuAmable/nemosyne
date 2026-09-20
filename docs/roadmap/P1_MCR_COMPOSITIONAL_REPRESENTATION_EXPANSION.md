# P1-MCR — Moneta Compositional Representation Expansion

**Status:** PLANNED / DOWNSTREAM OF THE CURRENT P1-UXR -> P1-WP -> P1-WQ -> PT9/PT10 EXECUTION ORDER  
**Established:** 20 September 2026  
**Audit baseline:** `main@1173ac882206e798c1666802e5cb6ed9a7fa698d` (#791)  
**Live status authority:** `docs/ROADMAP.md`  
**Governing vision:** `docs/Nemosyne_Definitive_Vision_and_Roadmap.md`  
**Dataset-first design:** `docs/architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md`  
**Scientific admissibility:** `docs/research/MONETA_EVIDENCE_PROTOCOL.md`

## 1. Mission

Expand Moneta from a compatibility graph around one fixed representation winner into a governed **compositional representation capability** in which several evidence-bound semantic phenomena can coexist in one representation and be embodied by several coordinated spatial elements.

This workstream owns the representation architecture and production embodiment path. It is deliberately **separate from the evolutionary synthesis algorithm**.

The intended stable layering is:

```text
Rust/WASM DatasetEvidence + governed semantic payloads
  -> SemanticEmbodimentGraph
       evidence-bound semantic truth and refinement identity
  -> RepresentationGraph
       Moneta's compositional representation hypothesis
  -> SpatialEmbodimentPlan
       disposable spatial phenotype / presentation plan
  -> desktop / WebXR runtime
```

A future `RepresentationGenome` may encode candidate choices across these layers for search, mutation, recombination, lineage and laboratory evaluation. It is not an analytical authority, not the runtime representation contract, and not owned by this workstream.

## 2. Existing structures to reuse

P1-MCR must extend the structures that are already present. It must not create replacement graphs or competing authorities.

### `RepresentationGraph`

Reuse as the Moneta-owned representation hypothesis boundary. It already carries:

- representation primitives;
- explicit composition edges;
- semantic mappings;
- interaction/detail/scale/layout policies;
- hard constraints;
- ontology/model/dataset/evidence provenance.

The current compatibility adapter is valuable migration infrastructure and remains the path for fixed single-winner decisions until compositional generation is qualified.

### `SemanticEmbodimentGraphV1`

Reuse as the evidence-bound semantic-object graph. Its dataset fingerprint, decision identity, node abstraction level, refinement relations, information preservation/loss and evidence references are the semantic truth that a representation consumes.

It must remain independent of Three.js resources and of search strategy.

### `SpatialEmbodimentPlanV1`

Reuse as the spatial compiler/runtime boundary. Spatial primitives and presentation parameters belong here rather than becoming analytical or semantic truth inside Moneta.

A spatial plan is a phenotype. Different spatial plans may embody the same semantic graph without changing what the dataset is claimed to mean.

### `RepresentationGenome`

The laboratory architecture in `TsatsuAmable/nemosyne-data` already defines the Version-1 genome concept: semantic hierarchy/composition, spatial allocation, allowed primitives, encodings, interaction/detail/transition policy, evidence requirements and resource policy are genes; analytical facts, dataset fingerprint, governing provenance and oracle truth are explicitly not genes.

There is **no concrete `RepresentationGenome` production type on Nemosyne `main` at this audit baseline**. P1-MCR therefore must not invent a competing genome type. When the laboratory contract is promoted to a stable shared interface, Nemosyne may add a versioned adapter that materialises a genome into an ordinary validated `RepresentationGraph` / `SpatialEmbodimentPlan`, with analytical truth still supplied by the existing semantic/evidence authorities.

Genome operators, evolutionary search, population management, fitness optimisation, lineage strategy and search baselines remain outside P1-MCR.

## 3. Live audit findings

### MCR-A1 — `RepresentationGraph` is compositional in schema but not yet in production embodiment

The graph contract supports several primitives and composition edges, but `representationDecisionToGraph()` compiles the current Moneta decision into one renderable primary primitive plus an optional metadata-only `DETAIL_EXPANSION` node.

This is a compatibility representation of the fixed-candidate architecture, not genuine composition.

### MCR-A2 — the runtime adapter explicitly forbids multi-primitive embodiment

`representationGraphToRuntimeSpec()` requires exactly one primitive with embodied geometry and fails closed otherwise.

That fail-closed behavior is correct today, but it is the primary production barrier to coordinated multi-phenomenon representations.

### MCR-A3 — semantic truth and spatial phenotype are not yet connected by one general compiler

`SemanticEmbodimentGraphV1` and `SpatialEmbodimentPlanV1` are concrete contracts, but there is no general production compiler that binds:

```text
semantic node
  -> representation primitive
  -> one or more spatial elements
```

with stable dataset/decision/evidence identity across the whole chain.

### MCR-A4 — spatial concerns still leak into `RepresentationGraph`

The current graph carries `visualEncoding`, `layoutPolicy` and compatibility geometry/interaction vocabulary because it must feed the old renderer contract.

P1-MCR must migrate toward a clean rule:

- `RepresentationGraph` says which semantic phenomena exist, how they coordinate, what interactions/details are allowed, and what information/constraints govern them;
- `SpatialEmbodimentPlan` says how those phenomena are spatially realised.

Compatibility fields may remain during migration but must not become permanent duplicate authority.

### MCR-A5 — composition relations are structurally checked but not semantically qualified

Current graph validation checks IDs, dangling endpoints and self-edges. It does not yet establish relation-specific legality, acyclicity where required, information-preservation composition, evidence compatibility, resource bounds, or whether two primitives may safely share the same semantic object.

### MCR-A6 — governed semantic families remain family-specific

Aggregate, Distribution, Density, Cluster and Relationship Graph have real Rust/WASM-governed production paths. They are strong ingredients, but they are selected/presented as family-specific embodiments rather than assembled into one governed semantic world.

### MCR-A7 — recursive semantic detail is a foundation, not yet a general composition mechanism

The existing detail path preserves dataset/decision/semantic identity and fails closed against resident Worker/WASM authority. P1-MCR should reuse that identity/refinement machinery for composed semantic nodes rather than introduce a second drill-down protocol.

### MCR-A8 — dataset-first raw-row protection must survive composition

Dataset-level semantic decisions may not gain a new path back to broad raw-row materialisation merely because a graph has multiple primitives. Observation-level rendering remains legal only under explicit observation authority or bounded semantic-detail transition.

### MCR-A9 — replay/lifecycle/resource qualification is single-phenomenon biased

UXR2/UXR3 establish useful identity, residency, eviction, reconstruction and bounded-materialisation infrastructure. Multi-element representations must prove that one element can cool/evict/rebuild independently without mutating semantic truth, corrupting selection identity, or forcing the whole representation to rematerialise.

### MCR-A10 — synthesis architecture is a separate missing mechanism

The evolutionary laboratory may eventually generate or recombine representation candidates through a `RepresentationGenome`. That algorithm is not required to prove that Nemosyne can faithfully execute a hand-authored or deterministic composed `RepresentationGraph`.

P1-MCR must make composition correct before any search algorithm is permitted to exploit it.

## 4. Ownership and non-goals

P1-MCR owns:

- representation-graph composition semantics;
- binding representation primitives to semantic objects and evidence;
- the semantic-to-spatial compiler boundary;
- multi-element spatial embodiment;
- composed selection/detail semantics;
- composed lifecycle/replay/resource correctness;
- a deterministic/manual/reference composition path sufficient to qualify the architecture;
- a future adapter seam for an externally defined `RepresentationGenome`.

P1-MCR does **not** own:

- evolutionary mutation/recombination/search;
- population or generation orchestration;
- quality-diversity/Pareto search policy;
- model training or PT9 learning policy;
- new analytical facts, clustering, manifolds, correlations or membership logic;
- scientific admissibility criteria already governed by the Moneta Evidence Protocol;
- raw-row analytical fallbacks;
- a second semantic-detail API;
- a replacement for UXR lifecycle/resource governors.

### Public Datasphere direction preview (non-production)

The nemosyne.world homepage may carry a lightweight curated Datasphere preview to communicate the intended dataset-level direction of Full Moneta before P1-MCR is production-ready. This preview is a communication artefact, not an implementation shortcut or completion claim.

Guardrails:

- preserve the Datasphere's spatial visual character rather than replacing it with an explanatory diagram;
- render the preview with Three.js, matching Nemosyne's production renderer dependency and reusing Nemosyne visual semantics such as the void/fog world, wireframe emissive ICOSA_NODE-style artefacts, TechnoCore-style orbital structures, governed colour tokens and line/flow vocabulary;
- do not reintroduce A-Frame, A-Frame scene primitives, or a second analytical/representation authority;
- represent datasets, derived artefacts, evidence and investigation context at the concept level rather than implying that displayed objects are raw datapoints;
- label hand-authored layouts explicitly as illustrative and not Moneta-generated;
- do not infer or imply analytical meaning from visual proximity, size, colour, motion or connectivity unless that meaning is supplied by governed evidence;
- do not count the homepage preview as production-path, scientific, runtime, WebXR or P1-MCR qualification evidence;
- as P1-MCR matures, the preview may consume exported or snapshotted RepresentationGraph / SpatialEmbodimentPlan examples, but it must remain downstream of those authorities rather than becoming one.

The historical A-Frame Datasphere prototype remains visual-reference material only. Its composition and atmosphere may inform the public preview, but its A-Frame implementation and semantics are out of scope.

## 5. Sequencing

Planning and contract work may proceed while the current product stream continues. Production implementation remains downstream of the live roadmap unless that authority is explicitly changed.

### MCR0 — authority reconciliation and schema decision

Freeze the roles of `SemanticEmbodimentGraph`, `RepresentationGraph`, `SpatialEmbodimentPlan` and the external `RepresentationGenome` concept.

Required work:

- map duplicated fields and compatibility-only fields;
- define semantic-node -> representation-primitive -> spatial-element identity;
- decide whether the necessary public-format change fits V1 extension rules or requires `RepresentationGraph` / spatial-plan versioning;
- apply the RFC/ADR process before any material public-format or trust-boundary change;
- define maximum graph/node/edge/element bounds and fail-closed behavior.

**Exit:** one documented ownership map exists, the schema/version/RFC decision is explicit, and no layer can silently become a second analytical authority.

### MCR1 — semantic binding and composed graph validation

Extend the representation contract so every semantic primitive is bound to an admissible semantic object/evidence identity rather than a free-form visual label.

Add relation-specific validation for the composition relations actually admitted in the first slice. Prefer a small qualified grammar over a broad under-specified one.

**Exit:** malformed, dangling, evidence-incompatible, abstraction-illegal and unsupported compositions fail closed before spatial compilation.

### MCR2 — general semantic-to-spatial compiler

Implement one production compiler that consumes the validated semantic graph + representation graph and emits a bounded `SpatialEmbodimentPlan`.

Requirements:

- no analytical inference in TypeScript;
- one semantic node may produce several presentation elements when explicitly allowed;
- one representation may contain several semantic nodes;
- layout/geometry parameters cannot rewrite semantic/evidence identity;
- alternative spatial plans for the same semantic graph remain distinguishable phenotype choices rather than new analytical claims.

**Exit:** the same semantic graph can be compiled into at least two valid spatial phenotypes without changing dataset/decision/evidence identity.

### MCR3 — multi-element runtime and lifecycle

Replace the "exactly one renderable primitive" runtime restriction with explicit multi-element embodiment.

Reuse UXR2/UXR3 ownership, residency, admission, eviction, reconstruction and stale-generation controls.

**Exit:** at least two renderable elements can coexist, select independently, cool/evict/reconstruct independently, and preserve one stable composed representation identity without unbounded resource growth.

### MCR4 — composed interaction and detail semantics

Bind selection, comparison, filtering, drill-down and return-to-structure to semantic IDs rather than transient mesh indexes.

Reuse the existing semantic-detail authority and navigation lineage. Define how `OVERLAY`, `CONTAINS`, `DETAIL_OF`, `COORDINATES_WITH` and `COMPARES_WITH` affect focus/context and permissible investigator actions.

**Exit:** detail on one composed phenomenon neither destroys nor silently reinterprets its siblings, and returning to the composed overview restores the same semantic state.

### MCR5 — governed family composition qualification

Adapt the existing governed semantic families into the graph/compiler path without replacing their family-specific Rust/WASM builders.

Qualify at least one genuinely multi-phenomenon representation containing two or more independently governed semantic structures.

Required evidence:

- known-structure fixtures;
- information-preservation/loss checks;
- perturbation/stability evidence where applicable;
- production-browser evidence;
- resource/admission evidence;
- no raw-row dataset-level fallback;
- no topology/cluster/membership inference from spatial proximity.

**Exit:** a composed representation is production-reachable and scientifically no stronger than the evidence carried by its constituent semantic nodes.

### MCR6 — persistence, replay and inspectable alternatives

Persist/replay composed graph identity, semantic bindings, spatial phenotype identity, explicit limitations and alternative/reference compositions without depending on transient renderer resources.

**Exit:** a clean-room replay reconstructs the same validated composition or fails closed on ontology/evidence/version drift.

### MCR7 — synthesis handoff seam, not synthesis implementation

After MCR0-MCR6 are stable, define the minimal versioned adapter needed for a promoted laboratory `RepresentationGenome` to produce an ordinary candidate graph/plan.

The adapter must:

- reject mutation of analytical facts, dataset identity, evidence provenance or oracle truth;
- preserve genome/version/hash lineage as provenance only;
- subject the materialised graph to exactly the same validation/evidence gates as researcher-authored/reference graphs;
- permit `OUT_OF_GRAMMAR`, `ABSTAIN` and unsupported/refused outcomes.

**Exit:** the production architecture can consume a stable external genome encoding without embedding an evolutionary algorithm or duplicating the genome authority in Nemosyne.

## 6. Whole-workstream exit criteria

P1-MCR is complete only when all of the following are true:

1. A `RepresentationGraph` with two or more governed semantic phenomena is production-reachable.
2. Every embodied primitive binds to a valid semantic/evidence identity; unsupported bindings fail closed.
3. `SpatialEmbodimentPlan` is the authoritative presentation phenotype boundary; geometry cannot create analytical meaning.
4. Multi-element rendering no longer requires flattening to one legacy `MonetaSpec`.
5. Dataset-level composition cannot silently enter a whole-row presentation path.
6. At least one composed representation survives refine/collapse/evict/reconstruct without semantic or selection drift.
7. The same semantic representation can support multiple spatial phenotypes without changing the underlying claim set.
8. Fixed candidate decisions remain supported through the compatibility adapter during migration.
9. Persistence/replay either reconstructs the same composition under pinned ontology/evidence versions or refuses explicitly.
10. Evidence Protocol feasibility/admissibility gates run before representation utility/fitness ranking.
11. No evolutionary operator, population/search loop, or duplicate `RepresentationGenome` authority has been introduced into this workstream.
12. Focused production-path tests, applicable Rust/WASM/browser tests, `npm run docs:check`, required exact-head CI and the high-risk adversarial review required by `AGENTS.md` are green with no unresolved blocker.

## 7. First implementation slice after promotion

When the live roadmap promotes P1-MCR, start with **MCR0 only**.

Do not begin by teaching Moneta to search a larger space. First resolve the authority/schema relationship and add falsifiers for the current single-renderable-primitive boundary. The first useful architecture proof is a hand-authored/deterministic two-phenomenon `RepresentationGraph` that compiles into a bounded `SpatialEmbodimentPlan` and survives the production lifecycle.

Search can arrive after the road exists.
