# RFC 0001: Source-partition authority for Cluster Regions

**Status:** accepted  
**Accepted by:** project-owner direction to proceed with the railed P1-R2D plan after #585  
**Implementation programme:** `docs/roadmap/P1_R2D_CLUSTER_REGIONS.md`

## Context

`CLUSTER_REGIONS` currently sits on a scientifically ambiguous boundary. The legacy production path can choose a color field, the first categorical field, a conveniently named `cluster` property, or a fallback group and then derive sphere geometry from presentation positions. That makes a presentation-side grouping look like authoritative clustering evidence.

P1-R2D was railed in #585 to replace that behavior with a bounded representation of an explicitly supplied partition. The rail also identified two rank-effective ontology errors: the candidate allowed “multi-modal density” to stand in for cluster authority and claimed formal outlier-boundary visibility that a bounded group summary does not preserve.

The repository RFC policy requires an RFC when investigator-facing scientific semantics change. The #585 rail supplied the pre-implementation scientific design and falsifiers; this RFC records the durable decision in the required governance form before C1 is promoted.

## Decision requested

For the first governed `CLUSTER_REGIONS` treatment:

1. **Authority is explicit and source-bound.** A representation request must declare exactly one `SOURCE_PARTITION` field. For V1 that field must be a **logical categorical partition label** in the canonical dataset. Numeric-looking cluster codes are valid only when their dataset schema treats them as categorical labels; a continuous numeric measure is never promoted to a partition merely because it was named in a request. Merely being categorical, color-encoded, named `cluster`, correlated with other variables, or associated with multimodal density is not cluster authority.
2. **Spatial coordinates are explicit.** The request must declare exactly two or three distinct coordinate fields, separate from the partition field. The analytical builder must verify that the declared coordinate fields are numeric and must not substitute other columns.
3. **The object is a partition summary, not discovered clustering.** V1 represents supplied partition membership and bounded descriptive spatial summaries. It does not infer k-means, DBSCAN/HDBSCAN, mixture models, density modes, nearest-neighbour groups, force-layout groups, support boundaries, confidence regions, separation margins, or cluster validity.
4. **The candidate ontology is narrowed.** `CLUSTER_REGIONS` supports source partition structure and aggregate group magnitude. It does not preserve individual observation identity, exact per-observation values, continuous/population density, empirical bivariate bin mass, within-group empirical distribution shape, or formal outlier boundaries.
5. **Missing authority fails closed at arbitration.** `CLUSTER_REGIONS` is hard-disqualified when the source-partition declaration or the required coordinate declaration is absent or structurally incompatible. Cluster-like dataset evidence may affect other reasoning but cannot substitute for this authority declaration.
6. **Execution validates the declaration against the resident dataset.** Arbitration can establish that a declaration exists and that the dataset signature has sufficient categorical/numeric capacity, but only the Rust/WASM resident-dataset owner may prove the named partition field is categorical, the named coordinate fields are numeric, and compute the bounded summary.
7. **The V1 resource and missingness envelope is fixed.** At most **256 assigned partition groups** may be emitted. Crossing that bound returns `RESOURCE_LIMIT`; groups may not be merged, truncated, sampled, or silently dropped to fit. A row is spatially valid only when every requested coordinate in its 2D/3D tuple is valid and finite. Assigned rows failing that complete-case rule remain members of their source group but count toward `coordinateExcludedCount`. Each group records assigned and coordinate-valid counts. A group with no coordinate-valid members remains explicit with `spatialSummary: null`; if no assigned group has any coordinate-valid member, the request refuses with missing spatial evidence rather than fabricating layout geometry.
8. **The summary is bounded, not exact observation embodiment.** READY output uses `BOUNDED` approximation semantics. Its spatial `representedRowCount` is the complete-case `coordinateValidCount`, not the source row count. Partition/group counts are still exact for the retained source partition. Centroids and axis-aligned bounds are descriptive summaries over the same complete-case coordinate tuples, never support/confidence boundaries.
9. **Stable semantic identity follows source identity, not iteration order.** Region IDs must be derived deterministically from canonical partition-field identity and the exact canonical non-empty source partition label, using a domain-separated collision-resistant encoding or hash. Region-local IDs must **not** include `datasetFingerprint`: the canonical v1 dataset fingerprint intentionally commits to row order, so including it would make row-order-invariant region identity impossible. The dataset fingerprint remains the enclosing payload/provenance scope. This separation is deliberate: a region keeps its semantic identity when rows are permuted even though the enclosing dataset fingerprint may change. Adding a lexically earlier unrelated group must not renumber existing region IDs. Empty/missing canonical partition labels are unassigned and do not become a region. Non-empty labels are preserved as source identity rather than trimmed/rewritten into another label.
10. **Rank-effective semantics are versioned.** The bootstrap numeric weights remain frozen, but the ontology/admissibility change mints `bootstrap-fitness-v4` / `fitness-treatment-v4` so provenance can distinguish decisions made under the new scientific treatment.
11. **Inferred clustering is a separate future treatment.** Any learned or algorithmic clustering authority requires a separate RFC/treatment specifying metric, features, scaling, hyperparameters, randomness, missingness, uncertainty/stability, provenance, resource bounds, and validation evidence.

## Options considered

### A. Keep the implicit categorical/presentation grouping

Rejected. It is convenient but cannot distinguish analyst intent from presentation defaults and allows geometry to masquerade as scientific cluster evidence.

