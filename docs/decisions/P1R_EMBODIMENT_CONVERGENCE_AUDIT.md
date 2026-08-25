# Decision Record: P1-R Representation Embodiment Convergence Audit

## Status
**ACCEPTED / IMPLEMENTED**

## Context
In Nemosyne's spatial analytical architecture, Moneta arbitrates between semantic representation candidates (e.g. `POINT_SET`, `DENSITY_FIELD`, `CLUSTER_REGIONS`, `AGGREGATE_VOLUME`, `TEMPORAL_TRAJECTORY`, `HIERARCHICAL_SPACE`, `RELATIONSHIP_GRAPH`, `MULTISCALE_FIELD`, etc.).

Prior to this decision, several non-point semantic candidates silently fell back to generic point-per-row geometry (`INSTANCED_POINT_CLOUD` or discrete meshes per row) when rendered by `VRTopologyTranslator` and `ScalableTopologyEmbodiment`. This compromised spatial fitness by collapsing semantically distinct representations into minor variations of 3D scatterplots and risked GPU memory exhaustion on large datasets by generating $O(N)$ geometry for aggregation and density tasks.

## Invariants & Governing Policies

1. **No Silent Point Fallbacks**: Non-point candidates (aggregates, density fields, cluster volumes) must NEVER silently fall back to point-cloud or point-per-row rendering. If an embodiment cannot be rendered, it must fail closed with an explicit error.
2. **Bounded Geometry Scaling**: Aggregates, cluster volumes, and density fields must emit bounded visual geometry proportional to $O(\text{groups})$, $O(K)$, or $O(\text{bins})$, completely decoupled from source row count $N$.
3. **Progressive Disclosure**: Individual observation markers are a detail layer accessed via drill-down/inspection, not the universal default primitive for all semantic tasks.
4. **Visibly Distinct Embodiments**: Plausible candidate families must produce visually and interactively distinct spatial structures with appropriate metadata, geometry, and affordances.

## Full Candidate Audit & Classification Matrix

| Candidate ID | Family | Semantic Goal | Embodiment Geometry & Layout | Bounded Geometry Count | Classification |
|---|---|---|---|---|---|
| `POINT_SET` | `POINT` | Discrete observations | `INSTANCED_POINT_CLOUD` / `CUBE_MATRIX` on `GRID_3D` | $O(N)$ (Intended for point detail) | **Faithful** |
| `TEMPORAL_TRAJECTORY` | `TEMPORAL` | Chronological sequence | `BEAM` / Ribbon mesh on `TIME_RIBBON` | $O(\text{series\_steps})$ | **Faithful** |
| `HIERARCHICAL_SPACE` | `HIERARCHICAL` | Tree hierarchy & parent-child | `CONICAL_TREE` on `RADIAL_ORBITAL` + parent links | $O(\text{nodes} + \text{edges})$ | **Faithful** |
| `RELATIONSHIP_GRAPH` | `GRAPH` | Relational network topology | `ICOSA_NODE` on `FORCE_DIRECTED_3D` + edge lines | $O(\text{nodes} + \text{edges})$ | **Faithful** |
| `SPATIAL_REGION` | `FIELD` | Geospatial/flow coordinates | `GEO_COLUMN` on `GEO_SURFACE`, `FLOW_RAY` on `VECTOR_STREAMLINE` | $O(\text{regions} / \text{samples})$ | **Faithful** |
| `MULTISCALE_FIELD` | `FREQUENCY` | Harmonic frequency spectrum | `SPECTRAL_BAR` / `SPECTRAL_SURFACE` on `SPECTRAL_VOLUME` | $O(\text{harmonics})$ | **Faithful** |
| `AGGREGATE_VOLUME` | `CLUSTER` / `DISTRIBUTION` | Group metrics & summary volume | `AGGREGATE_BARS` (Cylinders on `GEO_SURFACE` or Pillars on `GRID_3D`) | $O(\text{categories})$ | **Faithful (Elevated)** |
| `CLUSTER_REGIONS` | `CLUSTER` | Cluster hulls & partitions | `CLUSTER_VOLUME` (Volumetric transparent bounding hulls & centroids) | $O(K\text{ clusters})$ | **Faithful (Elevated)** |
| `DENSITY_FIELD` | `DISTRIBUTION` | Continuous population density | `DENSITY_FIELD` (3D Voxel density grid / isosurfaces) | $O(\text{bins}^3)$ | **Faithful (Elevated)** |
| `DISTRIBUTION_FIELD` | `DISTRIBUTION` | Univariate / bivariate distributions | `AGGREGATE_BARS` / `DENSITY_FIELD` (Histogram volume / density binning) | $O(\text{bins})$ | **Faithful (Elevated)** |
| `MATRIX_FIELD` | `POINT` | Multivariate matrix correlation | `CUBE_MATRIX` on `GRID_3D` | $O(R \times C)$ | **Faithful** |
| `MANIFOLD_EMBEDDING` | `TOPOLOGY` | Continuous manifold structure | `ICOSA_NODE` on `FORCE_DIRECTED_3D` with topological edge skeleton | $O(\text{skeleton\_nodes})$ | **Faithful** |

---

## Technical Implementations

1. `ScalableTopologyEmbodiment.ts`:
   - Replaced silent point fallback in `buildAggregateBars` with native 3D grid aggregate pillars.
   - Added `buildDensityField` for continuous 3D density voxel volumes.
   - Enhanced `buildClusterVolume` to generate cluster hull meshes with centroids across all layouts.
2. `RepresentationGraphRuntimeAdapter.ts` & `types.ts`:
   - Formally registered `DENSITY_FIELD`, `AGGREGATE_BARS`, and `CLUSTER_VOLUME` in `VALID_GEOMETRIES`.
3. Architecture contracts:
   - Added regression suites verifying zero silent fallbacks and bounded primitive generation on $N \ge 10,000$.
