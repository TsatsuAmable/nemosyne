# P1-R Semantic Embodiment Convergence

**Status:** PLANNED / REQUIRED FOR RF-001 + RF-002 CLOSURE  
**Programme:** P1-R Representation embodiment convergence  
**Placement:** after truthful evidence / resource-envelope foundations and before P1-UV can claim the data world itself has visually converged  
**Owns:** RF-001, RF-002; coordinates with RF-029, RF-036, RF-045, RF-050, P1-D, P1-F, P1-UV and P1-U9  
**Blocks:** scientific representation verification, dataset-level visual convergence, final P1-UV data-world acceptance, P1-U9 qualification of the converged representation treatment

## Why this tranche exists

Nemosyne can now reason about dataset-level representation candidates such as density fields, distribution fields, cluster regions, aggregate volumes, temporal trajectories, relationship graphs and multiscale fields. The production embodiment path, however, still has a row-shaped spine.

`VRTopologyTranslator.synthesizeArtifact()` extracts `dataset.rows` / `dataInput.rows` and passes them to the embodiment layer. `TopologyLayoutEmbodiment` and `ScalableTopologyEmbodiment` then compute many representations from observation rows or observation positions in TypeScript. This means a semantically dataset-level Moneta decision can still collapse into a point-per-row or row-derived rendering strategy.

The central failure mode is:

```text
semantic dataset representation chosen by Moneta
                    ↓
               raw rows
                    ↓
        TypeScript row traversal
                    ↓
        observation positions
                    ↓
     approximate/reconstructed structure
                    ↓
               Three.js
```

The target architecture is:

```text
canonical Rust dataset capability
                    ↓
     Rust analytical representation builder
                    ↓
 bounded, versioned, provenance-bearing
       SemanticEmbodimentPayload
                    ↓
      WASM / Worker transport boundary
                    ↓
       thin Three.js embodiment adapter
                    ↓
       spatial representation artifact
```

Observation rows remain available only when the selected representation or an explicit progressive-disclosure/drill-down request requires observation identity or exact datum access.

## Governing invariant

> **Three.js must not receive or traverse raw dataset rows to construct a non-observation representation. Rust/WASM produces bounded semantic embodiment payloads; JavaScript/Three.js embodies those payloads. Point-per-observation geometry is permitted only when Moneta explicitly selects observation-level representation or progressive disclosure requests observation detail.**

This is both an authority boundary and a product boundary. It prevents JavaScript from becoming a second analytical reduction engine and makes the visible world correspond to the representation Moneta actually chose.

## Architectural principles

1. **Representation is not layout.** A dataset-level semantic representation is an analytical object with declared meaning, not merely a different arrangement of row marks.
2. **Rust derives; Three.js embodies.** N-dependent aggregation, density estimation, clustering summaries, distribution statistics, spectral summaries and other data-derived reductions remain Rust-owned.
3. **Payloads are bounded by representation complexity, not source N.** Large source datasets must not imply point-per-row transfer or render-object growth.
4. **Observation identity is a drill-down capability.** Exact rows/observations remain accessible when the task needs them, but are not the universal geometry substrate.
5. **No mega-payload god object.** Use a versioned discriminated envelope with representation-specific payload types and builders rather than a giant bag of optional fields.
6. **No renderer god class.** Split thin embodiment adapters by semantic payload/family; do not move all construction into a larger `VRTopologyTranslator` or successor.
7. **No second scientific authority.** TypeScript may transform coordinates/material parameters needed purely for presentation, but may not recompute analytical facts or reductions from rows.
8. **Meaning is provenance-bound.** Every payload states the analytical method, parameters, source dataset identity, approximation/reduction mode, kernel/model versions and information-loss contract needed to interpret it.
9. **Unknown remains unknown.** A missing Rust-derived structure may not be replaced by a plausible TypeScript heuristic merely to produce attractive geometry.
10. **Fidelity before spectacle.** If the mathematics for a declared candidate is not implemented, narrow/reclassify the candidate rather than render a suggestive approximation under an overstrong label.

