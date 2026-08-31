# P1-R2D Cluster Regions

**Status:** RAILED / C1 SCIENTIFIC CONTRACT NEXT  
**Entry base:** `main@c9a089564284466d249d181e9408f5822f4ac196` (#584 merged)  
**Parent programme:** `P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` R2D  
**Entry condition:** P1-R2C Density Truth and P1-R6 representation-family clarification stop gates satisfied.  
**Purpose:** replace the current row/layout-derived cluster volume with one truthful, bounded, Rust-owned representation of an explicit authoritative partition, then stop before inferred clustering or inferred topology.

## Mission and finite exit

The first Cluster Regions slice answers a deliberately narrow question:

> Given an explicitly selected source-authoritative partition label and explicitly selected numeric spatial measures, can Nemosyne present bounded cluster summaries without inferring cluster science from layout positions, arbitrary categoricals, density shape, or Three.js geometry?

The target path is:

```text
explicit partition-analysis intent
  + explicit authoritative partition field
  + explicit numeric spatial measures
    -> Moneta CLUSTER_REGIONS decision
    -> resident Worker/WASM dataset capability
    -> Rust source-partition cluster summary
    -> bounded semantic payload
    -> thin cluster-specific Three.js adapter
    -> visibly distinct partition-region artifact
```

R2D stops after product/scale/perceptual evidence and independent review. It does not continue automatically into k-means, DBSCAN/HDBSCAN, learned clustering, inferred graph topology, manifold learning, or another representation family.

## Why this tranche is necessary

The current production cluster path is not authoritative cluster analysis.

`VRTopologyTranslator` still resolves source rows for `CLUSTER_VOLUME` and calls `ScalableTopologyEmbodiment.buildClusterVolume()`. That implementation:

- computes presentation positions first;
- silently chooses `encodings.color`, otherwise the first categorical column, otherwise a row field named `cluster`, otherwise a single fallback cluster;
- groups rows in TypeScript from that presentation-side choice;
- computes centers and radii from rendered positions;
- draws a sphere around each group.

The resulting sphere is therefore a presentation-space enclosure around an implicitly chosen grouping. It is not evidence that a scientific clustering method found a region, and its radius is not a support boundary.

The current `CLUSTER_REGIONS` ontology also permits the constraint “discrete cluster structure or multi-modal density” and claims `outlier-boundary-visibility` preservation. Those claims are too broad for the first governed source-partition payload and must be reconciled in C1 before ranking or production migration.

## V1 scientific authority decision

### Authoritative partition source

R2D V1 accepts only an **explicit source-authoritative partition field** selected by the investigation requirements/intent.

A field is authoritative for this slice only when the caller explicitly declares that its values are the partition to be represented. Merely being categorical, color-encoded, named `cluster`, correlated with another feature, or associated with multimodal density is insufficient.

V1 therefore permits:

- supplied experiment/cohort/segment/cluster labels whose partition semantics are declared by the investigator or source contract;
- externally computed cluster labels only when already materialized as an explicitly selected authoritative partition field and their external provenance is retained by the source/investigation record.

V1 does not itself validate the scientific quality of an externally produced clustering method. It truthfully represents the supplied partition.

### Explicitly excluded authority

V1 must refuse or remain unavailable rather than infer a partition from:

- arbitrary categorical fields;
- `encodings.color`;
- a conveniently named `cluster` property;
- Three.js/layout positions;
- density modes or valleys;
- nearest-neighbor proximity;
- force-directed positions;
- k-means, DBSCAN, HDBSCAN, spectral clustering, hierarchical clustering, Gaussian mixtures, or any other clustering algorithm not separately governed.

A later inferred-clustering programme must define method, metric, feature scaling, hyperparameters, determinism/random seed, approximation, missingness policy, uncertainty/stability evidence, provenance, resource envelope, and promotion criteria before its labels may become authoritative cluster evidence.

## V1 spatial summary semantics

The cluster payload is a **partition summary with bounded spatial descriptors**, not a reconstructed support set and not a discovered decision boundary.

Inputs are:

- one explicit authoritative `partitionField`;
- two or three explicit numeric `coordinateFields`;
- the selected `CLUSTER_REGIONS` decision/provenance identity.

For every retained partition value, Rust may compute:

- stable semantic cluster ID;
- scalar source partition value;
- total assigned member count;
- count of members with valid coordinates used by the spatial summary;
- arithmetic centroid in the explicit coordinate fields;
- axis-aligned per-coordinate minima/maxima for valid represented members.

The axis-aligned bounds are **descriptive envelopes only**. They do not claim convex support, density support, separation margin, confidence region, hull membership, classifier boundary, or absence of overlap.

The renderer may embody those descriptors as a bounded region, box, shell, glyph, centroid marker, or another truthful presentation treatment, but presentation geometry must not strengthen the analytical claim beyond the payload.

## Missingness, unassigned observations and partial geometry

V1 must distinguish at least:

- `sourceCount`: all source observations;
- `assignedCount`: observations with a valid declared partition value;
- `unassignedCount`: observations without a valid declared partition value;
- `coordinateValidCount`: assigned observations with valid values for every requested coordinate field;
- `coordinateExcludedCount`: assigned observations excluded from spatial summary because one or more requested coordinates are invalid/non-finite.

For each cluster, the payload records both assigned member count and coordinate-valid represented count.

A cluster with assigned members but zero coordinate-valid members must not receive fabricated centroid/bounds geometry. C1 must choose one fail-closed wire representation for that state, either an explicit cluster entry with unavailable spatial summary or a typed refusal when no cluster can be spatially represented. Silent deletion is forbidden.

## Information contract

C1 must reconcile `RepresentationCandidate.ts`, Rust `InformationTypeV1`, and the cluster payload before any ranking change is promoted.

For the planned V1 bounded summary:

**Preserved at representation level:**

- explicit partition separation between retained source-authoritative groups;
- cluster/group magnitude through member counts;
- source partition identity at the semantic-cluster level;
- provenance linking the summary to dataset, selected fields and Moneta decision.

**Not preserved by the bounded summary:**

- individual observation identity;
- exact per-observation metric values;
- continuous/population density semantics;
- empirical distribution shape within a cluster;
- formal outlier boundaries;
- true cluster support boundaries;
- uncertainty/stability of an inferred clustering method.

`outlier-boundary-visibility` must not remain a preservation claim merely because a sphere or box is drawn around a group.

If changing the candidate `supports` / `preserves` / `loses` contract changes bootstrap ranking, C1 must mint a new fitness model/treatment identity and prove the resulting rank effects rather than editing ontology in place.

## Hard resource bounds

C1 must set exact reviewed constants. The starting proposal is:

- maximum retained clusters: **256**;
- coordinate dimensions: exactly **2 or 3**;
- scalar partition values only;
- no observation-ID arrays or row fragments in the cluster semantic payload;
- output element count bounded by retained cluster count, independent of source N.

If source-authoritative partition cardinality exceeds the hard cluster bound, V1 must return `RESOURCE_LIMIT`. It must not silently merge rare clusters, sample labels, truncate clusters, collapse them into “other,” or rank-select a subset, because those operations change the supplied partition.

Any later bounded coarsening policy is a separate analytical treatment with explicit information loss.

## Stable identity and determinism

Cluster semantic IDs must be deterministic under row-order permutation and derived from canonical partition identity plus the payload/decision context, not from iteration order or renderer index.

C1/C2 falsifiers must prove:

- row-order invariance;
- scalar-type distinctions that matter to the source contract do not accidentally collide;
- duplicate semantic IDs fail closed;
- payload ordering is deterministic;
- source count reconciliation is exact;
- non-finite spatial values cannot create NaN/Infinity payload geometry;
- no raw rows or hidden row-shaped metadata cross the semantic envelope.

## Checkpoints

### C1 - scientific contract, ontology and falsifiers

**Model:** Frontier/xhigh implementation and independent review.

- record the pre-implementation adversarial review;
- define the exact Rust/TypeScript request and payload schema for source-authoritative partition summaries;
- choose the fail-closed representation for clusters with no valid spatial members;
- establish exact hard bounds and strict unknown-field rejection;
- define analytical method name/version and governed parameter schema;
- define the information-preservation/loss contract;
- reconcile `CLUSTER_REGIONS` candidate description, capabilities and constraints with the V1 object;
- quantify any rank-effective ontology changes and mint a new fitness treatment if required;
- add hand-calculable fixtures and malformed-payload/request falsifiers;
- mechanically prove C1 adds no production cluster capability yet.

**Exit:** the contract is deterministic, bounded, scientifically reviewable and fail-closed. `CLUSTER_REGIONS` remains non-production-migrated until C2/C3.

**Suggested PR:** `feat(moneta): define source partition cluster payload`

### C2 - resident-handle Rust/WASM builder

**Model:** Frontier/high or xhigh.

- compute partition counts, valid-coordinate counts, centroids and descriptive axis-aligned bounds from the canonical resident columnar dataset capability;
- carry handle + explicit field names/parameters across the boundary, never rows;
- apply cluster-cardinality/resource limits before output growth;
- preserve legitimate zero-valued coordinates;
- classify missing/non-finite partition/coordinate values exactly as C1 specifies;
- produce deterministic stable semantic IDs and ordering;
- prove reference fixtures, row-order invariance, missing/unassigned cases, mixed-validity clusters and >bound refusal in Rust;
- cross the real WASM boundary and validate the exact returned envelope.

**Exit:** real WASM returns the truthful bounded cluster summary from a resident dataset capability. TypeScript contains no cluster reduction.

**Suggested PR:** `feat(moneta): build Rust partition cluster summary`

### C3 - production cutover and thin embodiment

**Model:** Frontier/xhigh.

- extend semantic loader/Worker execution using the established generation/version/fingerprint/decision fencing;
- make `CLUSTER_REGIONS` consume only its governed semantic payload;
- intercept cluster embodiment before raw-row resolution in `VRTopologyTranslator` or its successor;
- remove the live `buildClusterVolume(rows, ...)` authority from the production cluster path;
- forbid arbitrary categorical/color/`cluster`-property fallback;
- keep pending/refused/invalid/stale/unavailable states visible without substituting points, spheres, density, chart geometry or the legacy row-derived cluster volume;
- bind selection/inspection metadata to stable semantic cluster IDs and analytical provenance;
- use a small cluster-specific presentation adapter rather than expanding `VRTopologyTranslator` or `ScalableTopologyEmbodiment` into another god class;
- promote `CLUSTER_REGIONS` to `DATASET_LEVEL_VALID` only after the raw-row throwing sentinel passes.

**Exit:** requirements -> Moneta decision -> Worker/WASM -> bounded cluster payload -> visible cluster artifact executes through the real production path with no source-row analytical fallback.

**Suggested PR:** `feat(moneta): render source partition cluster regions`

### C4 - product, scale and perceptual evidence

**Model:** Balanced/high for harness plumbing; Frontier/high for interpretation and fixes.

- add canonical product fixtures where explicit partition intent visibly produces bounded partition regions rather than point clusters or density geometry;
- exercise representative source scales while keeping semantic output bounded by cluster cardinality;
- record source N, assigned/unassigned/coordinate-excluded counts, cluster count, payload byte proxy, render primitives, draw calls, triangles and relevant Worker/request-to-ready timings;
- include pathological fixtures: one cluster, many clusters near bound, overlapping coordinate envelopes, missing partition labels, invalid coordinates, highly imbalanced cluster sizes;
- prove visible overlap is not described as separation margin or support boundary;
- bind screenshots/perceptual evidence to exact payload/artifact identity;
- retain physical Quest qualification as a separate evidence class unless actually measured on device.

**Exit:** the visible result is distinct, truthful, bounded and inspectable, with evidence claims no broader than the observed environment.

**Suggested PR:** `test(moneta): prove partition cluster product path`

### C5 - independent post-review and STOP

After C4 merges, conduct a fresh-main adversarial review across C1-C4.

The review must re-trace:

- scientific authority for the partition;
- ontology/ranking treatment;
- resident Rust ownership;
- raw-row fallback prohibition;
- missing/unassigned behavior;
- stable identity/provenance;
- source-N output bounds;
- presentation-boundary wording;
- evidence and workflow trigger coverage.

**Finite exit:** classify R2D as `VERIFIED COMPLETE` only for the evidence actually obtained, then stop. Do not start inferred clustering or R2E automatically.

## Falsifiers that must survive every checkpoint

1. Remove/throw every source-row getter on the production path. A migrated cluster representation must still render from its bounded payload.
2. Supply no explicit partition field. The system must not choose a categorical/color/`cluster` field by itself.
3. Supply multimodal density without an authoritative partition. `CLUSTER_REGIONS` must not become scientifically available merely because modes are visible.
4. Change arbitrary layout positions while keeping the authoritative partition fixed. Analytical cluster membership/counts must not change.
5. Provide >256 partition values under the proposed V1 bound. The builder must refuse rather than merge/truncate/sample.
6. Provide missing labels and invalid coordinates. Counts must reconcile and no observation may silently disappear from accounting.
7. Permute row order. Stable IDs, counts and payload ordering must remain deterministic.
8. Make two groups overlap strongly in the selected coordinates. The payload/renderer must not claim a separation margin or non-overlap boundary.
9. Attempt to smuggle rows, observation arrays or nested source fragments into the payload/method parameters. Strict validation must reject them.
10. Make production semantic output pending/refused/stale/invalid. No plausible substitute cluster sphere, point cloud, density field or chart may appear.

## Collision-sensitive files

Only one open implementation PR may change a given integration contract. R2D work is particularly collision-sensitive around:

- `src/app/dataset/LoadDatasetUseCase.ts`;
- `src/app/dataset/SemanticEmbodimentLoader.ts`;
- `src/moneta/MonetaTopologyNode.ts`;
- `src/moneta/VRTopologyTranslator.ts`;
- `src/moneta/representation/RepresentationCandidate.ts`;
- `src/moneta/representation/RepresentationFamily.ts`;
- `src/moneta/representation/SemanticEmbodimentPayload.ts`;
- `src/moneta/representation/BootstrapFitnessModel.ts`;
- `src/vr/presentation/representation/RepresentationSurface.ts`;
- `wasm/src/moneta/embodiment.rs` and the future cluster-specific Rust module;
- the analytical Worker/WASM bridge files used by aggregate/distribution/density.

Dependency-only PRs may proceed in parallel when they do not touch these contracts and exact-head rebasing keeps evidence attributable.

## Explicit non-goals

R2D V1 does not implement or claim:

- automatic cluster discovery;
- k-means, DBSCAN, HDBSCAN, Gaussian mixtures, spectral or hierarchical clustering;
- cluster validity indices as proof of scientific truth;
- confidence regions or statistical uncertainty around cluster boundaries;
- convex hulls as true support boundaries;
- density/KDE semantics;
- inferred k-NN/similarity/correlation graphs;
- manifold inference;
- observation-level drill-down for every cluster member;
- physical Quest performance without device evidence.

## Decision after R2D

After the stop gate, choose explicitly between:

1. **R2D-I inferred clustering**, only if cluster discovery is a priority. Begin with a separate scientific-method study/contract and do not reuse the source-partition treatment identity.
2. **R2E source-provided structural representations**, such as authoritative graph edges/hierarchy/temporal structures.
3. **R2E inferred topology**, only as a separately governed analytical-model programme.
4. **R5 progressive disclosure**, if the product need is now drilling from bounded structures to selected observations rather than adding another representation family.

No option begins automatically.
