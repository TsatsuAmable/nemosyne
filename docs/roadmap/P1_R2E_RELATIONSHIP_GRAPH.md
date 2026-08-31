# P1-R2E Relationship Graph — Stream B first structural slice

**Status:** B1 IMPLEMENTATION LANDED ON BRANCH / REVIEW ACTIVE  
**Stream:** B — Source-Authoritative Structural Representations  
**Scientific authority:** `docs/rfcs/0002-source-relationship-graph-authority.md`  
**Integration base at start:** `main@1d597e157ed70bb75e15caa4ade1f1e47348249b` (#597 merged)

## Mission

Make source-provided graph topology a truthful first-class dataset representation without allowing layout, proximity or TypeScript heuristics to become a second topology authority.

Target path:

```text
Dataset.edges + explicit SOURCE_EDGES policy
  -> Moneta B1 admissibility
  -> resident Rust/WASM B2 graph payload
  -> fenced Worker transport
  -> B3 thin graph adapter + presentation-only layout
  -> B4 product/scale/perceptual evidence
  -> independent STOP
```

## Governing invariant

> A production `RELATIONSHIP_GRAPH` edge exists because the source-authoritative graph payload says it exists. Three.js, force layout, spatial proximity, correlation, k-NN, clustering and visual appearance may not create, remove or reinterpret topology.

## B1 — scientific / authority contract

**Status:** IMPLEMENTATION LANDED ON BRANCH / REVIEW ACTIVE

Required:

- [x] explicit serialized `SOURCE_EDGES` authority;
- [x] declared `DIRECTED | UNDIRECTED` semantics;
- [x] exact numeric-position / durable-row-ID endpoint vocabulary;
- [x] `REFUSE` missing-endpoint policy;
- [x] preserve parallel edges and self-loops;
- [x] narrow V1 analytical edge attributes to source weight;
- [x] hard 4,096-node / 16,384-edge / 2 MiB envelope;
- [x] hard-disqualify graph without explicit authority;
- [x] hard-disqualify explicit authority when source edge count is zero;
- [x] remove `cluster-separation` preservation overclaim;
- [x] separate source topology semantics from force-directed presentation wording;
- [x] mint `bootstrap-fitness-v5` / `fitness-treatment-v5` and Moneta v5 provenance;
- [x] executable Moneta-path falsifiers;
- [ ] exact-head CI / CodeQL / architecture / approval / Q8/Q9 as applicable;
- [ ] post-implementation adversarial review;
- [ ] promotion from draft after every blocker is closed.

**B1 exit:** one deterministic, bounded, scientifically reviewable contract exists and adds no B2 production graph payload yet.

## B2 — resident Rust/WASM graph payload

**Status:** BLOCKED ON B1 PROMOTION

Required design/execution:

- consume canonical resident source rows/row IDs plus source edges;
- resolve numeric endpoints as source-row positions and strings only against durable resident row IDs;
- refuse any unresolved endpoint before returning READY;
- retain isolated nodes, directionality, parallel edges and self-loops exactly;
- define deterministic semantic node and edge IDs independent of presentation layout;
- decide edge-ID identity for exact duplicate parallel edges without collapsing multiplicity;
- preserve source weight where finite/allowed and make missing/non-finite weight policy explicit;
- apply node/edge/payload bounds before output growth;
- emit explicit source/retained/refused counts and resource envelope;
- keep payload ordering deterministic;
- prove real-WASM parity and no raw-row graph payload transfer.

**B2 adversarial question:** can row order, duplicate edges, string/numeric endpoint mixtures or endpoint churn change semantic identity unexpectedly? Resolve before promotion.

## B3 — production cutover + thin graph adapter

**Status:** BLOCKED ON B2; generic drill-down integration may also wait for Stream A

- transport governed graph payload through existing dataset-generation, fingerprint and decision fences;
- intercept `RELATIONSHIP_GRAPH` before any row/proximity-derived topology path;
- remove live production reliance on `LayoutBase.rowId()` heuristics for graph authority;
- make force-directed coordinates a presentation transform over immutable semantic node/edge IDs;
- prove changing layout seed/algorithm/coordinates cannot alter edge identity or adjacency;
- bind node/edge interactions to stable semantic IDs;
- fail closed for pending/refused/invalid/stale payloads;
- consume Stream A's generic semantic detail/selection contract when available rather than inventing graph-specific drill-down APIs.

## B4 — product, scale, perceptual evidence + independent STOP

Evidence matrix must include:

- directed and undirected graphs;
- isolated nodes;
- parallel edges;
- self-loops;
- mixed valid numeric/string endpoint forms where supported by resident identity;
- missing endpoint refusal;
- near-bound node/edge fixtures;
- layout-seed/algorithm changes with invariant topology;
- source graph absent despite graph-like positions/proximity;
- stale/fingerprint/decision fencing;
- bounded transfer/render behavior.

Required claims:

- exact source adjacency survives full product path unchanged;
- no invented edge appears without source authority;
- layout changes do not mutate topology;
- resource growth is bounded by the B1/B2 envelope;
- interaction targets retain semantic graph identity;
- product screenshots/perceptual evidence do not imply cluster/community truth that the payload does not provide.

**Finite exit:** Relationship Graph V1 becomes `VERIFIED COMPLETE` for the reviewed source-edge scope, then Stream B STOPS. Hierarchy does not begin automatically; the next structural family requires an explicit fresh-main selection.

## Deferred treatments

Not part of this slice:

- k-NN graphs;
- correlation/association graphs;
- learned graph construction;
- community detection or graph clustering;
- centrality as a ranking/visual authority;
- inferred missing edges;
- simple-graph normalization that collapses parallel edges/self-loops;
- P2 compositional RepresentationGraph search.

Each inferred analytical graph treatment requires its own method, feature/metric/scaling choices, hyperparameters, stability/uncertainty, resource bounds, provenance and validation evidence.
