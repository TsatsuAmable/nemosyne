# Moneta Dataset-First Semantic Embodiment Audit

**Date:** 2026-09-18  
**Baseline:** `b22559c22d9cc0d41cb99468c512d4d3baecbf5d`  
**Design target:** `docs/architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md`

## Executive finding

The dataset-first architecture is **partially implemented and materially real**, not merely aspirational. Rust/WASM-owned bounded embodiments exist for aggregate, distribution, density, cluster and relationship-graph families, and semantic drill-down is designed to fail closed against resident Worker/WASM authority.

However, the implementation still contains a second, older representation path in which Moneta candidate IDs map to conventional row-derived layouts. `VRTopologyTranslator` explicitly falls back to `dataset.rows` / `dataInput.rows` whenever a governed semantic branch does not intercept the request. The candidate ontology therefore mixes semantic strategies with observation/layout strategies. This is the architectural leak behind the concern that Moneta can still become a sophisticated point renderer.

The missing general mechanism is a **composable, recursive semantic embodiment graph/compiler**. Current semantic embodiments are family-specific envelopes selected one at a time. Evolution currently selects/ranks fixed candidates; it does not generate or recombine semantic-world structures.

## Classification

| Mechanism / invariant | Status | Evidence / consequence |
|---|---|---|
| Rust/WASM owns analytical embodiment construction | **IMPLEMENTED for 5 families** | `SemanticEmbodimentBridge` invokes Rust builders for aggregate, distribution, density, cluster and graph against resident dataset handles. |
| Dataset-level semantic candidates exist | **IMPLEMENTED** | Candidate ontology includes density, distribution, clusters, aggregates, hierarchy, graph, manifold, spatial and multiscale concepts. |
| Production governed semantic presentation | **PARTIAL** | Aggregate/distribution/density/cluster/graph have dedicated bounded payload/presentation paths. |
| Geometry subordinate to semantic authority | **PARTIAL / CONTRADICTED BY FALLBACK** | Governed branches consume bounded payloads, but unmatched cases assign `rows = dataset?.rows ?? dataInput.rows` and use conventional layouts. |
| Dataset-first default | **PARTIAL** | Semantic branches are production reachable, but row-derived candidates remain production reachable. |
| Candidate ontology cleanly separates semantics from rendering | **CONTRADICTED** | `POINT_SET` and `MATRIX_FIELD` are observation-level; several dataset-named candidates map directly to grid/radial/force/spectral/time layouts. |
| General semantic embodiment graph | **MISSING** | Bridge retains family-specific requests keyed by family/decision; no general recursive semantic-world graph was found. |
| Multiple semantic phenomena composed in one world | **MISSING / NOT ESTABLISHED** | Current translator chooses branch behavior around a single spec/candidate; no evidence of a governed composition grammar. |
| Recursive dataset -> region -> subset -> observation drill-down | **PARTIAL** | `SemanticDetailTransition` explicitly queries resident Worker/WASM and fails closed rather than rematerialising source rows; family-specific detail requests exist. General recursive hierarchy is not established. |
| Stable dataset/decision-bound detail identity | **IMPLEMENTED in current semantic detail path** | Detail targets bind dataset fingerprint, decision ID and semantic ID; stale generation/refusal checks exist. |
| Presentation resources independent of analytical authority | **PARTIAL / STRONG DIRECTION** | Semantic payloads and UXR lifecycle work separate authority from Three.js resources; full Worker/WASM lifecycle closure remains outside this audit. |
| Fixed representation search | **IMPLEMENTED** | `LearnedMonetaRuntime` consumes `MONETA_REPRESENTATION_CANDIDATES`; canonical hypothesis engine ranks candidates and records decision/rejected alternatives. |
| Evolutionary generation/recombination of representations | **MISSING** | No evidence found of candidate genome mutation, recombination or semantic composition generation. |
| Compute-conditioned semantic search depth | **MISSING / NOT ESTABLISHED** | Candidate scale metadata exists, but no governed mechanism found where compute budget expands semantic hierarchy/search/evidence depth. |
| Information preservation/loss ontology | **IMPLEMENTED declaratively** | Candidate records declare `preserves` and `loses`; authority of all values requires separate empirical validation. |
| Draco as separate spatial compiler | **LEGACY/PARTIAL** | `solveDraco` remains in runtime/topology code and tests, but no current clean Draco = semantic-to-spatial compiler boundary was established. |
| Multiscale/manifold semantics | **DECLARED / historically overclaimed** | Existing representation inventory explicitly classified `MANIFOLD_EMBEDDING` and `MULTISCALE_FIELD` as semantically overclaimed because governed payloads did not reach renderer. |
| Relationship graph dataset semantics | **IMPROVED since earlier inventory** | Current governed graph path intercepts raw rows/edges and reuses Rust/Atlas identity when semantic marker/payload is present. |
| Density dataset semantics | **IMPLEMENTED bounded embodiment** | Rust-owned binned density becomes one instanced semantic surface plus non-rendering interaction proxies; bins, not rows, are rendered. |

## Key implementation observations

### 1. The semantic authority layer is real

`src/wasm/runtime/SemanticEmbodimentBridge.ts` is a meaningful boundary. Requests contain parameters/provenance and invoke Rust against a canonical dataset handle. It retains authoritative requests only for READY envelopes and checks dataset/decision identity for semantic detail.

This is substantially aligned with the design target.

### 2. The translator contains the architectural fault line

`src/moneta/VRTopologyTranslator.ts` has explicit governed branches for aggregate bars, distribution field, density field, cluster regions and relationship graph. Those branches avoid raw-row rendering.

