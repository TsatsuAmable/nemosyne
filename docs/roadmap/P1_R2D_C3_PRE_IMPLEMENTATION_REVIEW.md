# P1-R2D C3 pre-implementation adversarial review

**Status:** IMPLEMENTATION ACTIVE / CONTRACT RECORDED BEFORE CODE  
**Base:** `main@ba58f0a373bf677caa9af3d1d03c0d2e3fdbbb6d` (#590 merged)  
**Governing RFC:** `docs/rfcs/0001-source-partition-cluster-authority.md`  
**Scope:** production Worker/semantic-loader/renderer cutover for source-partition `CLUSTER_REGIONS` only

## Invariant

A production `CLUSTER_REGIONS` decision may render only from the bounded C2 Rust/WASM source-partition envelope. The production path must not read source rows, infer group membership, choose an arbitrary categorical/color/`cluster` field, reconstruct region statistics in TypeScript, or fall back to the legacy row-derived cluster sphere when semantic execution is pending, refused, invalid, stale or unavailable.

## Authority and boundary

- Investigation requirements own the explicit `SOURCE_PARTITION` authority declaration and explicit coordinate field names.
- The semantic loader transports only those field names plus Moneta decision provenance.
- The analytical Worker executes the existing resident-handle C2 Rust builder.
- Rust remains sole owner of field validation, membership accounting, complete-case spatial reduction, stable semantic IDs, resource enforcement and analytical provenance.
- Three.js maps bounded centroids and descriptive axis-aligned minima/maxima into a presentation coordinate frame. It must not strengthen descriptive bounds into support/confidence/separation claims.

## C3 production seam

```text
RepresentationRequirements.clusterAuthority.field
+ explicit primaryDimensions (2 or 3 coordinate fields)
  -> LoadDatasetUseCase
  -> loadClusterSemanticEmbodiment
  -> AnalyticalExecutionPort semanticEmbodiment request (no datasetPayload / no rows)
  -> analytical.worker
  -> buildClusterSemanticEmbodimentV1(handle, request)
  -> bounded ClusterEmbodimentEnvelopeV1
  -> MonetaTopologyNode generation/decision fencing
  -> VRTopologyTranslator CLUSTER_VOLUME interception before rows
  -> ClusterSemanticEmbodiment thin adapter
```

## Primary falsifiers

1. **Raw-row fallback:** both `dataInput.rows` and `dataset.rows` throw. READY, PENDING, REFUSED, INVALID and UNAVAILABLE cluster states must remain row-free.
2. **Implicit authority:** loader must use `requirements.clusterAuthority.field`; it may not substitute `encodings.color`, first categorical field, a property named `cluster`, or another field.
3. **Coordinate substitution:** loader must transport the explicit coordinate dimensions unchanged. Rust owns numeric/type/dimensionality refusal.
4. **Stale payload:** generation/version/fingerprint mismatch or decision-provenance mismatch returns unavailable/null and never renders legacy geometry.
5. **Legacy authority reachability:** production dispatch must intercept `CLUSTER_VOLUME` before `rows = dataset?.rows ...`; the live cluster branch must not call `buildClusterVolume`.
6. **Presentation overclaim:** rendered bounds are visibly wireframe descriptive envelopes with centroid markers, not opaque spheres/support volumes. Metadata must label them descriptive AABBs and retain analytical method/provenance.
7. **Unavailable spatial group:** a region with `spatialSummary: null` remains explicit in semantic metadata but receives no fabricated spatial mark.
8. **Bounded output:** renderer creates O(region count) semantic proxies and a bounded number of visible batched surfaces independent of source N.
9. **Identity:** interaction proxies use Rust `semanticId` and preserve exact source partition value plus assigned/valid/excluded counts.
10. **Inventory truth:** `CLUSTER_REGIONS` becomes `DATASET_LEVEL_VALID` only after the throwing-row production falsifier passes.

## Non-goals

- no inferred clustering;
- no Relationship Graph/R2E work;
- no new Moneta ranking semantics or fitness version;
- no progressive-disclosure R5 implementation;
- no source-N product/scale/perceptual qualification beyond C3 functional evidence;
- no physical Quest qualification.

## Exit

C3 passes only when the real production seam is row-free and fail-closed, the legacy `buildClusterVolume(rows, ...)` branch is no longer reachable for `CLUSTER_REGIONS`, semantic identity/provenance survives into interaction metadata, and the representation inventory can truthfully classify `CLUSTER_REGIONS` as `DATASET_LEVEL_VALID`.