## Non-goals

This programme does not:

- remove point representations from Nemosyne;
- require every dataset to become a continuous field;
- pull P2 RepresentationGraph/compositional search into P1;
- add open-ended generative geometry;
- move Moneta decision authority into Rust if the existing bounded Moneta control-plane boundary remains sound;
- force all presentation-coordinate transforms into Rust;
- require GPU compute as an architectural prerequisite;
- create a universal one-size-fits-all semantic payload;
- make physical Quest performance claims from static resource estimates or desktop tests.

## Current production defects being closed

### RF-001 — representation authority

Current `VRTopologyTranslator` feeds rows into non-point embodiment. `ScalableTopologyEmbodiment.buildDensityField`, `buildClusterVolume` and `buildAggregateBars` derive data-level structure from row/position traversal in TypeScript. Bounded mesh count therefore does not prove Rust-owned bounded analytical reduction.

### RF-002 — representation fidelity

The current density embodiment is a fixed 6×6×6 histogram over rendered positions while the semantic ontology describes continuous density estimation. `DISTRIBUTION_FIELD` is mapped to the same density geometry despite declaring statistical distribution contours/quantiles/PDF semantics. Other candidate descriptions and preservation claims must also be checked against their actual mathematics.

## Target semantic payload architecture

Introduce one small versioned envelope, conceptually:

```text
SemanticEmbodimentPayloadV1
  schemaVersion
  datasetFingerprint
  candidateId
  representationFamily
  analyticalMethod
  parameters
  approximation
  informationContract
  provenance
  payload: one of
    ObservationSetPayload
    DensityFieldPayload
    DistributionPayload
    ClusterRegionsPayload
    AggregateVolumePayload
    TemporalTrajectoryPayload
    RelationshipGraphPayload
    HierarchyPayload
    SpatialRegionPayload
    MultiscaleFieldPayload
    ...only when scientifically implemented
```

The exact Rust module/file layout should be chosen during implementation after inspecting existing `wasm/src/moneta/{types,evidence,solver}.rs`, analytical kernels and ABI conventions. Prefer representation-specific modules/builders with shared compact envelope/provenance types. Do not create `semantic_embodiment.rs` as a new multi-thousand-line god module.

Each concrete payload must define:

- semantic candidate/family identity;
- source dataset canonical fingerprint;
- bounded primitive/element count and cardinality relationship;
- coordinate/reference-space semantics;
- exact analytical method and parameters;
- approximation/reduction/sampling mode where applicable;
- source/measurement fidelity for consumed evidence;
- information preserved and intentionally lost;
- stable semantic IDs for regions/groups/structures where drill-down requires them;
- enough lineage information to request observation detail without carrying all rows;
- kernel/algorithm/schema version;
- deterministic serialization or an explicitly governed deterministic binary representation.

## Tranche sequence

### P1-R0 — production-path falsifier and representation inventory

**Purpose:** prove the defect mechanically before changing architecture and establish a finite migration inventory.

- [ ] inventory every `SemanticRepresentationId` and every `VRLayout`/`VRGeometry` currently reachable from production Moneta decisions;
- [ ] trace each candidate through `MonetaHypothesisEngine` / decision embodiment → runtime translation → `VRTopologyTranslator` → `ScalableTopologyEmbodiment` / `TopologyLayoutEmbodiment` → rendered artifact;
- [ ] classify each current representation as `OBSERVATION_LEVEL`, `DATASET_LEVEL_VALID`, `DATASET_LEVEL_ROW_DERIVED`, `SEMANTICALLY_OVERCLAIMED`, or `NOT_PRODUCTION_REACHABLE`;
- [ ] add an architecture/source falsifier proving that non-observation production embodiment currently depends on `dataset.rows` or row-derived positions;
- [ ] record current source-N → transferred-elements → rendered-primitives behavior for representative point, aggregate, density, cluster, temporal and graph cases;
- [ ] establish small canonical fixtures whose expected analytical representation can be independently calculated.