### B. Treat multimodal density or layout proximity as cluster authority

Rejected. Density modes, nearest-neighbour proximity, and layout positions are distinct analytical models. Promoting them implicitly would hide method choice, parameters, uncertainty, and approximation behind renderer behavior.

### C. Add an automatic clustering algorithm now

Rejected for V1. Choosing k-means, DBSCAN/HDBSCAN, spectral clustering, mixtures, or another method introduces measurement-scale, metric, hyperparameter, determinism, stability, performance, and post-selection questions that need their own governed treatment.

### D. Represent only an explicitly declared logical-categorical source partition

Accepted. It gives Nemosyne a truthful dataset-level cluster-shaped object without pretending to discover cluster science. Requiring a categorical logical type also prevents a continuous numeric measurement from becoming a partition merely through request wiring. Broader typed scalar-partition support can be added later as an explicit contract extension if needed.

## Consequences

### Scientific

- `CLUSTER_REGIONS` means “bounded summary of a declared categorical partition,” not “the data contains scientifically validated clusters.”
- Descriptive centroids/bounds may be presented, but renderer geometry must not imply support boundaries, non-overlap, density support, confidence regions, or separation margins.
- Source partition labels may originate outside Nemosyne, but their scientific quality remains external unless separately governed evidence is supplied.
- V1 deliberately rejects a partition field whose canonical logical type is numeric. Numeric identifiers must be ingested/declared as categorical labels before they can be source-partition authority.
- Missing coordinates do not erase partition membership. Membership counts and spatial-representation counts are separately auditable.

### Ranking and provenance

- Generic cluster-comparison requirements without `SOURCE_PARTITION` authority can no longer admit `CLUSTER_REGIONS`.
- Bootstrap weights are unchanged; model/treatment identity advances to v4 because admissibility and information scoring are rank-effective.
- Persisted decisions remain attributable to their recorded fitness model/treatment. Re-arbitration under v4 may intentionally differ from v3 when source-partition authority is absent.

### Architecture

- TypeScript carries explicit intent and performs structural admissibility only.
- Rust/WASM remains the sole analytical owner that validates named resident fields, applies complete-case coordinate accounting, enforces the 256-group bound, and computes scale-sensitive partition summaries.
- Three.js receives bounded semantic payloads and must not group raw rows, infer cluster membership from presentation positions, or invent positions for unavailable spatial summaries.

### Compatibility

- `clusterAuthority` is an optional discriminated field on the serialisable requirements contract so non-cluster tasks and historical requirement shapes remain parseable.
- Its absence is meaningful under v4: `CLUSTER_REGIONS` is unavailable rather than silently reconstructing the old implicit behavior.
- The V1 categorical-only authority rule is intentionally narrower than the rail's general scalar-value possibility. It is a C1 schema decision, not a claim that numeric-coded partitions are scientifically invalid.
- The 256-group ceiling is a V1 product/resource contract, not a scientific statement about how many clusters a dataset can contain.

### Delivery split

- C1 establishes authority, ontology, exact request/payload semantics and falsifiers.
- C2 builds the resident Rust/WASM source-partition summary.
- C3 cuts production rendering over to the bounded payload and removes row/layout-derived cluster authority.
- Parallel implementation may combine physical commits, but promotion claims must remain attributable to these scientific checkpoints.

## Verification plan

C1 must prove:

- v4 treatment/model identity is recorded;
- `CLUSTER_REGIONS` no longer claims density or outlier-boundary semantics;
- measured cluster-like or density evidence cannot admit the candidate without `SOURCE_PARTITION` authority;
- malformed authority/coordinate declarations fail closed;
- a valid explicit authority declaration can admit the candidate only when the dataset signature has compatible categorical/numeric capacity;
- C2/C3 implement the frozen 256-group, complete-case, `BOUNDED`, null-spatial-summary and stable-ID contract rather than choosing their own semantics.

C2/C3 must additionally prove:

- the exact named partition and coordinate fields are validated in Rust against the resident canonical dataset;
- the partition field is logical categorical and each coordinate field is numeric;
- no arbitrary categorical/color/`cluster` fallback exists;
- output is bounded to 256 groups independently of source N and over-bound partitions refuse rather than merge/truncate/sample;
- `sourceCount = assignedCount + unassignedCount` and `assignedCount = coordinateValidCount + coordinateExcludedCount` reconcile exactly, with the same invariant per group where applicable;
- centroid and axis-aligned bounds use the same complete-case coordinate rows;
- clusters with no valid spatial members remain explicit with `spatialSummary: null`; an all-spatially-invalid partition refuses;
- READY approximation is `BOUNDED` and `representedRowCount = coordinateValidCount`;
- semantic IDs are derived from canonical partition-field identity plus exact non-empty source label, are row-order invariant even though dataset fingerprints are row-order-sensitive, and are unaffected by unrelated group insertion;
- empty/missing partition labels are unassigned rather than serialized as a cluster;
- raw rows/observation arrays do not cross the semantic payload;
- pending/refused/stale/invalid semantic output cannot fall back to legacy cluster spheres or points.

## Resulting ADR

Pending completion and independent verification of the R2D C1-C3 authority/production boundary. The final ADR should record the implemented Rust/WASM ownership and production cutover once those paths are verified, rather than freezing an implementation detail before evidence exists.
