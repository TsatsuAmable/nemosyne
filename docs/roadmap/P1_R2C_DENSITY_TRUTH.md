# P1-R2C Density Truth

**Status:** VERIFIED COMPLETE for the bounded desktop-browser scope / STOP GATE SATISFIED  
**Parent programme:** `P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` R2C  
**Reviewed implementation head:** `1bed1f917303078e7aa9ed3ed1208910dfb63f5b` (#582)  
**Integration base:** `main@fff946b0964397149be27d08f0c72245bbfb28f9` (#582 merged)  
**Purpose:** provide one truthful, bounded, Rust-owned bivariate binned-density representation through the real product path, then stop before any automatic cluster or inferred-topology expansion.

## Finite exit

R2C is complete for its reviewed browser scope. `DENSITY_FIELD` is a production `DATASET_LEVEL_VALID` candidate backed by a resident Rust/WASM semantic payload. Three.js consumes the bounded payload rather than source rows, and pending/refused/invalid/stale/unavailable output does not fabricate a point, grid-row, legacy voxel, or chart substitute.

This completion claim is deliberately narrow. It does **not** claim physical Quest qualification, generic 100k/500k performance, a continuous-density estimator, KDE/PDF semantics, cluster inference, polished investigator UX, or completed progressive observation drill-down.

## Mathematical boundary

V1 is a **bivariate binned empirical field**. It is not a KDE, PDF, continuous-density estimator, contour model, clusterer, or manifold estimator.

The reviewed method binds:

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

`DENSITY_FIELD` preserves empirical bivariate bin mass. It does not claim continuous or population-density semantics. The rank-effective correction remains versioned as `bootstrap-fitness-v2` / `fitness-treatment-v2`.

## Completed checkpoints

| Checkpoint | Evidence | Status |
| --- | --- | --- |
| **M1 — contract and initial falsifiers** | #570 | **MERGED** |
| **M2 — resident-handle Rust builder** | #571 | **MERGED** |
| **M1R — lattice/ontology/method repair** | #576, #577 | **MERGED** |
| **M3 — production cutover / row-free embodiment** | #579 | **MERGED** |
| **M4 — product/scale/perceptual evidence** | #580 | **MERGED** |
| **M4R — draw-call stop finding** | #581 | **MERGED** |
| **M2R — transient pair-buffer/evidence-rail stop finding** | #582 | **MERGED** |

### M1 / M1R truth contract

#570 established the `DENSITY` family, `BINNED_DENSITY` payload kind, bivariate request shape, 20×20/400 bounds and real-WASM round-trip tests.

Independent review then found three contract defects. #576/#577 closed them before production cutover:

- every `(xIndex, yIndex)` in the declared lattice must occur exactly once;
- binned empirical mass is no longer ranked or described as continuous population density;
- analytical method parameters are strict, typed and unknown-field rejecting;
- method-contract version and implementation algorithm identity are distinct and exact;
- constant-domain behavior is governed and fail-closed.

### M2 / M2R Rust authority and memory bound

#571 moved the binned-density calculation onto the resident Rust columnar dataset capability. The JS boundary carries handle plus reviewed parameters rather than source rows.

Post-M4 review found that the first implementation still materialized all canonical valid `(x, y)` pairs into an O(N) transient Rust vector. #582 removed that source-sized copy. The builder now makes two resident-column passes: the first derives canonical valid count and domains; the second increments the bounded lattice directly. Additional density-output allocation is therefore bounded by the governed `<= 400` cells rather than source N.

#582 also expanded the exact-head M4 workflow trigger set to the Rust density builder/contract, resident columnar storage, Worker dispatch and WASM bridge so analytical-authority changes cannot silently bypass product-path evidence.

### M3 production cutover

#579 completed the real production chain:

```text
explicit bivariate requirements
  -> Moneta DENSITY_FIELD decision
  -> SemanticEmbodimentLoader
  -> analytical Worker
  -> resident Rust/WASM density builder
  -> BINNED_DENSITY envelope
  -> DensitySemanticEmbodiment
  -> bounded Three.js artifact
```

The production cutover proves:

- generation, dataset-version, fingerprint and decision fencing remain fail-closed;
- the density adapter consumes only the governed payload;
- both `dataInput.rows` and `dataset.rows` may be unavailable/throw while density still renders;
- no chart, point, grid-row or legacy voxel fallback appears for pending/refused/invalid/stale/unavailable density output;
- stable Rust semantic cell IDs and payload/decision provenance survive onto selectable objects;
- `DENSITY_FIELD` passed the A2 raw-row sentinel and was promoted to `DATASET_LEVEL_VALID`.

### M4 product and scale evidence

#580 exercised the production World/use-case/Worker/Rust/renderer path in Chromium at 1k, 8k and 32k source rows plus deterministic multimodal, sparse, uniform and constant-domain fixtures. It proved semantic output remained 100 cells for the selected 10×10 production lattice and preserved payload/decision/artifact identity.

M4 surfaced two real STOP findings rather than laundering a green result:

1. **draw-call pressure:** 100 separately rendered cells produced 148 whole-scene draw calls, above the default 120-call representation envelope;
2. **source-sized transient memory:** the Rust builder still carried an O(N) `(x, y)` pair vector whose allocator peak was not measured.

#581 replaced the 100 visible cell meshes with one instanced density render batch while preserving one non-rendering semantic interaction proxy per Rust cell. The exact-head M4 rerun reduced measured whole-scene draw calls to 49 while retaining semantic IDs and cell-level hover/selection behavior.

#582 removed the transient pair vector altogether and reran the exact-head production evidence. The retained report now states `densityBuilderSourceSizedPairBuffer: absent-two-pass-column-scan` rather than carrying the obsolete pre-fix allocator caveat.

## Post-implementation adversarial disposition

The exact #582 head passed the bounded post-review. The review re-traced the analytical authority path, row-fallback prohibition, source-N output bound, constant-domain semantics, stable IDs, provenance, evidence wording and workflow trigger coverage.

The following remain explicit boundaries rather than hidden completion claims:

- desktop Chromium evidence is not physical Quest qualification;
- Worker WASM linear-memory observations are not universal allocator-peak measurements;
- browser screenshots/perceptual samples are diagnostic identity/evidence handoff, not polished investigator-UX acceptance;
- density is still a finite binned empirical object, not a continuous estimator;
- R2C does not authorize cluster or topology inference.

## Stop gate outcome and next representation frontier

R2C has stopped as required. Passing density does not authorize automatic migration of the remaining candidate list.

The next serial step is **R6 family/layout clarification**, because current `RepresentationFamily` mappings describe layout compatibility, not semantic embodiment mathematics. Shared layouts such as `GRID_3D` must not be read as evidence that distribution or aggregate candidates are point representations. R6 should make the many-to-many compatibility relation explicit while leaving candidate/payload authority with the semantic representation contract.

After R6, the next analytical representation candidate should be selected explicitly:

1. **R2D Cluster Regions** if cluster comparison is the next product need. First decide what counts as authoritative cluster evidence: supplied partition labels, a separately governed clustering method, or distinct candidates. Geometry must not infer scientific clusters from arbitrary presentation positions.
2. **R2E Inferred Topology** only if investigators need relationships derived from ordinary tabular data. k-NN, similarity, correlation or threshold graphs are analytical models, not rendering glue; method, metric, scaling, threshold/k and provenance must be governed in Rust/Moneta.
3. Source-provided edge lists remain a separate authoritative graph case and must not be conflated with inferred topology.

## Required regression questions

Future changes touching density must continue to answer:

1. Did any N-dependent/data-derived density computation leak into TypeScript or Three.js?
2. Can output still be constructed if source-row getters throw?
3. Does the candidate claim exactly the mathematics present in the payload?
4. Can malformed identity, stale generation, method drift, coordinate duplication or resource drift fail closed?
5. Is output complexity bounded independently of source N?
6. Does refusal remain visible rather than becoming plausible substitute geometry?
7. Did the change create a new god class/payload or hidden second authority?
8. Are scale/perceptual claims no broader than the evidence collected?

## Model routing

- **R6 family/layout clarification:** Balanced/high is sufficient for the mechanical ontology clarification; Frontier/high for adversarial review because family membership is rank-effective.
- **R2D/R2E scientific contracts:** Frontier/high or xhigh for analytical definitions, Rust/WASM authority and production-cutover review.

Model choice is not evidence. Exact-head tests, production-path falsifiers and independent review remain the promotion gates.
