# P1-R6 Representation Family / Layout Clarification

**Status:** R6A MERGED (#583) / R6B IMPLEMENTED ON BRANCH / REVIEW ACTIVE  
**Base:** `main@a00388eaa1476b3b3fe4b31d99f3770b1b42ac88` (#583 merged)  
**Parent:** `P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` R6  
**Entry condition:** P1-R2C Density Truth stop gate satisfied.  
**Purpose:** make Moneta's reasoning families, layout compatibility, semantic candidate identity, and Rust-owned embodiment authority impossible to conflate before another dataset-level representation is migrated.

## Why R6 is next

Density, distribution and aggregate demonstrate the same architectural lesson: a shared Three.js macro-layout does not define the analytical representation.

`RepresentationFamily.ts` declares 10 reasoning families but the runtime has 7 `VRLayout` values. Several families legitimately share layouts. In particular, `DISTRIBUTION` and `AGGREGATE` are compatible with `GRID_3D`, but their production geometry/payloads are not point grids. Candidate-specific geometry and the governed semantic embodiment payload carry the representation meaning.

R6 therefore precedes R2D cluster work. It is a bounded ontology/control-plane clarification, not a new rendering programme.

## R6A — make layout compatibility explicit

**Status:** MERGED as #583.

**Invariant:** family/layout tables describe compatible macro-layout strategies only. They do not define semantic payload type, analytical method, or renderer authority.

R6A:

- introduced `FAMILY_TO_COMPATIBLE_LAYOUTS` as the canonical many-to-many relation;
- introduced `LAYOUT_TO_COMPATIBLE_FAMILIES` as its true reverse;
- named the single-valued legacy interpretation `LAYOUT_PRIMARY_REASONING_FAMILY`;
- retained `FAMILY_TO_LAYOUTS` and `LAYOUT_TO_FAMILY` as deprecated identity aliases, so R6A itself changed no ranking/rendering behavior;
- added a mechanical test proving `GRID_3D` is compatible with multiple semantic reasoning families and therefore cannot be interpreted as point-representation authority;
- documented `FAMILY_TO_CANDIDATE_IDS` as rank-effective reasoning membership rather than payload/renderer dispatch.

**Exit:** satisfied on exact head `34121a8d4b6861c7462ba8c95ebb13328e508354`; CI, CodeQL, architecture, approval and Q9 passed before #583 merged.

## R6B — remove rank-effective duplicate family aliases

**Status:** IMPLEMENTED ON `fix/p1r-r6-family-membership-treatment` / REVIEW ACTIVE.

R6A's adversarial review found that candidate family membership was not descriptive. `MonetaHypothesisEngine` generated the Cartesian product of a family's candidates and layouts, while `BootstrapFitnessModel` used the selected family in structure scoring and configured priors. A semantic candidate listed under multiple families therefore became multiple ranking treatments and could inherit evidence/layout variants unrelated to its own scientific contract.

The pre-change duplicates were:

- `DENSITY_FIELD`: `DISTRIBUTION` + `CLUSTER`;
- `RELATIONSHIP_GRAPH`: `GRAPH` + `TOPOLOGY`;
- `TEMPORAL_TRAJECTORY`: `TEMPORAL` + `FREQUENCY`.

The effect was not cosmetic:

- density could receive CLUSTER structure/prior credit despite not supporting `cluster-partition` after RF-065, and on graph-shaped data the CLUSTER family could also emit a force-directed density variant;
- relationship graph could be re-emitted under TOPOLOGY with `GRID_3D` even though its explicit cross-task capability already expresses relational topology;
- temporal trajectory could be re-emitted under FREQUENCY with `SPECTRAL_VOLUME` even though its `periodic-spectrum` capability already lets it satisfy a periodicity requirement without changing representation identity.

### R6B treatment decision

Each `SemanticRepresentationId` now has exactly one **canonical reasoning family**. Cross-task applicability is expressed only through the candidate's explicit `supports` / `preserves` / `loses` contract, not by duplicating the candidate under another family label.

Canonical assignments are:

| Candidate | Canonical reasoning family |
| --- | --- |
| `POINT_SET` | `POINT` |
| `MATRIX_FIELD` | `POINT` |
| `DISTRIBUTION_FIELD` | `DISTRIBUTION` |
| `DENSITY_FIELD` | `DISTRIBUTION` |
| `CLUSTER_REGIONS` | `CLUSTER` |
| `AGGREGATE_VOLUME` | `AGGREGATE` |
| `RELATIONSHIP_GRAPH` | `GRAPH` |
| `MANIFOLD_EMBEDDING` | `TOPOLOGY` |
| `SPATIAL_REGION` | `FIELD` |
| `TEMPORAL_TRAJECTORY` | `TEMPORAL` |
| `HIERARCHICAL_SPACE` | `HIERARCHICAL` |
| `MULTISCALE_FIELD` | `FREQUENCY` |

`DENSITY_FIELD` remains in `DISTRIBUTION` as a search/organization category because bivariate empirical bin mass is distributional, but family-specific univariate-distribution evidence is no longer allowed to inflate its structure score. Its density-task credit comes from the explicit `binned-empirical-mass` capability and `empirical-bivariate-bin-mass` information contract.

### Mechanical safeguards

R6B:

1. introduces `CANDIDATE_TO_REASONING_FAMILY` as the canonical single-valued assignment;
2. makes `FAMILY_TO_CANDIDATE_IDS` contain every semantic candidate exactly once;
3. makes `BootstrapFitnessModel.evaluate()` fail closed when given a candidate/family pair that disagrees with the canonical assignment;
4. gates family-specific structure evidence by the candidate capability that gives that evidence meaning (`cluster-partition`, `univariate-distribution`, `periodic-spectrum`, etc.);
5. leaves requirement/task coverage capability-driven, so a temporal trajectory can still satisfy periodicity without being relabelled as a frequency-family candidate;
6. removes duplicate family-generated layout variants from bootstrap search without changing candidate payload or renderer authority;
7. keeps all numeric bootstrap weights unchanged.

### Treatment identity

This is intentionally rank-effective. The treatment therefore advances to:

- `BOOTSTRAP_FITNESS_MODEL_VERSION = bootstrap-fitness-v3`;
- `FITNESS_TREATMENT_ID = fitness-treatment-v3`.

The treatment change means “same numeric weights, corrected candidate-family admissibility and family-evidence applicability.” Historical decisions retain their recorded v1/v2 identity; no old provenance is rewritten.

### R6B falsifiers

Tests must prove:

- all semantic candidates occur exactly once across `FAMILY_TO_CANDIDATE_IDS`;
- invalid family/candidate scoring throws rather than silently receiving a neutral or favorable score;
- measured cluster evidence cannot score `DENSITY_FIELD` under `CLUSTER` because that pair is inadmissible;
- measured high-variance/outlier evidence does not award `DENSITY_FIELD` the `DISTRIBUTION` family boost reserved for `univariate-distribution` capability;
- a configured `CLUSTER` family preference cannot raise a density candidate's prior;
- periodicity task coverage for `TEMPORAL_TRAJECTORY` remains intact through its explicit `periodic-spectrum` capability;
- bootstrap search emits density only as `DISTRIBUTION/GRID_3D`, relationship graph only through the `GRAPH` family, and temporal trajectory only through the `TEMPORAL` family.

**Exit:** exact-head CI/CodeQL/governance plus independent post-review prove that unsupported family credit and duplicate family variants are removed, with the treatment-version change visible in provenance.

## Stop gate before R2D

Do not begin Cluster Regions production migration until R6B has merged and its exact-head review passes.

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
- no numeric weight tuning disguised as ontology cleanup.

## Required adversarial questions

1. Is a table expressing compatibility, reasoning membership, or analytical authority? The name/type/test must make that explicit.
2. Can one layout be shared by multiple families without implying shared semantic geometry?
3. Can one candidate gain unsupported structure score merely by appearing under a family label?
4. Does any rank-effective change mint a new treatment/version identity?
5. Does cross-task usefulness come from explicit candidate capabilities rather than duplicate family aliases?
6. Does semantic candidate/payload identity remain authoritative through bootstrap, learned runtime, Worker/WASM and renderer dispatch?

## Model routing

- **R6A:** Balanced/high implementation; Frontier/high post-review.
- **R6B:** Frontier/high or xhigh because membership is rank-effective and can change scientific recommendation semantics.
- **R2D:** Frontier/xhigh for cluster-evidence scientific contract and production cutover.

Exact-head tests and treatment-version evidence remain authoritative regardless of model choice.