**Exit gate:** every production candidate has a known real call path, mathematical status and row/materialisation profile. The test suite would fail if a supposedly migrated non-observation representation silently reintroduced raw-row construction.

### P1-R1 — versioned semantic embodiment payload contract

**Purpose:** establish the boundary before moving algorithms.

- [ ] define the versioned discriminated Rust-owned payload envelope and representation-specific payload types;
- [ ] separate common provenance/identity metadata from representation-specific analytical content;
- [ ] define hard size/resource bounds for each payload family and how refusal/approximation is represented;
- [ ] define stable semantic region/group/structure IDs sufficient for selection, evidence linkage and later observation drill-down;
- [ ] ensure payload identity binds canonical dataset fingerprint + candidate + method/parameters + relevant evidence/model versions;
- [ ] define representation information-preservation/loss metadata from the reviewed candidate ontology;
- [ ] define fail-closed handling for unknown future payload versions and unsupported candidate/payload combinations;
- [ ] add Rust serialization/golden tests and TS/WASM decoding parity tests before migrating builders.

**Exit gate:** one compact payload can cross Rust/WASM/Worker/TypeScript without rows, preserve semantic/provenance identity and reject unsupported/mismatched versions deterministically.

### P1-R2 — Rust-owned dataset-level representation builders

**Purpose:** move the actual analytical reduction to the analytical authority.

Implement in vertical slices. Each slice gets its own focused PR and mathematical/reference tests.

#### R2A Aggregate volume

- [ ] move grouping/binning/aggregate computation out of `ScalableTopologyEmbodiment.buildAggregateBars` into Rust;
- [ ] support explicitly declared aggregate functions only; do not infer a default measure silently;
- [ ] preserve zero, missingness and measurement semantics;
- [ ] emit bounded group IDs, positions/placement semantics where analytically defined, aggregate values, counts and provenance;
- [ ] prove TypeScript receives no source rows for the aggregate representation.

#### R2B Distribution representation

- [ ] separate `DISTRIBUTION_FIELD` from density geometry;
- [ ] decide the truthful P1 mathematical object: e.g. histograms/ECDF/quantile surfaces or another explicit reviewed representation;
- [ ] implement its statistics in Rust and name it according to the mathematics actually supplied;
- [ ] record binning/quantile/interpolation parameters and information loss;
- [ ] do not claim continuous PDF/contours unless an actual governed estimator produces them.

#### R2C Density field

- [ ] replace the fixed TypeScript 6³ position histogram with a Rust-owned density representation;
- [ ] explicitly choose and document the P1 estimator (e.g. governed voxel density vs KDE/other estimator) and narrow the ontology if the implementation is discrete voxel density rather than continuous KDE;
- [ ] bind coordinate dimensions, bandwidth/binning/resolution, normalization and boundary policy;
- [ ] apply resource-envelope limits before expensive estimation;
- [ ] emit bounded cells/isosurface-ready samples or another renderer-neutral compact field payload.

#### R2D Cluster regions

- [ ] consume authoritative clustering results/evidence rather than categoricals or presentation positions as a substitute for discovered clusters;
- [ ] emit cluster IDs, sizes, centroids and a scientifically honest region/boundary representation;
- [ ] distinguish convex/spherical/bounding approximations from actual cluster support and record the boundary method;
- [ ] preserve excluded/unassigned observations and uncertainty/unknown states explicitly.

#### R2E Structural families

- [ ] converge relationship graph/hierarchy/temporal/geospatial/spectral payloads on the same authority rule;
- [ ] where existing Rust-backed layout/evidence already exists, adapt it rather than recomputing in TypeScript;
- [ ] ensure graph edges, hierarchy parents, temporal ordering and geospatial coordinates retain authoritative semantics;
- [ ] review `MANIFOLD_EMBEDDING`, `MULTISCALE_FIELD` and other advanced candidates: implement the claimed mathematics or mark/defer them rather than producing point-like geometry under a stronger semantic name.

