# P1-R2D C3 post-implementation adversarial review

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE  
**Base:** `main@ba58f0a373bf677caa9af3d1d03c0d2e3fdbbb6d` (#590 merged)  
**Reviewed implementation snapshot:** `584c0d2c1ff909edcc634992400aec5af46c89a6`  
**Governing RFC:** `docs/rfcs/0001-source-partition-cluster-authority.md`  
**Scope:** production Worker/semantic-loader/renderer cutover for governed source-partition `CLUSTER_REGIONS`

## Disposition

C3 is promotable only under the **semantic-only cluster-volume boundary** described by the R2D rail and RFC: production `CLUSTER_VOLUME` embodiment is reserved for the governed `CLUSTER_REGIONS` candidate and must be intercepted before source-row resolution. Missing, pending, refused, invalid or stale semantic evidence fails closed. Presentation code may not infer membership from rows, color encodings, arbitrary categoricals, a property named `cluster`, or layout positions.

The reviewed implementation snapshot satisfies that production dispatch shape. Exact-head CI/CodeQL/approval/Q8/Q9 still have to prove the isolated branch before merge.

## Findings found during review

### 1. Legacy row-derived cluster compatibility was a real blocker

The initial C3 branch retained a compatibility call to `ScalableTopologyEmbodiment.buildClusterVolume(rows, ...)`. That helper derives membership from presentation-side fields, computes centers/radii from layout positions, and labels the resulting spheres `representationKind: 'CLUSTER_REGIONS'`.

That path directly contradicts R2D authority. It was removed from live `VRTopologyTranslator` dispatch in the reviewed snapshot. The helper may remain dead code temporarily, but C3 promotion requires that no production `CLUSTER_VOLUME` branch can reach it.

### 2. Legacy tests encoded the obsolete scientific behavior

Several tests expected ungoverned high-cardinality categoricals or accidental solver `CLUSTER_VOLUME` winners to produce row-derived cluster spheres. Those expectations were not valid compatibility guarantees after C3.

Fix-forward separates concerns:

- cluster-specific tests assert that source rows and categorical/color fallbacks cannot create governed cluster geometry;
- generic analyst-journey tests explicitly choose a row-backed non-cluster presentation;
- hierarchy layout tests explicitly use hierarchy-native geometry rather than depending on a solver tie that happens to choose `CLUSTER_VOLUME`.

This preserves the behavior those tests actually own without reopening scientific authority in presentation code.

### 3. Parallel branch work attempted to reframe `CLUSTER_VOLUME` as a generic legacy primitive

A concurrent implementation proposed keeping unmarked `CLUSTER_VOLUME` row-backed while using a marker for governed `CLUSTER_REGIONS`. That would only be scientifically safe if the legacy primitive had a distinct representation identity and could not surface as `CLUSTER_REGIONS`.

The existing legacy helper still stamps its artifacts `representationKind: 'CLUSTER_REGIONS'`. Therefore retaining it under the same geometry name would preserve exactly the semantic ambiguity R2D is intended to eliminate. That compatibility interpretation is rejected for C3. A future generic enclosure primitive, if useful, must receive a distinct name/metadata contract and separate review.

### 4. C3 does not duplicate Rust analytical ownership

The semantic loader transports the explicit source partition field, explicit 2D/3D coordinate fields and Moneta provenance. The analytical Worker calls the resident C2 Rust/WASM builder. TypeScript does not regroup rows or recompute centroids/bounds for the governed representation.

### 5. Presentation remains bounded and descriptive

The thin cluster adapter consumes the bounded C2 region payload, batches visible centroid and wireframe-envelope surfaces, and creates O(region-count) semantic interaction proxies. `spatialSummary: null` does not receive invented coordinates. Descriptive AABBs are not support, confidence or separation boundaries.

## Falsifiers required on the promoted head

1. Throw both `dataInput.rows` and `dataset.rows`; governed READY cluster rendering still succeeds from the semantic payload.
2. Remove semantic evidence; `CLUSTER_VOLUME` produces no row-derived cluster sphere or chart fallback.
3. Supply decoy color/categorical/`cluster` fields; they do not become authority.
4. Pending/refused/invalid/stale/unavailable semantic states remain row-free and fail closed.
5. Production `VRTopologyTranslator` contains no live `.buildClusterVolume(` dispatch.
6. Null-spatial regions receive no fabricated mark.
7. Interaction proxies retain Rust semantic IDs, exact source partition identity, counts and provenance and use semantic kind `cluster-region`.
8. Output remains bounded by C2's 256-region / 65,536-label-byte envelope rather than source N.

## Non-goals retained

C3 does not add inferred clustering, k-means/DBSCAN/HDBSCAN, Relationship Graph/R2E, progressive disclosure, C4 scale/perceptual qualification, or physical Quest evidence.

## Exit

If the isolated exact head passes CI, CodeQL, architecture policy, Q8, approval and Q9 with no unresolved review blocker, C3 may merge as **IMPLEMENTATION LANDED**. R2D still remains **REVIEW ACTIVE** until C4 evidence and the independent C5 STOP review are complete.
