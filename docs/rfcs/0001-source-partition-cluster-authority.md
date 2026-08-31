# RFC 0001: Source-partition authority for Cluster Regions

**Status:** accepted / implemented / independently verified  
**Accepted by:** project-owner direction to proceed with the railed P1-R2D plan after #585  
**Implementation programme:** `docs/roadmap/P1_R2D_CLUSTER_REGIONS.md`  
**Independent verification:** `docs/review/P1_R2D_C5_STOP_REVIEW_2026-08-31.md`

## Context

Before P1-R2D, the production cluster path could choose a color field, the first categorical field, a conveniently named `cluster` property or a fallback group, then derive sphere geometry from presentation positions. That made presentation-side grouping look like authoritative clustering evidence.

The first governed `CLUSTER_REGIONS` treatment therefore needed an explicit scientific authority contract before any dataset-level cluster-shaped object could be promoted.

## Decision

For `CLUSTER_REGIONS` source-partition V1:

1. **Authority is explicit and source-bound.** A representation request must declare exactly one `SOURCE_PARTITION` field. The field must be logical categorical in the canonical resident dataset. Merely being categorical, color-encoded, named `cluster`, correlated with other variables or associated with multimodal density is not cluster authority.
2. **Spatial coordinates are explicit.** The request declares exactly two or three distinct coordinate fields, separate from the partition field. Rust validates that each is numeric and performs no field substitution.
3. **The object is a partition summary, not discovered clustering.** V1 represents supplied membership and bounded descriptive spatial summaries. It does not infer k-means, DBSCAN/HDBSCAN, mixture models, density modes, nearest-neighbour groups, force-layout groups, support boundaries, confidence regions, separation margins or cluster validity.
4. **The ontology is narrow.** `CLUSTER_REGIONS` supports source partition structure and aggregate group magnitude. It does not preserve individual observation identity, exact per-observation values, continuous/population density, empirical within-group distribution shape or formal outlier boundaries.
5. **Missing authority fails closed at arbitration.** `CLUSTER_REGIONS` is hard-disqualified when source-partition authority or the required coordinate declaration is absent or structurally incompatible. Cluster-like evidence cannot substitute.
6. **Resident Rust/WASM owns execution.** TypeScript carries explicit intent and performs structural admissibility only. Rust/WASM validates named resident fields, applies complete-case coordinate accounting, enforces bounds and computes summaries.
7. **The V1 resource envelope is fixed.** At most 256 assigned groups may be emitted, with at most 65,536 UTF-8 bytes across retained exact source labels. Exceeding a ceiling returns `RESOURCE_LIMIT`; groups are never merged, truncated, sampled or silently dropped to fit.
8. **Missingness is explicit.** `sourceCount = assignedCount + unassignedCount`, and `assignedCount = coordinateValidCount + coordinateExcludedCount`. Assigned rows with incomplete/non-finite coordinate tuples remain members but are excluded from the spatial summary. A group with no valid spatial members remains explicit with `spatialSummary: null`; an entirely nonspatial partition refuses.
9. **The spatial summary is bounded and descriptive.** READY output uses `BOUNDED` approximation semantics. Spatial `representedRowCount` equals complete-case `coordinateValidCount`. Centroids and axis-aligned minima/maxima describe the represented coordinate tuples and are never support/confidence/separation boundaries.
10. **Artifact and region-local identity are distinct.** The envelope `datasetFingerprint` binds the exact canonical dataset artifact and remains row-order-sensitive. Region-local semantic IDs are deterministic from governed semantic identity, partition-field identity and exact source label, so they survive row permutation and unrelated-group insertion.
11. **Rank-effective semantics are versioned.** Bootstrap numeric weights remain frozen, while the authority/admissibility and information-contract change is recorded as `bootstrap-fitness-v4` / `fitness-treatment-v4`.
12. **Inferred clustering is a different future treatment.** Any learned or algorithmic clustering authority requires a separate contract covering metric, features, scaling, hyperparameters, randomness, missingness, uncertainty/stability, provenance, resource bounds and validation evidence.

## Options considered

### Keep implicit categorical/presentation grouping

Rejected. It cannot distinguish investigator/source authority from presentation defaults and permits geometry to masquerade as scientific cluster evidence.

### Treat multimodal density or layout proximity as cluster authority

Rejected. Density modes, nearest-neighbour proximity and layout positions are different analytical models whose method choices and uncertainty cannot be hidden behind renderer behavior.

### Add an automatic clustering algorithm in V1