**Exit gate:** every migrated dataset-level candidate is computed from the canonical Rust dataset capability and returns a bounded semantic payload whose mathematical contract matches the candidate label.

### P1-R3 — ABI/Worker authority cutover

**Purpose:** make the new boundary the real production path.

- [ ] add handle-native representation-building calls using the canonical Atlas/Rust dataset capability;
- [ ] keep large source data resident in Rust/Worker; transfer only bounded semantic payloads plus identifiers needed for drill-down;
- [ ] fence payloads by dataset generation/fingerprint, decision identity and request generation so stale representation results cannot commit;
- [ ] propagate typed resource refusal and analytical failure rather than falling back to JavaScript row reduction;
- [ ] integrate RF-029/RF-035/RF-051 transfer/memory measurement so semantic payloads actually reduce browser-side N-dependent materialisation;
- [ ] add architecture policy forbidding `dataset.rows` / raw-row traversal in non-observation embodiment modules and production translator paths;
- [ ] ensure legacy compatibility paths are explicitly isolated and cannot silently become the default.

**Exit gate:** production non-observation representation generation has no row-major JS fallback and no hidden O(N) TypeScript reduction. Failure/refusal remains explicit.

### P1-R4 — thin Three.js semantic embodiment adapters

**Purpose:** make the renderer consume meaning rather than rediscover it.

- [ ] replace the row-first translator contract with payload-first dispatch;
- [ ] split rendering by payload/family into small adapters instead of expanding `VRTopologyTranslator` or `ScalableTopologyEmbodiment` into new god classes;
- [ ] restrict adapters to geometry/material construction, presentation-only transforms, interaction hit targets and visual state derived directly from payload fields;
- [ ] forbid analytical grouping, density estimation, clustering inference, statistical aggregation and source-row scans in renderer adapters;
- [ ] keep interaction semantics bound to stable semantic IDs, not transient mesh indexes;
- [ ] make artifact metadata record payload identity and semantic object IDs for evidence/provenance inspection;
- [ ] preserve render primitive budgets independently of source N.

**Exit gate:** deleting access to raw rows from a non-observation adapter does not reduce its functionality. The adapter can render entirely from a bounded semantic payload.

### P1-R5 — progressive disclosure: structure → region/group → observation → datum

**Purpose:** retain exact observations without making them the universal world geometry.

Canonical detail hierarchy:

```text
investigation
  → dataset representation
    → semantic structure / region / group
      → observation subset
        → exact datum / provenance
```

- [ ] make Moneta `AnalyticalIntent.observationLevel` and information-preservation requirements drive whether observations are primary or deferred;
- [ ] treat `POINT_SET`/observation-level geometry as a valid explicit candidate, not the default substrate for every candidate;
- [ ] add drill-down APIs that request observation IDs/compact views for a selected semantic region without rematerialising the whole dataset;
- [ ] reveal individual points only within bounded selected/focused regions or when an observation-level task requires them;
- [ ] preserve semantic selection while transitioning between dataset-level and observation-level detail;
- [ ] integrate P1-F focus/context and semantic targeting so coarse structures and observations share stable lineage;
- [ ] make the reverse path explicit: observation → containing region/cluster/structure → dataset overview;
- [ ] record drill-down as presentation/navigation state unless it changes scientific investigation semantics.

**Exit gate:** an investigator can begin with dataset structure, drill into a meaningful region/group, reveal observations on demand and inspect exact data without losing context or forcing the entire dataset into point geometry.

### P1-R6 — candidate ontology/fidelity reconciliation

**Purpose:** ensure the words Moneta uses match the mathematics and geometry actually available.

