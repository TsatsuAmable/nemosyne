# P1-R2E B4 Relationship Graph STOP Review — 1 September 2026

**Scope:** Stream B / P1-R2E Relationship Graph V1, B4 product/scale/perceptual evidence and finite STOP  
**Base:** `main@76b298bfe961e2592d7849bf43931021b37df005` (#611 merged)  
**Candidate branch:** `stream-b/b4-graph-evidence-stop`  
**Scientific authority:** `docs/rfcs/0002-source-relationship-graph-authority.md`  
**Programme:** `docs/roadmap/P1_R2E_RELATIONSHIP_GRAPH.md`

## Current disposition

**IMPLEMENTATION LANDED / REVIEW ACTIVE — STOP NOT YET AUTHORIZED.**

B4 adds an explicitly flagged browser evidence driver and exact-head workflow. It does not add a new graph authority and does not run on ordinary product startup. The evidence driver supplies deterministic synthetic source fixtures only, then records the real `World -> Moneta arbitration -> Worker -> Rust/WASM -> GraphSemanticEmbodiment -> scene` path.

Promotion to `VERIFIED COMPLETE / STOP` is permitted only after the final unchanged PR head has all ordinary required gates green and the dedicated `P1-R2E B4 relationship graph browser evidence` workflow succeeds with source-head, checkout-head, production-bundle and WASM identities pinned to the same candidate head.

## Adversarial implementation contract

The B4 evidence must falsify, not merely illustrate, the following failure modes:

- source adjacency changes between the resident Rust payload and the rendered interaction surface;
- layout seed changes alter semantic edge identity or adjacency;
- graph-like coordinates or perfectly correlated columns cause an edge to appear without source edges;
- missing source endpoints are partially dropped or repaired instead of refusing the governed payload;
- isolated nodes, parallel edges or self-loops disappear at presentation;
- semantic interaction targets lose node/edge identity;
- source mutation or prefix eviction leaves stale governed topology visible;
- near-bound graphs grow unbounded transfer or candidate-local draw calls;
- screenshots or perceptual evidence imply community, cluster, support-boundary or confidence truth absent from the source payload;
- the evidence workflow can silently stop running when a governed graph authority/product seam changes.

## Implemented evidence matrix

The dedicated browser probe covers:

- directed source graphs;
- undirected source graphs;
- mixed numeric-position and durable-row-ID source endpoints;
- isolated nodes;
- exact duplicate parallel edges;
- self-loops;
- a 4,000-node / >5,000-edge near-bound fixture under the 4,096-node / 16,384-edge / 2 MiB V1 envelope;
- two force-layout seeds over the same payload, requiring changed positions and invariant semantic topology;
- an unresolved durable-row-ID endpoint, requiring whole-payload `MISSING_EVIDENCE` refusal and no graph surfaces;
- graph-like near-coincident coordinates and perfectly correlated columns with zero source edges, requiring Moneta to reject `RELATIONSHIP_GRAPH` despite explicit graph authority;
- source mutation with bounded prefix eviction, requiring recorded dropped-edge evidence, `PENDING` presentation, and no stale graph surface;
- exact decision/fingerprint/artifact identity reconciliation;
- real Worker execution diagnostics, payload-byte proxy, whole-scene counters and the graph adapter's constant two candidate-local draw calls;
- measured perceptual evidence bound to the exact artifact, with `communityClaim: false` and `supportBoundaryClaim: false` recorded alongside screenshots.

## Known boundary retained from B3

`Dataset.evictedEdgeCount` remains intentionally out-of-band from `DatasetJSON`: inserting it into `toJSON()` would change the TypeScript fingerprint material while the current Rust parser drops unknown fields, breaking the cross-language fingerprint contract. B4 therefore proves the live in-memory eviction fence only. Any future persistence path for a previously evicted governed graph must preserve or recompute eviction evidence out-of-band before such a dataset may be admitted as source-authoritative.

This is not a blocker for Relationship Graph V1 today because no live dataset-persistence path serializes and later re-admits that mutable `Dataset` state. It becomes a blocker for any future feature that introduces such persistence without closing the evidence gap.

## STOP conditions

Relationship Graph V1 may become `VERIFIED COMPLETE` only when all of the following are true on one unchanged exact head:

1. ordinary CI, CodeQL, architecture policy, Q8, approval and Q9 are green;
2. the B4 exact-head browser evidence workflow is green;
3. the evidence report pins source head == checkout head and records production bundle + WASM SHA-256 identities;
4. all READY scenarios preserve exact source-authoritative topology through the product adapter;
5. no-source and unresolved-endpoint falsifiers fail closed;
6. stale/eviction evidence removes old topology rather than degrading silently;
7. perceptual/screenshot evidence carries no cluster/community/support-boundary claim;
8. no BLOCKER or MAJOR finding remains after post-implementation adversarial review.

Until those conditions are met this record remains **IMPLEMENTATION LANDED / REVIEW ACTIVE** and does not authorize Stream B STOP.

## Finite boundary after STOP

A successful B4 closes only source-authoritative Relationship Graph V1. It does not authorize k-NN, correlation graphs, learned edge construction, community detection, centrality authority, inferred missing edges, simple-graph normalization, hierarchy, temporal structures, or another structural family. Stream B must stop after Relationship Graph V1; a next structural family requires an explicit fresh-main selection.
