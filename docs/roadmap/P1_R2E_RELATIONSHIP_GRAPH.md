# P1-R2E Relationship Graph — Stream B first structural slice

**Status:** B1 MERGED VIA #607 (`main@84a4b77`) — B2 IMPLEMENTED + INDEPENDENTLY REVIEWED, PENDING EXACT-HEAD GATES + MERGE  
**Stream:** B — Source-Authoritative Structural Representations  
**Scientific authority:** `docs/rfcs/0002-source-relationship-graph-authority.md`  
**B1 closure review:** `review/P1_R2E_B1_POST_REVIEW_2026-08-31.md`  
**B2 closure review:** `review/P1_R2E_B2_POST_REVIEW_2026-08-31.md`  
**Integration base at start:** `main@1d597e157ed70bb75e15caa4ade1f1e47348249b` (#597 merged)  
**B1 promotion review base:** `main@1ea2920` (#606 merged); promotion finalized on #607's unchanged exact head passing all required gates and merging as `main@84a4b77`

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

**Status:** VERIFIED COMPLETE — MERGED VIA #607 (`main@84a4b77`); ALL EXACT-HEAD GATES GREEN ON THE MERGED HEAD

Required:

- [x] explicit serialized `SOURCE_EDGES` authority;
- [x] declared `DIRECTED | UNDIRECTED` semantics;
- [x] exact numeric-position / durable-row-ID endpoint vocabulary;
- [x] `REFUSE` missing-endpoint policy;
- [x] preserve parallel edges and self-loops;
- [x] narrow V1 analytical edge attributes to source weight;
- [x] hard 4,096-node / 16,384-edge / 2 MiB envelope (node/edge bounds enforced at arbitration; the 2 MiB payload bound is declared vocabulary until B2 enforces it at the Rust/WASM authority);
- [x] hard-disqualify graph without explicit authority;
- [x] hard-disqualify explicit authority when source edge count is zero;
- [x] remove `cluster-separation` preservation overclaim;
- [x] separate source topology semantics from force-directed presentation wording;
- [x] mint `bootstrap-fitness-v5` / `fitness-treatment-v5` and Moneta v5 provenance;
- [x] advance compatibility ontology provenance to `bootstrap-ontology-v2` because candidate limitations changed;
- [x] executable Moneta-path falsifiers;
- [x] #607 exact-head CI / CodeQL / architecture / approval / Q8/Q9 all green on one unchanged final head;
- [x] post-implementation adversarial review closure with no remaining B1 blocker;
- [x] merge #607 after every blocker and gate is closed (merged as `main@84a4b77`).

**B1 exit:** one deterministic, bounded, scientifically reviewable admission contract exists and adds no B2 production graph payload yet.

## B2 — resident Rust/WASM graph payload

**Status:** IMPLEMENTED ON `stream-b/b2-graph-payload` (BASE `main@84a4b77`) — INDEPENDENT ADVERSARIAL REVIEW CLOSED (no BLOCKER/MAJOR; four MINOR findings fixed forward on this branch, see `review/P1_R2E_B2_POST_REVIEW_2026-08-31.md`) — PENDING EXACT-HEAD GATES + MERGE

Required design/execution:

- [x] consume canonical resident source rows/row IDs plus source edges;
- [x] resolve numeric endpoints as source-row positions and strings only against durable resident row IDs;
- [x] refuse any unresolved endpoint before returning READY (whole-payload `MISSING_EVIDENCE` refusal; out-of-range numeric endpoints additionally fail closed at the resident dataset-construction boundary);
- [x] retain isolated nodes, directionality, parallel edges and self-loops exactly;
- [x] define deterministic semantic node and edge IDs independent of presentation layout (SHA-256 over schema/candidate/identity preimages; canonical node order = durable row IDs ascending);
- [x] decide edge-ID identity for exact duplicate parallel edges without collapsing multiplicity (occurrence counter in the ID preimage);
- [x] preserve source weight where finite/allowed and make missing/non-finite weight policy explicit (missing weight stays absent; non-finite weight refuses the payload);
- [x] apply node/edge/payload bounds before output growth;
- [x] emit explicit source/retained/refused counts and resource envelope;
- [x] keep payload ordering deterministic (endpoints, then exact weight bit pattern, then source position);
- [x] prove real-WASM parity and no raw-row graph payload transfer (`tests/p1r-r2e-b2-graph-payload-wasm.test.ts`, real WASM + real Worker).

B2 additionally owns the residual B1 review obligations:

- [x] enforce all three B1 bounds (node/edge/**payload-bytes**) at the Rust/WASM authority, not only in vocabulary helpers;
- [x] preserve the strict `validateSourceRelationshipGraphAuthority` semantics when graph authority is wired into a real production execution surface; do not introduce a weaker parallel parser (`loadGraphSemanticEmbodiment` validates through the shared strict validator, and the strict Rust mirror with `deny_unknown_fields` fails to parse widened vocabulary at the ABI boundary);
- [x] (partial — completed half) extend #607's source-binding evidence through the actual analytical Worker/resident Rust execution path: the real-Worker test registers a `Dataset` with durable row IDs and mixed numeric/string endpoints and binds the emitted node identities to those rows, so endpoint identity cannot diverge from the registered source after transport. The remaining `Dataset -> buildDatasetSignature -> arbitrate -> AtlasCore` half is deferred to B3 (see below), where the production cutover makes that path live;
- [x] add a named production-path falsifier proving no correlation, k-NN, visual proximity or layout fallback can create an edge ("proximity, correlation and k-NN can never invent graph edges").

**Measured envelope interaction (designed property, not a defect):** the 2 MiB payload-byte bound binds before the 16,384-edge bound for identity-rich graphs — 16,384 full semantic edge entries serialize at ≈2.18 MiB and are `RESOURCE_LIMIT`-refused on the byte bound. Both bounds are enforced independently and fail closed; the reachable edge ceiling under the byte bound is therefore lower than the declared edge envelope for realistic payloads. Recorded in the `MAX_RELATIONSHIP_GRAPH_PAYLOAD_BYTES_V1` doc comment and pinned by the byte-bound refusal tests.

**Evidence-workflow scope note:** following the R2D C2 resident-builder precedent, B2 adds no dedicated browser evidence workflow; B2 evidence is real-WASM + real-Worker tests running in the CI lanes, and the B4 evidence matrix owns product/browser evidence for the graph family.

**B2 adversarial question:** can row order, duplicate edges, string/numeric endpoint mixtures or endpoint churn change semantic identity unexpectedly? Resolve before promotion. Answered by the row-order/edge-order permutation-invariance tests (byte-identical payload across reordered registrations), the duplicate-parallel-edge ID distinctness tests and the tamper validator; independent review must still confirm.

## B3 — production cutover + thin graph adapter

**Status:** BLOCKED ON B2

- transport governed graph payload through existing dataset-generation, fingerprint and decision fences;
- intercept `RELATIONSHIP_GRAPH` before any row/proximity-derived topology path;
- remove live production reliance on `LayoutBase.rowId()` heuristics for graph authority;
- make force-directed coordinates a presentation transform over immutable semantic node/edge IDs;
- prove changing layout seed/algorithm/coordinates cannot alter edge identity or adjacency;
- bind node/edge interactions to stable semantic IDs;
- fail closed for pending/refused/invalid/stale payloads;
- consume Stream A's generic semantic detail/selection contract rather than inventing graph-specific drill-down APIs;
- close the B2-deferred arbitration-binding extension: once the cutover wires `LoadDatasetUseCase`/`AtlasCore`, extend the source-binding fixture through `Dataset -> buildDatasetSignature -> arbitrate` so endpoint identity and source topology provably cannot diverge after arbitration.

B3 additionally owns B1-RF-03: the pre-existing silent edge-drop paths (`src/moneta/layouts/ForceDirected3D.ts`, `src/moneta/embodiment/TopologyLayoutEmbodiment.ts`, `src/data/Dataset.ts` `remapEdgesAfterPrefixEviction`) contradict the declared `missingEndpointPolicy: 'REFUSE'` and must either fail closed or be provably unreachable for governed graph payloads; B3/B4 falsifiers must cover them.

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