- [ ] re-audit every `RepresentationCandidate.supports`, `preserves`, `loses`, scale envelope and description against the new payload mathematics;
- [ ] split candidates that currently share geometry but have materially different statistical meaning;
- [ ] rename/narrow any candidate whose implementation is a surrogate (e.g. voxel occupancy/density vs continuous KDE);
- [ ] review `geometryForLayout` so candidate semantics cannot collapse merely because two candidates share a layout;
- [ ] make candidate → payload-kind compatibility explicit and mechanically checked;
- [ ] update Moneta hard constraints/ranking only after the representation truth contract is settled; do not snapshot-bless changed rankings;
- [ ] preserve RF-045 source/fidelity semantics and RF-036 canonical topology authority;
- [ ] add adversarial cases where a candidate label would be misleading unless required analytical evidence exists.

**Exit gate:** candidate names, preservation claims and UI explanations are true of the payload actually rendered. No two semantically different candidates are silently treated as the same representation solely because they share a Three.js layout.

### P1-R7 — product, scale and perceptual evidence

**Purpose:** prove that the architecture change actually produces dataset-level visualisation and improves the product without violating device budgets.

- [ ] add canonical product fixtures that demonstrate at least point, aggregate, distribution/density, cluster and one structural/temporal family through the real production path;
- [ ] capture deterministic before/after visual evidence showing point-per-row overview replaced by dataset-level structure where Moneta selects it;
- [ ] assert source-N independence of transferred/rendered element counts for bounded representation families;
- [ ] measure Rust compute, Worker transfer bytes, JS heap/GC, render object count, draw calls and frame time at representative scales;
- [ ] validate Moneta decision → payload candidate identity → artifact identity end to end;
- [ ] connect P1-D perceptual evidence to the reviewed real embodiment, not a toy/legacy point substitute;
- [ ] exercise progressive disclosure and semantic selection under Playwright/IWER where applicable;
- [ ] leave Quest-specific optics, sustained frame pacing, interaction comfort and device memory qualification to P1-U9/PERF-04 while feeding it the converged representation treatment.

**Exit gate:** real product evidence shows that dataset-level candidates become visibly distinct dataset-level representations, observation detail appears only when semantically requested, and bounded payload/render complexity agrees with scale/resource claims.

## Candidate-specific acceptance examples

These are acceptance shapes, not mandates for exact visual styling.

| Candidate | P1 semantic payload expectation | Forbidden shortcut |
| --- | --- | --- |
| `POINT_SET` | bounded observation marks/IDs with explicit observation-level intent | pretending points are another dataset-level representation |
| `AGGREGATE_VOLUME` | Rust group/bin summaries + aggregate values/counts | JS grouping over `dataset.rows` |
| `DISTRIBUTION_FIELD` | explicit Rust distribution summary (histogram/ECDF/quantiles/etc. as governed) | reusing density voxels while claiming PDF/quantiles |
| `DENSITY_FIELD` | governed Rust field estimator/samples + parameters | 6³ JS histogram over rendered point positions |
| `CLUSTER_REGIONS` | authoritative cluster summaries + honest boundary approximation | grouping by first categorical column as discovered clusters |
| `RELATIONSHIP_GRAPH` | authoritative nodes/edges + structural semantics | rebuilding topology from presentation hints |
| `TEMPORAL_TRAJECTORY` | authoritative ordered temporal samples/segments or bounded summaries | relying on input row order |
| `HIERARCHICAL_SPACE` | authoritative parent/child/depth structure | deriving hierarchy from mesh arrangement |
| `SPATIAL_REGION` | authoritative spatial coordinates/regions | generic x/y columns masquerading as geography |
| `MULTISCALE_FIELD` | explicit governed spectral/multiscale output | bars made from ordinary rows under a spectral label |

## Dependency ordering

1. **RF-045 and RF-036 truth/authority foundations** must remain intact; payloads cannot be more trustworthy than the evidence they consume.
2. **R0 + R1** establish the production falsifier and boundary contract before algorithm migration.
3. **R2** proceeds in vertical candidate slices, beginning with the simplest high-value bounded dataset-level forms (aggregate plus a truthfully named distribution/density slice).
4. **R3** makes each migrated slice the production authority before the next slice is called complete.
5. **R4** follows each payload slice immediately; do not accumulate a hidden Rust API with the old row renderer still active.
6. **R5** can begin once stable semantic IDs and at least one dataset-level payload exist.
7. **R6** must close before representation correctness is considered verified and before Moneta/UI explanations are frozen.
8. **R7** supplies product/scale evidence and feeds P1-D, P1-UV and ultimately U9 device qualification.

