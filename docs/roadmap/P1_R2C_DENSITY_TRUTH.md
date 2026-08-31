# P1-R2C Density Truth

**Status:** M1 + M2 + M1R LANDED / M3 NEXT  
**Parent programme:** `P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` R2C  
**Integration base:** `main@3cfbf41032a9760f467dd6a919b8b1fff882d61c` (#577 merged)  
**Purpose:** complete one truthful, bounded, Rust-owned bivariate binned-density representation through the real product path, then stop for independent review before cluster or inferred-topology expansion.

## Why this document exists

R2C already existed in the parent P1-R roadmap, but only as a generic density-builder item. #570 selected the concrete V1 object and #571 immediately landed the resident-handle Rust builder. #576 then repaired the lattice, ontology/ranking and strict-method-schema gaps found by independent review, while #577 made constant-domain behavior explicit and fail-closed. The next finite checkpoint is therefore M3 production cutover rather than further contract expansion.

This document refines the existing R2C tranche; it does not create a second representation programme. It inherits the parent invariant:

> Three.js must not receive or traverse raw dataset rows to construct a non-observation representation. Rust/WASM derives the semantic object; TypeScript orchestrates and embodies a bounded payload.

## Mathematical boundary

V1 is a **bivariate binned empirical field**. It is not a KDE, PDF, continuous-density estimator, contour model, clusterer, or manifold estimator.

M1R now binds the candidate to the information actually carried: empirical bivariate bin mass. `DENSITY_FIELD` no longer earns continuous/population-density semantics for a finite equal-width count lattice, and the rank-effective correction is explicitly versioned as `bootstrap-fitness-v2` / `fitness-treatment-v2`.

The reviewed V1 method binds:

- two distinct explicit numeric fields;
- deterministic equal-width bins on X and Y;
- left-closed/right-open bins with final-bin inclusion;
- canonical invalid-value exclusion and count reconciliation;
- finite ordered domains and explicit constant-domain policy `assign-final-bin-per-degenerate-axis`;
- full declared lattice retention on degenerate axes, with mass allowed only in the final bin of each degenerate axis;
- a hard `20 × 20 = 400` cell ceiling unless a later version is separately governed;
- stable semantic cell IDs and complete unique `(xIndex, yIndex)` coverage;
- exact method/version/provenance identity;
- no raw rows or hidden row-shaped metadata in the semantic envelope.

## Landed checkpoint: M1 — contract and initial falsifiers (#570)

#570 established the `DENSITY` family, `BINNED_DENSITY` payload kind, bivariate request shape, 20×20/400 bounds and real-WASM round-trip tests.

Independent review found three contract gaps that M2 inherited but did not create:

1. grid validation checked cell count but did not prove unique/complete coordinate-pair coverage;
2. the candidate advertised `continuous-density` / `population-density-distribution`, and the live fitness model awarded ranking credit for those stronger semantics;
3. density analytical parameters were read from a permissive generic JSON object rather than a strict unknown-field-rejecting method schema.

Those gaps are now closed by M1R rather than carried into production.

## Landed checkpoint: M2 — Rust resident-handle builder (#571)

#571 computes the bivariate grid from the resident columnar dataset handle in Rust, crosses the JS boundary with handle + parameters rather than rows, derives deterministic domains, applies equal-width/inclusive-final assignment, and emits at most 400 cells.

The bounded review did not find a second TypeScript analytical authority or row transfer in this builder. After #576/#577, M2 passes through the corrected fail-closed M1R validator and is ready for the M3 production integration checkpoint.

Residual implementation note: the current builder materializes all valid `(x,y)` pairs in a transient Rust vector before computing domains/grid. This is acceptable for the presently declared 500k-row candidate envelope if measured, but M4 should record peak memory and M2R should remove the materialization if it becomes a resource cliff; a two-pass column traversal can compute domains then bins without an O(N) pair copy.

## Landed checkpoint: M1R — contract repair and falsifier hardening (#576, #577)

**Completed before M3.**

- [x] reject duplicate `(xIndex, yIndex)` cells and prove every coordinate in the declared `binsX × binsY` lattice occurs exactly once;
- [x] replace `continuous-density` / `population-density-distribution` ranking claims with the truthful `binned-empirical-mass` / `empirical-bivariate-bin-mass` contract;
- [x] make density analytical-method parameters a strict typed schema with unknown-field rejection;
- [x] bind `analyticalMethod.version` and provenance algorithm identity to the reviewed V1 method;
- [x] add real-WASM mutations for duplicate/missing coordinates, unknown/nested method parameters, method/version drift and former continuous/PDF-style claims;
- [x] explicitly govern and test constant-domain semantics: retain the full lattice and assign observations to the final bin on each degenerate axis;
- [x] keep `DENSITY_FIELD` unresolved/non-production in the A2 migration inventory until M3.

#576 closed RF-064/RF-065/RF-066 and versioned the rank-effective semantic correction. #577 closed the remaining constant-domain prerequisite by adding `constantDomain = assign-final-bin-per-degenerate-axis` to the strict method contract and proving X-constant, Y-constant, both-constant, count-conservation and policy-drift behavior through Rust and real WASM.

**Exit:** satisfied. The M1 contract is fail-closed and scientifically no stronger than the implemented binned object, while M2 passes through the corrected validator. M3 is now unblocked.

## M3 — production cutover and row-free embodiment

**Invariant:** an authoritative `DENSITY_FIELD` decision reaches the resident Worker/WASM builder and the renderer consumes only the returned binned payload. Pending/refused/invalid/stale output produces no point, grid-row or legacy density substitute.

- [ ] extend `SemanticEmbodimentLoader` / Worker dispatch without weakening generation, dataset-version, fingerprint or decision fencing;
- [ ] give density its own thin payload adapter in the production `VRTopologyTranslator` path;
- [ ] remove the current `buildDensityField(... rows ...)` analytical path from production density embodiment;
- [ ] prohibit chart/point/legacy voxel fallback when output is pending, refused, invalid or unavailable;
- [ ] preserve semantic cell IDs and payload provenance on selectable rendered objects;
- [ ] prove both `dataInput.rows` and `dataset.rows` may throw while the real density representation still renders;
- [ ] promote only `DENSITY_FIELD` to `DATASET_LEVEL_VALID` once the real path passes.

**Exit:** intent/requirements → Moneta decision → Worker/WASM → Rust payload → bounded Three.js artifact executes through the production entry point without raw-row reconstruction.

## M4 — product, scale, memory and perceptual evidence

- [ ] add a canonical bivariate fixture with independently predictable dense/sparse regions;
- [ ] exercise the production `World` / use-case / Worker / Rust / renderer path in Chromium;
- [ ] retain source N, exact payload/provenance, payload byte proxy, element count, rendered semantic mesh count, relevant timings and WASM-memory observations;
- [ ] compare 1k/8k/32k variants and prove semantic element count remains bounded by the lattice rather than source N;
- [ ] measure whether the M2 transient pair vector creates a material memory cliff at the supported scale envelope;
- [ ] bind screenshot/perceptual evidence to the exact payload/artifact identity;
- [ ] test sparse, uniform, multimodal and constant-domain cases so success cannot be inferred from one flattering fixture;
- [ ] expose explicit pending/refused/unavailable states without fabricating an alternative visualization;
- [ ] make no physical-Quest or universal 100k/500k performance claim from desktop Chromium evidence.

**Exit:** the visible result is distinct, truthful, bounded, inspectable and mechanically tied to the Rust semantic object.

## Stop gate after M4

R2C **must stop** after M4 and independent post-review. Passing density does not authorize automatic migration of the remaining candidate list.

The next representation choice must be explicitly railed from evidence:

1. **R2D Cluster Regions** if cluster-comparison is the next product need. Decide what counts as authoritative cluster evidence first: supplied partition labels, a separately governed clustering method, or distinct candidates. Geometry must not infer scientific clusters from arbitrary presentation positions.
2. **R2E Inferred Topology** only if investigators need relationships derived from ordinary tabular data. k-NN, similarity, correlation or threshold graphs are analytical models, not rendering glue. They require explicit method/metric/scaling/threshold-or-k/provenance in Rust/Moneta. Source-provided edge lists remain a separate authoritative graph case.
3. **R6 family/layout clarification** should reframe `FAMILY_TO_LAYOUTS` as layout compatibility rather than semantic embodiment authority, so a family-to-`GRID_3D` entry cannot be mistaken for the representation mathematics.

## Collision and ownership rules

M3 is collision-sensitive around:

- `wasm/src/moneta/**`;
- `src/moneta/representation/SemanticEmbodimentPayload.ts`;
- `src/moneta/representation/RepresentationCandidate.ts`;
- `src/moneta/representation/FitnessModel.ts` / requirement vocabulary when representation semantics affect ranking;
- `src/wasm/runtime/SemanticEmbodimentBridge.ts`;
- the analytical Worker semantic-embodiment operation;
- `src/app/dataset/SemanticEmbodimentLoader.ts` / `LoadDatasetUseCase.ts`;
- `src/moneta/VRTopologyTranslator.ts` and the narrow density adapter.

Only one open implementation PR may alter the density contract/production integration at a time. No stacked M3/M4 branches: merge, resync to `main`, then cut the next checkpoint.

## Required adversarial questions

1. Did any N-dependent/data-derived computation leak into TypeScript or Three.js?
2. Can output still be constructed if every source-row getter throws?
3. Does the candidate claim exactly the mathematics present in the payload?
4. Can malformed identity, stale generation, method drift, coordinate duplication or resource drift fail closed?
5. Is output complexity bounded independently of source N, and is transient memory measured?
6. Does refusal remain visible rather than becoming a plausible substitute geometry?
7. Did the checkpoint create a new god class/payload or hidden second authority?
8. Are scale/perceptual claims no broader than the evidence collected?

## Suggested model routing

- **M3:** Frontier/xhigh for lifecycle, Worker fencing, authority and production-cutover review.
- **M4:** Balanced/high for bounded evidence plumbing; Frontier/high for interpretation, claim promotion and fixes.

Model choice is not evidence. Exact-head tests, production-path falsifiers and independent review remain the promotion gates.