The `else` branch then does:

```ts
rows = dataset?.rows ?? dataInput.rows ?? [];
```

and dispatches into point cloud, grid, force-directed, radial, streamline, time-ribbon, geo-surface or spectral-volume presentation.

That fallback is legitimate only for an explicit observation-level semantic target or a proven semantic compiler primitive. It is currently too broad to guarantee dataset-first behavior.

### 3. The ontology mixes abstraction levels

`RepresentationCandidate.ts` calls all candidates semantic representations, but the set contains both dataset phenomena and observation renderings. `POINT_SET` explicitly preserves individual observation identity; `MATRIX_FIELD` is mapped to the POINT family. Earlier repository inventory tests already recognized this distinction and classified some candidates as observation-level or semantically overclaimed.

The solution should not be to delete point representations. It should make **semantic abstraction level explicit** and constrain when observation-level candidates are admissible.

### 4. Semantic detail is a strong foundation

`SemanticDetailTransition` documents and enforces an important invariant: detail is queried from the exact resident Worker/WASM dataset, and missing residency fails closed rather than serializing/rematerializing source rows. The request machinery reconstructs family-specific analytical authority and binds detail to dataset fingerprint, decision and semantic identity.

This can become the traversal mechanism for a richer recursive semantic graph.

### 5. Evolution has not yet arrived at representation construction

The learned runtime and hypothesis engine operate over the fixed candidate inventory. Rejected alternatives and pinned model/artifact identity are useful evolutionary provenance primitives, but there is no representation genome or semantic composition operator yet.

Therefore the next compute staircase must not claim to measure evolutionary semantic capacity until this mechanism exists.

## Architectural delta

### P0: make abstraction level explicit

Add an authority-bearing distinction such as:

- `DATASET`
- `REGION`
- `SUBSTRUCTURE`
- `OBSERVATION_SET`
- `OBSERVATION`

to semantic representation contracts. Default Moneta decisions target `DATASET`. Observation-level candidates require explicit semantic-detail transition or investigation intent.

### P0: close accidental raw-row fallback

Refactor `VRTopologyTranslator` so a dataset-level decision cannot silently enter the raw-row branch. Fail closed when a promised governed semantic embodiment is unavailable/invalid. Preserve raw-row paths only behind explicit observation-level authority.

### P1: introduce SemanticEmbodimentGraph V1

Define a bounded, versioned, Rust-authoritative graph/envelope with:

- stable semantic object IDs;
- parent/child/refinement relations;
- semantic object kind;
- dataset fingerprint + decision provenance;
- evidence references;
- information preservation/loss contract;
- bounded presentation hints, not analytical conclusions;
- allowed detail transitions;
- resource estimates.

Family-specific payloads can initially become leaf/node payloads rather than being replaced wholesale.

### P1: separate semantic grammar from spatial grammar

Create a compiler boundary:

```
SemanticEmbodimentGraph
  -> SpatialEmbodimentPlan
  -> Three.js/XR artifact
```

Grid, force-directed, spectral, radial, surfaces, particles, instancing, etc. belong in `SpatialEmbodimentPlan`. They must not identify the analytical semantic family by themselves.

Evaluate whether useful `solveDraco` compatibility machinery should be absorbed/renamed here; do not revive Draco merely for nomenclature.

### P1: make semantic composition possible

Allow a dataset world to contain several simultaneous governed phenomena, e.g. a population field plus anomalous region plus temporal relationship, rather than forcing one candidate to stand for the whole dataset.

### P2: evolutionary semantic genome

Only after the graph/compiler contract is stable, define mutation/recombination over semantic composition and spatial realization. Keep analytical transformations behind Rust/WASM authority. Preserve lineage and rejected alternatives.

### P2: compute-conditioned capability policy

Treat compute as a budget controlling candidate population, evidence depth, perturbation depth, semantic hierarchy depth and spatial fidelity independently. Pre-register invariants so larger compute cannot purchase unsupported claims.

## Falsifiers to add

1. A DATASET-level decision can never reach `dataset.rows` presentation without an explicit authorized transition.
2. Missing/refused governed embodiment cannot fall back to a point cloud.
3. Observation-level detail round-trip preserves dataset/decision/semantic identity.
4. Cooling/evicting geometry leaves semantic graph truth intact.
5. Two or more semantic phenomena can coexist without duplicating analytical authority.
6. Higher compute may add semantic nodes only when their evidence contracts are satisfied.
7. Evolutionary mutation cannot mutate analytical truth/provenance.
8. A richer spatial phenotype with identical semantic information is recorded as rendering fidelity, not additional discovered meaning.
9. Known-structure corpora verify that coarse and rich embodiments preserve preregistered dataset truths.
10. Semantically overclaimed candidates such as manifold/multiscale remain inadmissible until governed analytical payloads exist.

## Recommended execution order

1. Land this design/audit as documentation and roadmap evidence.
2. Add abstraction-level contract + raw-row fallback falsifier.
3. Implement fail-closed translator boundary.
4. Specify SemanticEmbodimentGraph V1 without changing analytical algorithms.
5. Adapt the five existing governed families into the graph.
6. Add composition and recursive semantic-detail traversal.
7. Introduce SpatialEmbodimentPlan compiler boundary.
8. Reclassify legacy layouts as spatial primitives or explicit observation-level representations.
9. Add evolutionary genome/operators.
10. Resume representation-search compute staircase using semantic capability frontier metrics.

The existing UXR3 lifecycle and non-representation staircase work can continue in parallel. Architecture promotion and evolutionary representation claims should wait for the corresponding evidence.
