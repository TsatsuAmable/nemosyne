# P1-R2D C2 pre-implementation adversarial review

**Status:** IMPLEMENTATION / ADVERSARIAL REVIEW ACTIVE  
**Original base:** `main@f7d356c6b69f89374db0fdbe51088f1bd039d857` (#587 merged)  
**Current integration base:** includes merged #589 and #591  
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
- the 65,536-byte ceiling across distinct retained UTF-8 partition labels;
- deterministic ordering and source-derived semantic cluster IDs;
- row-order-independent centroid reduction with bounded working state;
- analytical method, approximation, information-contract and provenance fields.

TypeScript may carry the request and parse the bounded envelope, but C2 introduces no TypeScript cluster reduction and no production renderer path.

## Frozen C2 contract

- `MAX_CLUSTER_REGIONS_V1 = 256`.
- `MAX_CLUSTER_PARTITION_LABEL_BYTES_V1 = 65_536` across distinct non-empty source labels retained in a READY payload.
- Crossing either resource limit returns `RESOURCE_LIMIT`; source labels are never truncated, rewritten, merged, sampled or collapsed to an `other` bucket.
- Partition authority is one logical-categorical field.
- Coordinates are exactly two or three distinct numeric fields and may not reuse the partition field.
- Empty/missing partition labels are unassigned, not clusters. Non-empty labels are preserved exactly, including meaningful whitespace.
- `sourceCount = assignedCount + unassignedCount`.
- `assignedCount = coordinateValidCount + coordinateExcludedCount`.
- A coordinate tuple is valid only when every requested coordinate is valid and finite. Legitimate zeroes remain valid.
- Per-group assigned and coordinate-valid/excluded counts obey the same complete-case rule.
- Centroid and axis-aligned min/max use exactly the coordinate-valid tuple set.
- Centroids must be deterministic under row permutation, including catastrophic-cancellation inputs. The V1 implementation therefore accumulates exact signed integer significands in bounded IEEE-754 exponent bins and converts the bins in a fixed order rather than using an order-sensitive running floating mean.
- A group with assigned members but no valid tuple remains explicit with `spatialSummary: null`.
- If no assigned group has any valid tuple, return `MISSING_EVIDENCE` rather than READY.
- READY approximation is `BOUNDED`; `representedRowCount = coordinateValidCount`.
- Partition membership/group counts remain exact despite bounded spatial summarisation.
- The envelope's canonical `datasetFingerprint` owns exact artifact/provenance identity and may change under row permutation.
- Region-local semantic IDs derive from schema version, candidate identity, partition-field identity and canonical source label, not from row-order-sensitive dataset fingerprint or iteration index. Their uniqueness is scoped by the fingerprinted envelope.
- Output ordering and region-local payload summaries are deterministic and row-order invariant.
- No raw rows, observation-ID arrays or nested source fragments may cross the semantic envelope.

## Primary failure modes and falsifiers

1. **Implicit/type-confused authority**: request a numeric partition or categorical coordinate. Must refuse `INVALID_PARAMETERS`.
2. **Wrong dimensionality**: request 0, 1, 4, duplicate coordinates, or reuse the partition field as a coordinate. Must refuse.
3. **Axis-wise missingness bug**: construct rows where X and Y are individually valid on disjoint subsets. No centroid/bounds may be produced from mismatched subsets; complete-case counts must expose zero representable tuples.
4. **Accounting drift**: mixed missing labels and invalid coordinates must satisfy both global reconciliation equations and equivalent per-group equations.
5. **Zero-value loss**: `(0,0)` and zero on any axis must remain valid represented coordinates.
6. **Unavailable group fabrication**: a group with no complete coordinate tuple remains explicit with `spatialSummary: null`; if every group is unavailable, the request refuses.
7. **Region-count resource overrun**: 257 assigned labels must refuse before a 257-element payload is produced.
8. **Byte-resource overrun**: exact retained source labels whose distinct UTF-8 bytes exceed 65,536 must refuse instead of producing an unbounded payload or mutating identity.
9. **Identity instability**: row permutation may change the envelope fingerprint but must not change region-local IDs, region ordering or bounded summaries; inserting a lexically earlier unrelated group must not renumber existing IDs.
10. **Floating reduction instability**: catastrophic-cancellation permutations must produce exactly the same centroid payload. The original running-mean implementation failed this falsifier and was replaced rather than weakening the test.
11. **Non-finite leakage**: NaN/Infinity never appears in READY JSON.
12. **Boundary overclaim**: method/approximation/information metadata must describe a bounded descriptive partition summary, not exact observation embodiment, support boundaries, density, confidence regions or inferred clusters.
13. **Architecture leak**: C2 changes no Worker, renderer or graph-semantic production files.

## Intended implementation shape

Use a dedicated `wasm/src/moneta/cluster_embodiment.rs` plus the smallest module export/common-contract and low-level WASM bridge changes required. Do not adopt the prototype donor's mixed cluster+graph `structural_embodiment.rs`; C2 remains cluster-specific and finite.

The deterministic centroid accumulator is deliberately bounded by the finite IEEE-754 exponent universe. It does not retain O(N) coordinate observations merely to sort them before reduction.

## Review findings already resolved

- RFC 0001 originally combined row-order-sensitive `datasetFingerprint` with row-order-invariant region IDs. #591 separated artifact identity from region-local identity before C2 promotion.
- Exact-head CI exposed an order-sensitive running centroid: equivalent row permutations yielded `0.3333333333333333` versus `0`. C2 now uses deterministic exponent-bin accumulation and retains the catastrophic-cancellation WASM regression.
- The 256-region bound alone did not cap payload bytes when exact source labels are retained. C2 now adds a 65,536-byte distinct-label ceiling and a real-WASM refusal test.
- The broader #586 structural prototype mixed cluster and graph work and remains non-authoritative; it was closed as superseded.

## Exit

C2 passes only when Rust reference fixtures and real WASM boundary tests prove the frozen contract, exact-head CI/CodeQL/architecture/Q8/Q9/approval gates pass, and post-implementation review finds no unresolved scientific or resource blocker. Production `CLUSTER_REGIONS` remains unavailable until C3 cuts the Worker/renderer path over to this payload.
