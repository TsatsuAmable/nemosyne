# RFC 0002: Source-edge authority for Relationship Graph

**Status:** accepted / B1 contract implemented / production implementation deferred to B2-B4  
**Accepted by:** project-owner direction to proceed with current Stream B after #596  
**Implementation programme:** Stream B / P1-R2E in `docs/ROADMAP.md`  
**B1 branch:** `feat/stream-b-b1-relationship-graph-contract`

## Context

Nemosyne already has a `RELATIONSHIP_GRAPH` semantic candidate, `Dataset.edges`, graph-shaped dataset signatures and a Rust-backed force-directed layout. Those pieces do not yet form a truthful dataset-level graph representation.

Before this RFC, Moneta could admit the graph candidate from coarse `edgeCount > 0` or `topology === GRAPH` evidence, while the candidate description treated force-directed relaxation as if it were part of the scientific representation. The existing layout adapter also resolves endpoints through presentation-side row identity heuristics. That boundary allows source topology, inferred topology and presentation geometry to blur together.

Stream B therefore freezes graph authority before B2 adds a resident payload or B3 changes production rendering.

## Decision

For source-authoritative `RELATIONSHIP_GRAPH` V1:

1. **Authority is explicit and source-bound.** A representation request must carry `graphAuthority.kind === SOURCE_EDGES`. Dataset signature topology, edge counts, layout positions, visual proximity, correlation, k-nearest-neighbour relations, density, clusters or colour do not substitute for that authority.
2. **Edges come only from `Dataset.edges`.** B1 does not infer, repair or synthesize graph edges. A later inferred-graph treatment requires a separate governed method and treatment identity.
3. **Directionality is declared.** V1 requires the caller/source contract to state `DIRECTED` or `UNDIRECTED`; it is not guessed from edge shape or duplicated records.
4. **Every source row is a candidate node.** Isolated source rows remain nodes. Node identity is `DATASET_ROW`; B2 must bind this to canonical resident observation identity rather than presentation indexes.
5. **Endpoint syntax is exact.** Numeric endpoints are zero-based source-row positions. String endpoints are durable source row IDs. Empty/padded strings, negative/fractional/out-of-range numeric syntax and arbitrary endpoint objects are invalid.
6. **Missing endpoints fail closed.** V1 uses `missingEndpointPolicy = REFUSE`. An unresolved source endpoint may not be silently dropped because doing so changes source topology.
7. **Parallel edges and self-loops are preserved.** V1 does not deduplicate, collapse or delete them. If a later analytical treatment needs a simple graph, that transformation must be separately declared and attributable.
8. **Edge semantics are narrow.** Source `weight` is the only V1 analytical edge attribute. Other edge metadata may be retained for provenance later but cannot affect topology, ranking or analytical meaning without a new contract.
9. **The resource envelope is fixed before execution.** V1 allows at most 4,096 nodes, 16,384 edges and a 2 MiB semantic payload. Exceeding the node/edge envelope hard-disqualifies the candidate at arbitration; B2 must enforce all bounds again at the Rust/WASM authority before output growth.
10. **Topology and layout are separate objects.** `RELATIONSHIP_GRAPH` preserves source edge connectivity and node identity. A force-directed or other layout may position those nodes for presentation but cannot create, remove or reinterpret edges.
11. **The ontology does not claim cluster truth.** Source graph connectivity alone does not preserve `cluster-separation`; that claim is removed and becomes an explicit information loss for this candidate.
12. **Rank-effective semantics are versioned.** Bootstrap numeric weights remain frozen, while graph admissibility, structural scoring and information semantics advance to `bootstrap-fitness-v5` / `fitness-treatment-v5` and Moneta provenance `2.1.0-v5-bootstrap`.
13. **Compatibility ontology provenance advances.** The candidate information-loss and constraint surface changes the compatibility `RepresentationGraph` output, so `BOOTSTRAP_REPRESENTATION_ONTOLOGY_VERSION` advances to `bootstrap-ontology-v2` rather than emitting changed limitations under the old ontology identity.

## Options considered

### Treat any positive edge count as authority

Rejected. Edge count is a coarse structural fact, not a declaration of source meaning, directionality, endpoint identity or missing-endpoint policy.

### Treat `topology === GRAPH` as authority

Rejected. The signature classification does not prove where edges came from or whether they survive an exact source-topology contract.

### Reuse force-directed layout output as graph semantics

Rejected. Layout is a presentation transform over topology. Spatial proximity after force relaxation is not an authoritative edge and must never feed back into topology.

### Infer edges from correlation, k-NN or proximity

Rejected for V1. Each is an analytical method with feature/metric/scaling/hyperparameter/resource/stability choices. Such methods belong to a separate treatment, not a fallback.

### Source-provided edges with explicit policy

Accepted. This gives Nemosyne a truthful non-point structural object with a clean authority boundary and a finite B2/B3 path.

## Consequences

### Scientific

- `RELATIONSHIP_GRAPH` means “the source supplied this node/edge topology under the declared graph policy,” not “Nemosyne discovered relationships.”
- Visual clusters, spatial communities or layout separation cannot be promoted to scientific claims without a separately governed analysis.
- Edge direction, multiplicity and self-loops retain source meaning exactly in V1.

### Ranking and provenance

- A graph-shaped signature without `SOURCE_EDGES` authority cannot admit `RELATIONSHIP_GRAPH`.
- A `SOURCE_EDGES` declaration without actual source edges also cannot admit the candidate.
- The V5 treatment records the rank-effective authority and ontology change while preserving the numeric bootstrap weights.
- Compatibility `RepresentationGraph` provenance records `bootstrap-ontology-v2` for the narrowed graph limitations and constraints.

### Architecture

- `RepresentationRequirements.graphAuthority` is the serialized Moneta control-plane declaration.
- Moneta hard-disqualifies missing/invalid authority with `graph-authority-required` and V1 node/edge overflow with `graph-resource-envelope`.
- B2 will resolve source endpoints and stable semantic node/edge IDs at the canonical resident Rust dataset/graph authority, not in Three.js or force-layout code.
- B3 will carry a bounded graph payload through the existing generation/fingerprint/decision fences and intercept it before row/proximity-derived topology construction.
- Presentation layout remains replaceable without changing the graph payload or semantic IDs.

## B1 executable evidence

`tests/p1r-r2e-b1-relationship-graph-authority.test.ts` falsifies:

- policy widening and unknown authority fields;
- malformed endpoint syntax;
- unbounded node/edge/payload contracts;
- graph ontology overclaim;
- `GRAPH` topology or positive edge count substituting for explicit authority;
- explicit authority substituting for absent source edges;
- node/edge envelope overflow;
- silent reuse of the V4 treatment identity.

Existing R6B, Density Truth and R2D cluster tests are carried through V5 to prove the new graph treatment does not erase those reviewed semantics. B1 verifies the control-plane authority/admissibility contract only: endpoint resolution against the resident dataset, payload byte enforcement and production topology fidelity remain mandatory B2-B4 evidence rather than being inferred from this contract layer.

## Non-goals / future work

B1 does not implement the graph payload, endpoint resolution against resident data, stable graph semantic IDs, Worker/WASM transport, layout/render cutover, product evidence, Stream A member drill-down, graph centrality/community detection, k-NN/correlation graphs, or inferred relationships.

Those remain B2-B4. B4 must independently prove that source edges survive arbitrary presentation-layout changes unchanged before Relationship Graph V1 can be `VERIFIED COMPLETE`.
