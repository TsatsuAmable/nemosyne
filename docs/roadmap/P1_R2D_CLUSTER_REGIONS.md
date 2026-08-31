# P1-R2D Cluster Regions

**Status:** VERIFIED COMPLETE - SOURCE-PARTITION V1 / STOP GATE SATISFIED  
**Entry base:** `main@c9a089564284466d249d181e9408f5822f4ac196` (#584 merged)  
**Verified fresh-main base:** `main@5eb9b7617d4d657569ccb0bdf5fbb374b3405d1f` (#595 merged)  
**Parent programme:** `P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` R2D  
**Independent STOP review:** `docs/review/P1_R2D_C5_STOP_REVIEW_2026-08-31.md`  
**Scientific decision:** `docs/rfcs/0001-source-partition-cluster-authority.md`

## Finite outcome

P1-R2D has completed its deliberately narrow V1 mission:

> Given an explicitly selected source-authoritative partition label and explicitly selected numeric spatial measures, Nemosyne can present bounded cluster summaries without inferring cluster science from layout positions, arbitrary categoricals, density shape, or Three.js geometry.

The verified production path is:

```text
explicit partition-analysis intent
  + explicit SOURCE_PARTITION authority
  + exactly 2 or 3 explicit numeric coordinate fields
    -> Moneta CLUSTER_REGIONS decision under fitness-treatment-v4
    -> resident Worker/WASM dataset capability
    -> Rust source-partition summary
    -> bounded provenance-bearing semantic payload
    -> guarded row-free semantic dispatch
    -> thin cluster-specific Three.js adapter
    -> descriptive partition-region artifact
```

R2D stops here. This completion does not start k-means, DBSCAN/HDBSCAN, learned clustering, inferred graph topology, manifold learning, R2E, or another representation family.

## Checkpoint record

| Checkpoint | Scope | Promotion evidence | Status |
| --- | --- | --- | --- |
| **C1** | source authority, ontology, ranking treatment and falsifiers | #587 | **MERGED / VERIFIED IN C5** |
| **C2** | resident Rust/WASM source-partition builder | #590 | **MERGED / VERIFIED IN C5** |
| **C3** | production Worker/payload/renderer cutover | #592 | **MERGED / VERIFIED IN C5** |
| **C4** | product, scale and perceptual browser evidence | #594 | **MERGED / VERIFIED IN C5** |
| **C5** | independent fresh-main STOP review and evidence-trigger fix-forward | #595 + C5 review | **STOP GATE SATISFIED** |

## V1 scientific authority

### Source-bound authority only

`CLUSTER_REGIONS` is available only when investigation requirements explicitly declare:

- `clusterAuthority: { kind: 'SOURCE_PARTITION', field }`;
- exactly two or three distinct coordinate fields;
- a partition field distinct from those coordinates.

The partition field must be logical categorical in the canonical resident dataset. Numeric-looking group codes are valid only when the dataset schema treats them as categorical labels.

The following are explicitly not cluster authority:

- arbitrary categorical columns;
- `encodings.color`;
- a conveniently named `cluster` property;
- multimodal density;
- nearest-neighbour proximity;
- Three.js or layout positions;
- force-directed geometry;
- an ungoverned clustering algorithm.

V1 therefore represents a supplied partition. It does not discover clusters and does not validate the scientific quality of externally produced labels.

## V1 analytical object

The Rust/WASM builder owns the scale-sensitive analytical reduction from the resident canonical dataset.

For every retained non-empty source partition label it produces:

- a deterministic source-derived semantic region ID;
- exact preserved source partition identity;
- assigned member count;
- coordinate-valid count;
- coordinate-excluded count;
- an arithmetic centroid over complete-case finite coordinate tuples when available;
- descriptive axis-aligned per-coordinate minima/maxima when available.

Global accounting records:

- `sourceCount`;
- `assignedCount`;
- `unassignedCount`;
- `coordinateValidCount`;
- `coordinateExcludedCount`.

The required reconciliations are:

```text
sourceCount = assignedCount + unassignedCount
assignedCount = coordinateValidCount + coordinateExcludedCount
```

with corresponding per-region reconciliation.

A group with assigned members but zero valid coordinate tuples remains explicit with `spatialSummary: null`. If no assigned group is spatially representable, the request refuses rather than fabricating layout geometry.

READY output is `BOUNDED`. Spatial `representedRowCount` equals `coordinateValidCount`; the object is not an observation embodiment.

## Information contract

### Preserved

- declared source partition structure;
- exact retained group magnitude through member counts;
- source partition identity at semantic-region level;
- provenance binding dataset, selected fields, analytical method and Moneta decision;
- bounded descriptive centroid/min/max summaries for spatially representable groups.

### Explicitly not preserved or claimed

- individual observation identity;
- exact per-observation values;
- continuous/population density;
- empirical within-group distribution shape;
- formal outlier boundaries;
- convex/support boundaries;
- confidence regions;
- separation margins;
- inferred-cluster validity or stability.

The representation may make source groups visually distinct, but visual separation is not a scientific statement that groups are non-overlapping or well separated.

## Hard resource and identity envelope

V1 enforces:

- maximum **256 assigned groups**;
- maximum **65,536 UTF-8 bytes** across retained exact source labels;
- exactly **2 or 3** coordinate dimensions;
- no observation-ID arrays or row fragments in the semantic request/payload;
- semantic output count bounded by retained group cardinality rather than source N.

Crossing a resource ceiling returns `RESOURCE_LIMIT`. V1 does not merge, truncate, sample, rank-select or collapse groups into an `other` bucket.

The exact dataset fingerprint identifies the artifact/provenance envelope and remains row-order-sensitive. Region-local semantic IDs intentionally do not hash that fingerprint. They derive from the governed semantic schema/candidate, partition-field identity and exact source label, making region identity deterministic under row permutation and unaffected by insertion of unrelated lexically earlier groups.

## Production boundary

The production request carries field names, authority and decision provenance only. Rust validates the named resident field types and computes the summary.

`VRTopologyTranslator` takes the scientific row-free path only when `CLUSTER_VOLUME` carries explicit `semanticEmbodimentCandidateId === 'CLUSTER_REGIONS'`. Generic `CLUSTER_VOLUME` therefore remains a presentation primitive rather than silently becoming scientific cluster authority.

The governed cluster adapter consumes only the semantic payload. It creates centroid markers and descriptive axis-aligned min/max wireframes, records `supportBoundaryClaim: false`, retains null-spatial regions in semantic metadata, and creates no fabricated position for them.

Pending, refused, invalid, stale or unavailable governed output fails closed. It cannot substitute a legacy cluster sphere, point cloud, density field or chart.

Interaction semantics distinguish provenance-bearing `cluster-region` targets from presentation-only `presentation-cluster` geometry.

## C4 measured evidence

The retained exact-head desktop-browser evidence included:

| Source rows | Semantic regions | Payload JSON proxy | Rust kernel | Request to READY | Candidate-local draw calls |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 8 | 4,377 B | 6.835 ms | 140.400 ms | 2 |
| 8,000 | 8 | 4,354 B | 21.500 ms | 210.540 ms | 2 |
| 32,000 | 8 | 4,404 B | 82.760 ms | 734.190 ms | 2 |

Pathological fixtures covered one group, 240 groups near the 256 ceiling, strong descriptive-envelope overlap, missing partition labels, invalid coordinates and large group-size imbalance.

This evidence establishes bounded semantic/render output in the measured browser scope. The approximately 734 ms 32k request-to-READY observation is recorded rather than called real-time. Physical Quest performance and comfort remain unqualified.

## C5 independent STOP result

Fresh-main C5 re-traced scientific authority, v4 rank treatment, resident Rust ownership, row-free production dispatch, missingness, stable identity/provenance, source-N bounds, presentation semantics and evidence coverage.

All ten governing falsifiers passed in reviewed scope.

C5 found one blocker, RF-C5-001: the dedicated C4 browser evidence workflow did not trigger for several files owning R2D scientific/production semantics. #595 expanded the path trigger set across the reviewed C1-C3 authority/ranking/transport/Rust/presentation seams and added a mechanical trigger-coverage regression test.

On #595 exact head `f696003edcb841a23a72641522d30e160ecbb177`:

- the repaired C4 browser workflow triggered automatically and passed;
- ordinary CI / Node 24 passed;
- CodeQL passed;
- Q8 passed;
- approval-gate passed;
- Q9 passed.

#595 then merged as `5eb9b7617d4d657569ccb0bdf5fbb374b3405d1f`. Fresh-main closure found no scientific/runtime movement beyond the reviewed evidence-governance fix.

## Residuals and non-goals

R2D V1 does not implement or claim:

- automatic cluster discovery;
- k-means, DBSCAN, HDBSCAN, Gaussian mixtures, spectral or hierarchical clustering;
- cluster validity indices as proof of scientific truth;
- confidence regions or statistical uncertainty around cluster boundaries;
- convex hulls as true support boundaries;
- density/KDE semantics;
- inferred k-NN/similarity/correlation graphs;
- manifold inference;
- observation-level progressive drill-down for every group member;
- physical Quest performance without device evidence;
- full P1-UV visual convergence.

The wider semantic-representation lifecycle around generic incremental `appendRows()` remains worth separate review, but no production R2D V1 cluster reachability was established through the currently time-series-specific incremental live-stream path.

## STOP and next-choice boundary

**P1-R2D source-partition Cluster Regions V1 is VERIFIED COMPLETE. Stop.**

Any next programme must be selected explicitly:

1. **R2D-I inferred clustering**, only after a separate scientific-method contract covering metric, features, scaling, hyperparameters, randomness, missingness, uncertainty/stability, provenance and resource bounds;
2. **R2E source-provided structural representations**, such as authoritative graph edges, hierarchy or temporal structure;
3. **R2E inferred topology**, only as a separately governed analytical-model programme;
4. **R5 progressive disclosure**, to let investigators drill from truthful bounded dataset structures into selected observation subsets and exact provenance.

No option begins automatically.
