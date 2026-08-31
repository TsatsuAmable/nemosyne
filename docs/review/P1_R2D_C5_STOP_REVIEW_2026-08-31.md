# P1-R2D C5 Independent STOP Review

**Status:** REVIEW ACTIVE / FIX-FORWARD REQUIRED  
**Review base:** `main@2c37ad930df98aad44875e8a41d4d47f06107bdc` (#594 merged)  
**Programme:** `docs/roadmap/P1_R2D_CLUSTER_REGIONS.md`  
**Scientific contract:** `docs/rfcs/0001-source-partition-cluster-authority.md`

## Review question

Does the merged C1-C4 source-partition `CLUSTER_REGIONS` vertical slice satisfy the finite R2D V1 contract on fresh `main`, without relying on prior PR status, green checks alone, or presentation-side scientific inference?

This review is intentionally a STOP review. It may certify only the source-authoritative partition treatment and only the evidence actually obtained. It does not authorize inferred clustering, R2E topology work, physical Quest claims, or full P1-UV visual convergence.

## Fresh-main trace

### C1 scientific authority and rank-effective ontology

**PASS in reviewed scope.**

- `RepresentationRequirements` requires explicit `clusterAuthority: { kind: 'SOURCE_PARTITION', field }` plus exactly two or three distinct coordinate fields for the governed treatment.
- `MonetaHypothesisEngine` hard-disqualifies `CLUSTER_REGIONS` without explicit source-partition authority; measured cluster-like or density evidence cannot substitute.
- `CLUSTER_REGIONS` advertises source partition structure and aggregate group magnitude, not density, observation identity, empirical within-group distribution shape, or formal outlier boundaries.
- The rank-effective contract is versioned as `bootstrap-fitness-v4` / `fitness-treatment-v4` with frozen bootstrap numeric weights.
- RFC 0001 records the durable scientific decision and separates future inferred clustering into a different treatment.

Primary executable evidence: `tests/p1r-r2d-c1-cluster-authority.test.ts`.

### C2 resident Rust/WASM authority

**PASS in reviewed scope.**

- `wasm/src/moneta/cluster_embodiment.rs` uses the resident columnar dataset capability through `data::with_columnar_metadata`; it does not traverse JavaScript rows.
- The named partition field must be logical categorical and every named coordinate field numeric.
- V1 enforces at most 256 assigned groups and a 65,536 UTF-8 byte budget across retained exact source labels.
- Membership accounting is exact and separates source, assigned, unassigned, coordinate-valid and coordinate-excluded counts.
- Spatial summaries use complete-case finite coordinate tuples. A group with zero valid tuples remains explicit with `spatialSummary: null`; an entirely nonspatial partition refuses.
- READY output is `BOUNDED`, with `representedRowCount = coordinateValidCount`.
- Region semantic IDs are source-derived and row-order independent while the envelope dataset fingerprint remains exact-artifact identity.
- The deterministic centroid accumulator survives catastrophic-cancellation permutations.
- Request and output structures reject unknown/malformed fields and the READY envelope self-validates before serialization.

Primary executable evidence: `tests/p1r-r2d-c2-cluster-builder-wasm.test.ts`, `tests/p1r-r2d-c2-centroid-order-wasm.test.ts`, `tests/p1r-r2d-c2-label-budget-wasm.test.ts`, and Rust unit tests.

### C3 production cutover and presentation boundary

**PASS in reviewed scope.**

- `LoadDatasetUseCase` transports only the explicit source-partition field, explicit coordinate fields and decision provenance for a chosen `CLUSTER_REGIONS` decision.
- `SemanticEmbodimentLoader` uses generation/version/fingerprint/decision fencing around the asynchronous Worker request and rejects stale or identity-mismatched results.
- `VRTopologyTranslator` intercepts only `CLUSTER_VOLUME` carrying the explicit `semanticEmbodimentCandidateId === 'CLUSTER_REGIONS'` marker before source-row resolution.
- Generic `CLUSTER_VOLUME` remains a presentation primitive and is not promoted into scientific authority merely by geometry name.
- Governed pending/refused/invalid/unavailable states fail closed without chart, point, density or row-derived cluster substitution.
- The cluster-specific Three.js adapter reads only the bounded payload, creates centroid markers plus descriptive axis-aligned min/max wireframes, and records `supportBoundaryClaim: false`.
- Assigned groups with unavailable spatial summaries remain in semantic metadata and receive no fabricated position.
- Interaction semantics distinguish provenance-bearing `cluster-region` from presentation-only `presentation-cluster`.

Primary executable evidence: `tests/p1r-r2d-c3-cluster-production-cutover.test.ts` and `tests/rf062c-representation-surface.test.ts`.

### C4 product, scale and perceptual evidence

**PASS for measured desktop-browser synthetic scope.**

The exact-head C4 production-browser evidence on #594 observed:

| Source rows | Semantic regions | Payload JSON proxy | Rust kernel | Request to READY | Candidate-local draw calls |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 8 | 4,377 B | 6.835 ms | 140.400 ms | 2 |
| 8,000 | 8 | 4,354 B | 21.500 ms | 210.540 ms | 2 |
| 32,000 | 8 | 4,404 B | 82.760 ms | 734.190 ms | 2 |

Additional evidence retained one region, 240 near-bound regions, overlapping descriptive envelopes, missing labels, coordinate-invalid members and strongly imbalanced groups. The 240-region fixture retained all 240 authoritative groups with two candidate-local draw calls. Missing labels reconciled as 900 assigned / 100 unassigned. Invalid coordinates reconciled as 875 coordinate-valid / 125 excluded, with one semantic-but-nonspatial group and no fabricated geometry. Overlapping AABBs remained explicitly descriptive with `supportBoundaryClaim = false`.

The 32k request-to-READY observation is not described as real-time. This is desktop-browser synthetic evidence, not physical Quest qualification. Retained screenshots also expose broader shell/world clutter and therefore do not establish P1-UV visual convergence.

## Ten governing falsifiers

1. **Throw source-row getters:** PASS. C3 exercises both `dataInput.rows` and `dataset.rows` sentinels while READY semantic cluster regions render.
2. **No explicit partition field:** PASS. C1 hard-disqualifies `CLUSTER_REGIONS`; no arbitrary categorical/color/`cluster` field becomes authority.
3. **Multimodal density without partition authority:** PASS. C1 proves density/cluster-like evidence cannot admit the candidate.
4. **Layout-position independence:** PASS by architecture and executable boundary. Rust grouping/counts consume only the resident named source partition and coordinate fields; no layout position enters the analytical request or builder.
5. **More than 256 groups:** PASS. C2 refuses the 257th assigned group with `RESOURCE_LIMIT`; no truncate/merge/sample path exists.
6. **Missing labels and invalid coordinates:** PASS. C2/C4 reconcile assigned/unassigned and valid/excluded counts, retaining null-spatial groups explicitly.
7. **Row-order permutation:** PASS. C2 real-WASM evidence changes exact artifact fingerprint while preserving region IDs, ordering and payload summaries.
8. **Strong overlap:** PASS. C4 independently detects overlapping returned AABBs while presentation metadata remains descriptive and `supportBoundaryClaim = false`.
9. **Smuggled rows/source fragments:** PASS in reviewed request/payload contract. Rust request structs use `deny_unknown_fields`; production semantic execution parameters contain field names/provenance only; C2/C3 assert no row/rowId payload fragments.
10. **Pending/refused/stale/invalid:** PASS. C3 keeps governed states row-free and suppresses plausible substitute chart/point/legacy-cluster geometry.

## C5 blocker RF-C5-001: browser-evidence trigger gap

**Finding:** The dedicated C4 browser-evidence workflow did not wake up for several files that own R2D authority, ranking, transport or interaction semantics, including `SemanticEmbodimentLoader.ts`, `RepresentationSurface.ts`, the C1 Moneta authority/ranking files, and `wasm/src/moneta/mod.rs`.

**Why it blocks STOP:** C5 explicitly requires evidence/workflow trigger coverage. A later PR could weaken cluster authority or production transport while ordinary CI remained green and the strongest product-level cluster evidence was silently skipped.

**Fix-forward on this review branch:** expand `.github/workflows/p1r-cluster-c4-evidence.yml` path coverage across the C1-C3 authority/ranking/transport/Rust/presentation seams and add `tests/p1r-r2d-c5-cluster-evidence-trigger-coverage.test.ts` to pin that contract mechanically.

**Exit condition for this finding:** the fix-forward PR must itself trigger and pass the dedicated C4 browser evidence workflow plus ordinary exact-head CI, CodeQL, architecture policy, Q8, approval-gate and Q9. After merge, C5 must re-fence fresh `main` before any `VERIFIED COMPLETE` classification.

## Residuals deliberately not promoted to R2D blockers

- Physical Quest performance/comfort has not been measured and remains unqualified.
- The C4 screenshots show broader shell/world visual clutter. That belongs to P1-UV convergence, not to the truthfulness of the source-partition analytical object.
- R2D V1 does not discover clusters. Source labels may originate externally, but their scientific validity remains external unless separately governed.
- Observation-level progressive disclosure from a selected region remains R5 work.
- `MonetaTopologyNode.appendRows()` deserves broader semantic-representation lifecycle review for non-time-series dataset-level representations, but the reviewed production live-stream append path is currently time-series-specific and no R2D V1 cluster reachability was established. It is therefore not used to block this finite source-partition STOP decision.

## Current disposition

**R2D C1-C4 scientific/production scope: PASS.**  
**C5 STOP: BLOCKED ONLY ON RF-C5-001 evidence-trigger coverage until exact-head fix-forward evidence and fresh-main closure.**

Do not begin inferred clustering or R2E from this document. The STOP classification remains open until the finding above is merged and re-reviewed from fresh `main`.