Rejected. Automatic clustering introduces measurement-scale, metric, hyperparameter, randomness, stability, resource and post-selection questions that require their own governed treatment.

### Represent only an explicitly declared logical-categorical source partition

Accepted. It gives Nemosyne a truthful dataset-level group-region object without pretending to discover cluster science.

## Consequences

### Scientific

- `CLUSTER_REGIONS` means “bounded summary of a declared categorical partition,” not “the data contains scientifically validated clusters.”
- Descriptive centroid/bounds geometry cannot imply support, confidence, density, separation margin or non-overlap.
- Source labels may originate outside Nemosyne, but their scientific quality remains external unless separately governed.
- Numeric identifiers must be ingested/declared as categorical labels before they can serve as V1 source-partition authority.
- Missing coordinates do not erase partition membership; membership and spatial-representation counts remain separately auditable.

### Ranking and provenance

- Generic cluster-comparison requirements without `SOURCE_PARTITION` authority cannot admit `CLUSTER_REGIONS`.
- Model/treatment identity advances to v4 even though bootstrap numeric weights are unchanged, because admissibility and information preservation are rank-effective.
- Exact artifact identity uses the canonical dataset fingerprint; region-local semantic identity is stable independently of row order.

### Architecture

- Rust/WASM is the sole analytical owner for the V1 summary.
- The production request carries explicit authority, field names and provenance, never source rows as analytical input.
- Three.js consumes the bounded payload and may not infer membership from raw rows or presentation positions.
- `VRTopologyTranslator` enters the governed row-free path only when the cluster geometry is paired with explicit `semanticEmbodimentCandidateId === 'CLUSTER_REGIONS'` authority. Generic `CLUSTER_VOLUME` remains presentation geometry.
- Pending/refused/invalid/stale/unavailable governed output fails closed without point, density, chart or legacy cluster substitution.

## Implemented evidence

### C1 — #587

Established explicit source authority, exact 2D/3D declaration rules, narrowed candidate ontology, typed hard disqualification and `bootstrap-fitness-v4` / `fitness-treatment-v4`.

### C2 — #590

Implemented the resident Rust/WASM builder with complete-case accounting, 256-group and label-byte resource ceilings, deterministic source-derived region IDs, row-order-independent centroid reduction, null-spatial groups and strict READY-envelope validation.

### C3 — #592

Cut production over to the fenced Worker/WASM semantic payload and thin cluster adapter before raw-row resolution. Governed unavailable states fail closed and the adapter explicitly records descriptive-only presentation semantics with `supportBoundaryClaim: false`.

### C4 — #594

Added exact-head desktop-browser product, scale and perceptual evidence. Balanced 1k/8k/32k fixtures retained eight semantic regions and two candidate-local draw calls while payload size stayed approximately constant. The 32k request-to-READY observation was approximately 734 ms and remains a recorded desktop limitation rather than a real-time or Quest claim. Pathological fixtures covered one group, 240 groups, overlap, missing labels, invalid coordinates and strong imbalance.

### C5 — #595 and independent STOP review

Fresh-main review re-traced the scientific and production boundary and all ten governing falsifiers. It found one evidence-governance blocker: the dedicated browser evidence did not trigger for every authority-critical file. #595 expanded the path filter across the reviewed C1-C3 seams and added a mechanical trigger-coverage test.

On #595 exact head `f696003edcb841a23a72641522d30e160ecbb177`, the repaired C4 browser evidence workflow triggered automatically and passed, alongside ordinary CI / Node 24, CodeQL, Q8, approval-gate and Q9. #595 merged as `5eb9b7617d4d657569ccb0bdf5fbb374b3405d1f`; fresh-main closure found no scientific/runtime movement beyond that reviewed governance fix.

## Resulting architecture decision

The source-partition V1 authority and production boundary are now implemented and independently verified:

```text
explicit SOURCE_PARTITION authority
  + exactly 2 or 3 explicit numeric coordinate fields
    -> Moneta admissibility under fitness-treatment-v4
    -> resident Rust/WASM validation and bounded summary
    -> provenance-bearing CLUSTER_REGIONS semantic envelope
    -> guarded row-free production dispatch
    -> descriptive cluster-region adapter
```

This is the durable V1 architecture decision. It may be changed only through a new governed semantic treatment or a new RFC/ADR when the change affects authority, scientific meaning, public payload semantics, resource policy or trust boundaries.

Inferred clustering remains explicitly outside this decision and must not reuse the V1 source-partition treatment identity.
