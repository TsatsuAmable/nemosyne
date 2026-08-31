# P1-R2D Cluster Regions pre-implementation adversarial review - 31 August 2026

**Reviewed base:** `main@c9a089564284466d249d181e9408f5822f4ac196` (#584 merged)  
**Disposition:** R2D MAY ENTER C1 ONLY / PRODUCTION CLUSTER MIGRATION NOT YET AUTHORIZED

## Reviewed question

What is the smallest scientifically honest Cluster Regions vertical slice that can replace the existing row/layout-derived `CLUSTER_VOLUME` path without introducing a hidden clustering algorithm or turning presentation geometry into analytical evidence?

## Current production path

`VRTopologyTranslator.synthesizeArtifact()` already intercepts aggregate, distribution and density semantic embodiments before resolving source rows. `CLUSTER_VOLUME` is still in the legacy branch. For cluster geometry it resolves `dataset.rows` / `dataInput.rows` and calls `ScalableTopologyEmbodiment.buildClusterVolume()`.

`buildClusterVolume()` then:

1. computes presentation layout positions from rows;
2. chooses the grouping field from `encodings.color`, otherwise the first categorical column, otherwise a row property named `cluster`, otherwise a single fallback cluster;
3. groups rows in TypeScript;
4. computes a center and maximum radius from the presentation positions;
5. draws one translucent sphere per group.

Therefore the current visible object is a presentation-space enclosure around an implicitly chosen grouping. It is not a governed cluster-analysis result and the sphere radius is not a scientific support boundary.

## Material findings

### R2D-F1 HIGH - cluster authority is implicit and presentation-owned

The current implementation silently selects a grouping source. A categorical encoding or convenient field name can become “cluster” authority without an explicit analytical intent or source contract.

**Required C1 invariant:** no explicit authoritative partition field means no source-partition Cluster Regions capability.

### R2D-F2 HIGH - geometry can manufacture cluster meaning

The current sphere is calculated from layout positions after the layout algorithm has transformed the data. Changing layout can therefore change center/radius even though the source partition is unchanged.

**Required C1/C3 invariant:** analytical partition membership/counts are Rust-owned and invariant to presentation layout. Any renderer enclosure is explicitly descriptive presentation geometry.

### R2D-F3 HIGH - candidate ontology overclaims V1 boundary semantics

`CLUSTER_REGIONS` currently preserves `outlier-boundary-visibility` and accepts “discrete cluster structure or multi-modal density.” A bounded partition summary with centroid/descriptive bounds cannot establish formal outlier boundaries, and multimodal density does not itself supply authoritative partition labels.

**Required C1 invariant:** reconcile the candidate information contract before production migration. Any rank-effective change requires an explicit fitness model/treatment version change and rank-effect falsifiers.

### R2D-F4 HIGH - arbitrary categoricals can be laundered as discovered clusters

Current fallback to the first categorical column conflates grouping with clustering. A cohort, country, experimental arm, product class or arbitrary color field may be a useful source partition, but it is not automatically evidence that a clustering method discovered natural clusters.

**Required C1 wording:** V1 truthfully represents an explicitly declared source-authoritative partition. It does not claim discovery unless a separately governed clustering method produced and provenance-bound the labels.

### R2D-F5 MEDIUM-HIGH - missing/unassigned observations are not a first-class contract

The row-derived implementation groups through a fallback key and therefore has no governed distinction between assigned partition members, missing labels and coordinate-invalid observations.

**Required C1 payload accounting:** source, assigned, unassigned, coordinate-valid and coordinate-excluded counts must reconcile exactly. Silent reassignment to a default cluster is forbidden.

### R2D-F6 MEDIUM-HIGH - cluster cardinality is not contract-bounded

The current renderer creates one sphere/material/mesh per observed group. A high-cardinality partition can therefore increase output/render objects with group count and has no reviewed refusal threshold.

**Required C1 bound:** define a hard maximum cluster count before C2 allocation/output. The initial proposal is 256 clusters, with refusal rather than truncation/merging/sampling.

### R2D-F7 MEDIUM - stable semantic cluster identity is absent

Current `userData.cluster` is the grouping key and mesh order follows map iteration. There is no governed stable semantic ID bound to dataset/partition/method/decision provenance.

**Required C1/C2 invariant:** stable semantic IDs and deterministic payload ordering survive row-order permutation and remain independent of renderer index.

## Chosen first vertical slice

The review rejects automatic clustering as the first R2D slice. The lowest-risk useful authority is:

**Explicit source-authoritative partition labels + explicit 2D/3D numeric coordinate fields -> Rust-owned bounded partition summary.**

The planned summary contains cluster semantic ID, scalar partition value, assigned member count, coordinate-valid member count, arithmetic centroid and descriptive axis-aligned min/max bounds. These bounds are not scientific support boundaries.

This slice is useful because it removes the current false authority while testing the full semantic-payload architecture. It is also falsifiable with hand-calculable fixtures.

## Rejected alternatives for V1

- **Infer clusters from density modes:** rejected because modal structure does not define a unique partition and would couple R2D to a new clustering method.
- **K-means as a default:** rejected because metric, scaling, k selection, initialization/randomness and stability immediately become scientific method choices.
- **DBSCAN/HDBSCAN as a default:** rejected because metric/scaling, epsilon/min-samples or hierarchy/selection policy and noise semantics require a separately governed method contract.
- **Convex hull per supplied group:** rejected for V1 because a hull can visually imply support/shape not justified by sparse or non-convex members and increases geometry/resource complexity.
- **Keep renderer spheres but mark them approximate:** rejected because TypeScript would remain the analytical grouping/summary authority and source-row dependency would persist.

## C1 questions that must be answered before code promotion

1. Exact wire representation for a cluster whose partition has members but zero coordinate-valid members.
2. Exact scalar partition-value canonicalization and stable-ID derivation.
3. Exact hard cluster bound and whether 256 fits current resource/interaction budgets.
4. Exact analytical method name/version and strict method-parameter schema.
5. Exact candidate `supports` / `preserves` / `loses` correction and its effect on bootstrap ranking.
6. Whether a new information type is needed for source-partition identity or whether existing `cluster-separation` + `aggregate-group-magnitude` is sufficiently precise.
7. Exact refusal behavior for invalid coordinate field count/type and excessive partition cardinality.

## Stop conditions

C1 must stop rather than expand scope if it discovers that:

- source-partition semantics cannot be represented without adding a new durable information type;
- candidate ontology correction materially changes ranking without a versioned treatment plan;
- the generic semantic envelope cannot express partial/unavailable per-cluster spatial summaries without ambiguity;
- a proposed resource bound conflicts with the product/device envelope;
- source labels cannot be consumed from the resident dataset capability without row transfer.

Any such finding becomes explicit fix-forward or a revised C1 contract. It is not permission to implement an inferred clustering algorithm.

## Recommendation

Proceed with the finite C1 scientific-contract PR described in `docs/roadmap/P1_R2D_CLUSTER_REGIONS.md`. Do not touch the production cluster renderer/Worker path until C1 has exact-head tests and independent review.
