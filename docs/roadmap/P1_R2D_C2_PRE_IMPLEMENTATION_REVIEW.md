# P1-R2D C2 pre-implementation adversarial review

**Status:** IMPLEMENTATION ACTIVE / CONTRACT RECORDED BEFORE CODE  
**Base:** `main@f7d356c6b69f89374db0fdbe51088f1bd039d857` (#587 merged)  
**Governing RFC:** `docs/rfcs/0001-source-partition-cluster-authority.md`  
**Scope:** resident Rust/WASM source-partition builder only

## Invariant

Given a resident canonical dataset handle, one explicitly named logical-categorical source-partition field and exactly two or three explicitly named numeric coordinate fields, Rust returns a deterministic bounded `CLUSTER_REGIONS` partition summary conforming to RFC 0001.

C2 must not infer cluster membership, substitute fields, transport source rows, invent spatial summaries, or introduce Relationship Graph/R2E semantics.

## Authority and boundary

Rust resident dataset/columnar capability owns:

- validation that the named partition field exists and is categorical;
- validation that exactly two or three distinct named coordinate fields exist and are numeric;
- partition membership and unassigned accounting;
- complete-case coordinate validity;
- member counts, centroids and descriptive axis-aligned bounds;
- the 256 assigned-group resource limit;
- deterministic ordering and source-derived semantic cluster IDs;
- analytical method, approximation, information-contract and provenance fields.

TypeScript may later carry the request and parse the bounded envelope, but C2 introduces no TypeScript cluster reduction and no production renderer path.

## Frozen C2 contract

- `MAX_CLUSTER_REGIONS_V1 = 256`.
- Partition authority is one logical-categorical field.
- Coordinates are exactly two or three distinct numeric fields and may not reuse the partition field.
- Empty/missing partition labels are unassigned, not clusters.
- `sourceCount = assignedCount + unassignedCount`.
- `assignedCount = coordinateValidCount + coordinateExcludedCount`.
- A coordinate tuple is valid only when every requested coordinate is valid and finite. Legitimate zeroes remain valid.
- Per-group assigned and coordinate-valid/excluded counts obey the same complete-case rule.
- Centroid and axis-aligned min/max use exactly the coordinate-valid tuple set.
- A group with assigned members but no valid tuple remains explicit with `spatialSummary: null`.
- If no assigned group has any valid tuple, return `MISSING_EVIDENCE` rather than READY.
- READY approximation is `BOUNDED`; `representedRowCount = coordinateValidCount`.
- Partition membership/group counts remain exact despite bounded spatial summarisation.
- The envelope's canonical `datasetFingerprint` owns exact artifact/provenance identity and may change under row permutation.
- Region-local semantic IDs derive from schema version, candidate identity, partition-field identity and canonical source label, not from row-order-sensitive dataset fingerprint or iteration index. Their uniqueness is scoped by the fingerprinted envelope.
- Output ordering and region-local payload summaries are deterministic and row-order invariant.
- Crossing the group limit returns `RESOURCE_LIMIT`; no merge, truncate, sample or `other` bucket is allowed.
- No raw rows, observation-ID arrays or nested source fragments may cross the semantic envelope.

## Primary failure modes and falsifiers

1. **Implicit/type-confused authority**: request a numeric partition or categorical coordinate. Must refuse `INVALID_PARAMETERS`.
2. **Wrong dimensionality**: request 0, 1, 4 or duplicate coordinate fields. Must refuse.
3. **Axis-wise missingness bug**: construct rows where X and Y are individually valid on disjoint subsets. No centroid/bounds may be produced from mismatched subsets; complete-case counts must expose zero representable tuples.
4. **Accounting drift**: mixed missing labels and invalid coordinates must satisfy both global reconciliation equations and equivalent per-group equations.
5. **Zero-value loss**: `(0,0)` and zero on any axis must remain valid represented coordinates.
6. **Unavailable group fabrication**: a group with no complete coordinate tuple remains explicit with `spatialSummary: null`; if every group is unavailable, the request refuses.
7. **Resource overrun**: 257 assigned labels must refuse before a 257-element payload is produced.
8. **Identity instability**: row permutation may change the envelope fingerprint but must not change region-local IDs, region ordering or bounded summaries; inserting a lexically earlier unrelated group must not renumber existing IDs.
9. **Non-finite leakage**: NaN/Infinity never appears in READY JSON.
10. **Boundary overclaim**: method/approximation/information metadata must describe a bounded descriptive partition summary, not exact observation embodiment, support boundaries, density, confidence regions or inferred clusters.
11. **Architecture leak**: C2 changes no Worker, renderer or graph-semantic files.

## Intended implementation shape

Prefer a dedicated `wasm/src/moneta/cluster_embodiment.rs` plus the smallest module export/common-contract changes required. Do not adopt the prototype donor's mixed cluster+graph `structural_embodiment.rs`; C2 should remain cluster-specific and finite.

## Exit

C2 passes only when Rust reference fixtures and a real WASM boundary test prove the frozen contract. Production `CLUSTER_REGIONS` remains unavailable until C3 cuts the Worker/renderer path over to this payload.
