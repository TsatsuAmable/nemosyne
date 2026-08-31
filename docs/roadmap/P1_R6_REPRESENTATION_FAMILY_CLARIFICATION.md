# P1-R6 Representation Family / Layout Clarification

**Status:** R6A IMPLEMENTED ON BRANCH / REVIEW ACTIVE  
**Base:** `main@fff946b0964397149be27d08f0c72245bbfb28f9` (#582 merged)  
**Parent:** `P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` R6  
**Entry condition:** P1-R2C Density Truth stop gate satisfied.  
**Purpose:** make Moneta's reasoning families, layout compatibility, semantic candidate identity, and Rust-owned embodiment authority impossible to conflate before another dataset-level representation is migrated.

## Why R6 is next

Density, distribution and aggregate now demonstrate the same architectural lesson: a shared Three.js macro-layout does not define the analytical representation.

`RepresentationFamily.ts` declares 10 reasoning families but the runtime has 7 `VRLayout` values. Several families legitimately share layouts. In particular, `DISTRIBUTION` and `AGGREGATE` are compatible with `GRID_3D`, but their production geometry/payloads are not point grids. Candidate-specific geometry and the governed semantic embodiment payload carry the representation meaning.

R6 therefore precedes R2D cluster work. It is a bounded ontology/control-plane clarification, not a new rendering programme.

## R6A — make layout compatibility explicit

**Invariant:** family/layout tables describe compatible macro-layout strategies only. They do not define semantic payload type, analytical method, or renderer authority.

This checkpoint:

- introduces `FAMILY_TO_COMPATIBLE_LAYOUTS` as the canonical many-to-many relation;
- introduces `LAYOUT_TO_COMPATIBLE_FAMILIES` as its true reverse;
- renames the single-valued legacy interpretation to `LAYOUT_PRIMARY_REASONING_FAMILY`;
- retains `FAMILY_TO_LAYOUTS` and `LAYOUT_TO_FAMILY` as deprecated identity aliases so the checkpoint changes no runtime ranking/rendering behavior;
- adds a mechanical test proving `GRID_3D` is compatible with multiple semantic reasoning families and therefore cannot be interpreted as point-representation authority;
- documents `FAMILY_TO_CANDIDATE_IDS` as rank-effective reasoning membership rather than payload/renderer dispatch.

**Exit:** source and tests can no longer describe `LAYOUT_TO_FAMILY` as a true reverse semantic mapping, while existing decisions remain byte-for-byte behaviorally equivalent with respect to family/layout candidate generation.

## R6B — audit rank-effective multi-family candidate membership

**Status:** NEXT after R6A merges and exact-head review passes.

Adversarial review of R6A exposed a separate rank-effective issue that must not be smuggled into a naming refactor:

`FAMILY_TO_CANDIDATE_IDS.CLUSTER` currently contains both `CLUSTER_REGIONS` and `DENSITY_FIELD`.

Family membership is consumed by `BootstrapFitnessModel.scoreStructure()` and `configuredPrior`. Therefore the same semantic candidate can receive different utility depending on which reasoning family emitted it. On authoritative cluster evidence, a `DENSITY_FIELD` variant emitted under `CLUSTER` can receive cluster-family structure credit even though RF-065 deliberately narrowed `DENSITY_FIELD` to `binned-empirical-mass` and removed continuous/population-density semantics. This may be intentional proxy behavior or stale ontology; it is not safe to decide without an explicit treatment review.

R6B must:

1. enumerate every candidate that belongs to multiple reasoning families;
2. quantify how each membership changes structure/configured-prior scores under independently constructed signatures;
3. define the admissibility rule for family membership from reviewed candidate capabilities/information contracts rather than visual similarity;
4. specifically decide whether `DENSITY_FIELD` remains admissible under `CLUSTER` after RF-065;
5. review `RELATIONSHIP_GRAPH` across `GRAPH`/`TOPOLOGY` and `TEMPORAL_TRAJECTORY` across `TEMPORAL`/`FREQUENCY` under the same rule;
6. add falsifiers that prevent family membership from granting unsupported scientific semantics;
7. if any membership changes ranking, mint a new `BOOTSTRAP_FITNESS_MODEL_VERSION` and `FITNESS_TREATMENT_ID` and record the treatment change in decision provenance;
8. keep renderer/payload authority unchanged.

**Exit:** every multi-family membership has a reviewed semantic justification, unsupported family credit is impossible, and any rank-effective correction is explicitly versioned.

## Stop gate before R2D

Do not begin Cluster Regions production migration until R6B has either:

- confirmed the current cluster-family membership contract with falsifying tests; or
- corrected it under a new fitness treatment identity.

R2D must then separately decide the scientific authority for cluster evidence. At minimum distinguish:

- supplied partition labels or source-authoritative groups;
- a separately governed Rust clustering method with method/metric/scaling/parameters/provenance;
- presentation-only grouping, which must not be promoted as scientific cluster evidence.

Geometry must never infer authoritative clusters from arbitrary layout positions.

## Explicit non-goals

- no R2D cluster payload or renderer implementation in R6;
- no inferred k-NN/similarity/correlation topology;
- no changes to density/distribution/aggregate Rust payloads;
- no physical Quest qualification claim;
- no weight tuning disguised as ontology cleanup.

## Required adversarial questions

1. Is a table expressing compatibility, reasoning membership, or analytical authority? The name/type/test must make that explicit.
2. Can one layout be shared by multiple families without implying shared semantic geometry?
3. Can one candidate gain unsupported structure score merely by appearing under a family label?
4. Does any rank-effective change mint a new treatment/version identity?
5. Does semantic candidate/payload identity remain authoritative through bootstrap, learned runtime, Worker/WASM and renderer dispatch?

## Model routing

- **R6A:** Balanced/high implementation; Frontier/high post-review.
- **R6B:** Frontier/high or xhigh because membership is rank-effective and can change scientific recommendation semantics.

Exact-head tests and treatment-version evidence remain authoritative regardless of model choice.
