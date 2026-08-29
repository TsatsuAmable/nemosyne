# Stream A A2 Representation Inventory and Row-First Falsifier

**Date:** 29 August 2026  
**Base:** `main@e8d01d060cc0c1fff437397884b881558a8e7750` (#528 merged)  
**Status:** IMPLEMENTATION LANDED ON BRANCH / REVIEW ACTIVE  
**Stream:** A — Analytical Scale & Representation Authority  
**Checkpoint:** A2 — P1-R0 production-path inventory and row-first falsifier

## Purpose

A2 turns the P1-R semantic embodiment concern into a mechanical inventory before any renderer/ABI rewrite.

The production path under review is:

```text
Moneta candidate / RepresentationDecision
  -> DecisionEmbodiment
  -> MonetaTopologyNode
  -> VRTopologyTranslator
  -> ScalableTopologyEmbodiment or TopologyLayoutEmbodiment
  -> Three.js artifact
```

The governing invariant remains:

> Three.js must not receive or traverse raw dataset rows to construct a non-observation representation. Rust/WASM produces bounded semantic embodiment payloads; JavaScript/Three.js embodies those payloads. Point-per-observation geometry is permitted only for explicitly observation-level representation or progressive disclosure requesting observation detail.

A2 does not migrate a renderer. It establishes the current truth and a falsifier that A3/A4 can turn green representation by representation.

---

## A1 handoff

A1 exact-head evidence at `afb68250707d2b7b7a4c4035d4f585bfa8450c68` passed both the isolated resource-envelope workflow and ordinary CI before #528 merged as `e8d01d060cc0c1fff437397884b881558a8e7750`.

The most decision-relevant measurements were:

| Rows | Worker execution | Browser Worker-port span | Port minus Worker | Controller | Render settlement | Rendered node meshes | Render calls | Derived terminal |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1k | 34.6 ms | 301.5 ms | 266.9 ms | 337.6 ms | 502.1 ms | 1,000 | 1,024 | completed |
| 8k | 146.4 ms | 803.1 ms | 656.7 ms | 876.0 ms | 1,854.3 ms | 8,000 | 4,304 | refused |
| 32k | 542.8 ms | 934.0 ms | 391.2 ms | 1,158.3 ms | 385.6 ms | 1 | 83 | refused |

This identifies two distinct seams:

1. **Presentation threshold cliff:** 8k is materially worse than 32k after the latter switches to compact presentation. This reinforces RF-001/P1-R rather than selecting another Rust-kernel optimization.
2. **Browser-observed Worker-port gap:** Worker-internal execution is substantially smaller than the browser-observed port span, especially at 8k. Transfer/queue/adoption/main-thread work remains part of RF-029/RF-051 measurement, not a reason to blame the Rust kernel generically.

A1 limitations remain explicit: exact structured-clone bytes, Worker GC and browser process RSS were not measured. The retained page-heap deltas came from sequential replacement scenarios and are not clean absolute per-size residency numbers.

---

## Pre-implementation adversarial contract

### Authority being examined

- Moneta candidate ontology and candidate reachability;
- bootstrap and learned `DecisionEmbodiment` construction;
- `VRTopologyTranslator` routing;
- scalable and layout embodiment builders;
- rendered Three.js primitive count/meaning.

### Primary failure modes

1. calling a bounded renderer a semantic analytical implementation when it still derives meaning from raw rows in TypeScript;
2. candidate semantics being lost between Moneta decision and renderer geometry;
3. ontology entries that cannot actually be selected in the production decision generator;
4. suggestive geometry carrying stronger names than the mathematics actually computed;
5. a future A3/A4 migration being declared complete while the renderer can still reach source rows.

### Duplicate-authority risk

A2 must not introduce another representation solver, aggregation implementation, density implementation, clustering implementation or layout authority. Tests inspect and exercise the existing path only.

### Falsifying evidence required

- exhaustive coverage of all `SemanticRepresentationId` values;
- reachability derived from the live `FAMILY_TO_CANDIDATE_IDS` map;
- a raw-row sentinel passed into the real `VRTopologyTranslator` path;
- representative source-N versus rendered-primitive checks for point, aggregate, cluster and density geometry;
- source-linked checks that distinguish bootstrap candidate-aware embodiment from learned-runtime layout-only embodiment.

### Explicitly out of scope

- semantic payload ABI design (A3);
- aggregate Rust implementation/cutover (A4);
- broad Worker protocol redesign;
- visual styling or P1-UV work;
- final device qualification.

---

## Production inventory

| Candidate | Classification | Production reachable? | Current renderer | Current semantic truth |
| --- | --- | --- | --- | --- |
| `POINT_SET` | `OBSERVATION_LEVEL` | yes | grid / point geometry | one raw-row-derived mark per observation |
| `DENSITY_FIELD` | `SEMANTICALLY_OVERCLAIMED` | yes | `buildDensityField` | fixed 6×6×6 voxel histogram over row-derived layout positions, not a governed continuous-density payload |
| `DISTRIBUTION_FIELD` | `SEMANTICALLY_OVERCLAIMED` | yes | `buildDensityField` | aliases the density voxel renderer; no quantiles/PDF/contour payload reaches Three.js |
| `CLUSTER_REGIONS` | `DATASET_LEVEL_ROW_DERIVED` | yes | `buildClusterVolume` | TS groups row-derived positions and constructs bounding spheres |
| `AGGREGATE_VOLUME` | `NOT_PRODUCTION_REACHABLE` | **no** | `buildAggregateBars` exists | renderer groups/averages raw rows, but candidate generation currently never emits `AGGREGATE_VOLUME` |
| `TEMPORAL_TRAJECTORY` | `DATASET_LEVEL_ROW_DERIVED` | yes | `buildTimeRibbon` | TS constructs per-series tubes from rows |
| `HIERARCHICAL_SPACE` | `DATASET_LEVEL_ROW_DERIVED` | yes | `buildRadial` | row-derived radial nodes and parent-index edges |
| `RELATIONSHIP_GRAPH` | `DATASET_LEVEL_ROW_DERIVED` | yes | `buildForceDirected` | row/edge inputs become observation nodes plus edges |
| `MATRIX_FIELD` | `OBSERVATION_LEVEL` | yes | grid | one row-derived mark per observation |
| `MANIFOLD_EMBEDDING` | `SEMANTICALLY_OVERCLAIMED` | yes | force/grid family layout | no manifold-coordinate payload reaches the renderer |
| `SPATIAL_REGION` | `OBSERVATION_LEVEL` | yes | geo columns | geospatial one-row-per-observation mapping |
| `MULTISCALE_FIELD` | `SEMANTICALLY_OVERCLAIMED` | yes | spectral/time family layout | no governed multiscale/wavelet payload reaches the renderer |

There are currently **zero** `DATASET_LEVEL_VALID` candidates under the P1-R invariant.

---

## Material findings

### A2-F1 — High — the translator has a global raw-row funnel

`VRTopologyTranslator.synthesizeArtifact()` resolves:

```ts
const rows = dataset?.rows ?? dataInput.rows ?? [];
```

before selecting geometry/layout and passes `rows` to both scalable and generic embodiments.

The A2 sentinel test deliberately makes `dataInput.rows` throw. Every currently reachable representation hits that sentinel. Observation-level candidates are allowed to depend on observation rows; non-observation candidates are therefore explicitly classified as row-derived or overclaimed, not migrated.

The same sentinel becomes the migration gate: once A3/A4 changes a candidate to `DATASET_LEVEL_VALID`, its real forced production synthesis must succeed while raw row access throws.

### A2-F2 — High — `AGGREGATE_VOLUME` is an ontology/decision orphan

`MONETA_REPRESENTATION_CANDIDATES` defines `AGGREGATE_VOLUME`, and the renderer implements `AGGREGATE_BARS`, but `FAMILY_TO_CANDIDATE_IDS` does not include `AGGREGATE_VOLUME` in any family.

Therefore bootstrap candidate generation cannot currently select it through the ordinary representation-decision path.

This is directly relevant to A4. The first Rust-owned aggregate vertical slice must not merely make the renderer better; A3/A4 must also establish a truthful production decision route to the aggregate semantic payload.

### A2-F3 — High — learned runtime can discard candidate-specific embodiment semantics

Bootstrap Moneta maps candidate identity into geometry:

- `AGGREGATE_VOLUME -> AGGREGATE_BARS`;
- `CLUSTER_REGIONS -> CLUSTER_VOLUME`;
- `DENSITY_FIELD` / `DISTRIBUTION_FIELD -> DENSITY_FIELD`.

`LearnedMonetaRuntime`, however, currently computes geometry from `winner.layout` alone. It does not accept `candidateId` in `geometryForLayout()`.

A learned winner can therefore collapse a semantically distinct candidate back to generic layout geometry before `MonetaTopologyNode` reaches `VRTopologyTranslator`.

A3 must make semantic candidate/payload identity survive both bootstrap and learned paths. A learned model may change ranking; it may not erase the selected representation's semantic contract.

### A2-F4 — High — bounded mesh count is not semantic authority

Current scalable builders can produce fewer meshes than N:

- aggregate bars are bounded by groups;
- cluster volumes are bounded by discovered groups/clusters;
- density voxels are bounded by 216 bins.

That is useful presentation scaling but is not sufficient to close RF-001/RF-002 because the grouping, averaging, cluster hull construction and voxel counting still happen from raw rows/layout positions in TypeScript.

The A2 test records both properties simultaneously: bounded rendered primitives **and** raw-row dependence.

### A2-F5 — High — several semantic labels exceed the current computation

The clearest overclaims are:

- `DENSITY_FIELD`: ontology says continuous density estimation; renderer performs a fixed voxel count over layout positions;
- `DISTRIBUTION_FIELD`: ontology says contours/quantiles/probability density; renderer uses the same density voxel implementation;
- `MANIFOLD_EMBEDDING`: ontology says dimensionality-reduced manifold coordinates; no manifold payload reaches the renderer;
- `MULTISCALE_FIELD`: ontology says multiscale/wavelet structure; no multiscale/wavelet payload reaches the renderer.

These remain RF-002/P1-R fidelity work. Unknown structure must stay unknown rather than gaining an authoritative-looking geometry label.

---

## Mechanical acceptance tests

`tests/stream-a-a2-representation-inventory.test.ts` enforces four things:

1. **Ontology exhaustiveness:** every semantic candidate must have an inventory entry.
2. **Decision reachability truth:** the inventory must match live `FAMILY_TO_CANDIDATE_IDS`; today the only orphan is `AGGREGATE_VOLUME`.
3. **Raw-row migration sentinel:** `DATASET_LEVEL_VALID` candidates must render through the real translator while raw-row access throws. Current non-migrated candidates deliberately demonstrate their row dependency.
4. **Primitive-shape evidence:** for a deterministic 24-row dataset, current point rendering emits 24 meshes; aggregate and cluster renderers emit 3 group primitives; density emits a positive bounded set of at most 216 voxels. This prevents "bounded output" from being confused with "Rust-owned semantic reduction".

The tests also pin the bootstrap/learned embodiment mismatch so a future fix requires the inventory truth to change with the code.

---

## A2 exit decision

A2 is complete when the inventory/test is green on the exact PR head and ordinary CI/CodeQL/Q9/review state passes.

The expected handoff to A3 is now sharper than the original plan:

1. define a versioned semantic embodiment payload that carries candidate identity independently of layout;
2. make both bootstrap and learned runtime preserve that semantic identity;
3. add a truthful aggregate candidate route before A4 claims a production aggregate vertical slice;
4. keep observation-level row paths explicit and separate from dataset-level payload paths;
5. do not migrate density/cluster/manifold/multiscale as incidental scope in the aggregate slice.

A2 does **not** close RF-001 or RF-002. It converts them from narrative concerns into executable migration gates.

---

## Stream M M3 promotion addendum — 29 August 2026

The production inventory and findings above remain the historical A2 baseline. The live sentinel is advanced by Stream M M3 only after M1/M2 established a distinct contract and Rust/WASM empirical-distribution builder:

| Candidate | Live classification after M3 | Production renderer | Promotion basis |
| --- | --- | --- | --- |
| `AGGREGATE_VOLUME` | `DATASET_LEVEL_VALID` | `buildAggregateBars` | Existing A4 Rust-owned bounded aggregate payload path remains unchanged. |
| `DISTRIBUTION_FIELD` | `DATASET_LEVEL_VALID` | `buildDistributionField` | Explicit measure -> resident Worker/WASM handle -> Rust histogram/ECDF/R7 payload -> row-free thin adapter with stable semantic IDs and provenance. |
| `DENSITY_FIELD` | `SEMANTICALLY_OVERCLAIMED` | `buildDensityField` | Still a row/layout-derived fixed voxel count; no governed continuous-density method exists. |

M3 does not rewrite the original A2 evidence or promote any adjacent family. `tests/stream-a-a2-representation-inventory.test.ts` remains the executable current-state authority: only candidates that succeed with the raw-row sentinel may carry `DATASET_LEVEL_VALID`.