## Relationship to P1-UV

P1-UV fixes how the investigator experiences the product. P1-R fixes what the data world *is*.

P1-UV may continue shell hierarchy, contextual task surfaces, accessibility and other work that does not depend on final representation geometry. However:

- P1-UV may not declare the data world visually converged while the primary representation is still a row-first point cloud for a dataset-level Moneta candidate;
- UV3/UV5 state legibility must bind to semantic payload/structure identity where relevant;
- UV7 before/after evidence must include at least one dataset-level representation produced through the P1-R boundary;
- P1-U9 must qualify the P1-R + P1-UV converged treatment, not the legacy point-first renderer.

## Relationship to P1-D perceptual fitness

P1-D can only measure the perceptual fitness of the representation Nemosyne genuinely implements. After P1-R:

- perceptual evidence keys to payload/candidate/embodiment identity;
- occlusion/crowding/legibility measurements are taken over the real aggregate/field/region/graph/etc. embodiment;
- Moneta does not rank a semantic candidate using perceptual measurements from a materially different point substitute.

## Relationship to scale architecture

P1-R is a direct consumer of RF-029/RF-035/RF-051 lessons.

Required scale invariant:

> For a bounded dataset-level representation, source row count may increase without forcing proportional JavaScript row transfer, JavaScript analytical traversal or rendered-object growth.

Any representation whose payload is inherently O(N) must say so explicitly and must be selected only when observation-level identity is required and the device/resource envelope permits it.

## Verification strategy

For each vertical representation slice use the cheapest authoritative proof:

- Rust unit/property/metamorphic tests for the analytical builder;
- mathematical/reference fixtures for candidate semantics;
- Rust serialization and cross-language golden vectors for payload contracts;
- WASM/Worker boundary tests proving handle-native source ownership and no raw-row fallback;
- architecture-policy/source tests preventing non-observation row traversal in renderer modules;
- browser product tests proving Moneta candidate → payload → visible artifact identity;
- scale tests asserting transfer/render complexity against source N;
- P1-D perceptual tests over the real embodiment;
- IWER/Quest evidence only for claims that depend on spatial interaction/device characteristics.

## PR slicing guidance

Prefer small vertical PRs that each leave one candidate working end to end:

1. R0 inventory/falsifier + R1 envelope scaffold;
2. aggregate payload Rust builder + ABI + renderer cutover;
3. distribution payload + ontology correction + renderer;
4. density payload + ontology correction + renderer;
5. cluster payload + renderer;
6. structural/temporal families in bounded slices;
7. observation drill-down/progressive disclosure;
8. final candidate ontology audit + product/performance evidence.

Do not merge a broad Rust payload framework with no production consumer and call RF-001 advanced. Conversely, do not rewrite renderer geometry without moving the analytical derivation to Rust.

## Completion rule

P1-R becomes `VERIFIED COMPLETE` only when all of the following are true:

- RF-001 has no production non-observation raw-row analytical/embodiment path;
- RF-002 candidate semantics match implemented mathematics and declared information preservation/loss;
- dataset-level candidates cross the Rust/WASM/Worker boundary as bounded semantic payloads;
- Three.js adapters are presentation-only and small enough to review independently;
- point-per-observation geometry appears only for explicit observation-level intent/detail;
- progressive disclosure preserves semantic identity and provenance;
- product-path tests demonstrate visibly distinct dataset-level representations;
- measured transfer/memory/render complexity supports the claimed scale envelope;
- P1-D perceptual evidence has been re-bound to the real embodiments;
- independent adversarial review fails to find a semantic candidate silently collapsing back to point/row-derived geometry.
