# Nemosyne Analytics Layer

The current analytics layer turns Nemosyne from a spatial viewer into a spatial analytics workbench. It extracts statistical facts from datasets, runs clustering and anomaly detection, and feeds the results into the Draco v1 Embodiment Engine so VR layout, geometry, behaviour, and interaction adapt to the data. The proposed Atlas layer will own full-dataset analytical guidance and provenance.

---

## Statistical Facts (`ConstraintEngine.extractFacts`)

For every dataset the Draco engine computes:

- **`columnStats`** — per numeric column: `mean`, `median`, `stdDev`, `skew`, `kurtosis`, `min`, `max`.
- **`correlationMatrix`** — Pearson correlation for every numeric column pair.
- **`categoryDistribution`** — top categories with counts/fractions and entropy.
- **`trendDirection`** / **`seasonalityHint`** / **`normalizedSlope`** — temporal trend heuristics.
- **`hasOutliers`** — robust modified Z-score (MAD) outlier flag.
- **`hasHighVariance`**, **`numericSkew`**, **`topCategory`** — summary signals used by soft constraints.

These facts drive new soft constraints:

| Fact | Preferred VR mapping |
|------|------------------------|
| Outliers present | `ORB` geometry with pulsing halo |
| High variance (tabular) | `COLUMN` geometry |
| Strong correlation | `BEAM` geometry |
| Temporal trend | `CHRONO_DIAL` interaction |
| Seasonality hint | `WAVE_OSCILLATION` behaviour |

---

## Clustering Operations (Rust WASM Kernel & `src/atlas/`)

All clustering operations execute in the Rust WASM kernel (`wasm/src/operations.rs`) and return a new dataset with a `_cluster` column, recorded immutably to the Atlas provenance ledger.

| Operation | Method | VR visualisation |
|-----------|--------|------------------|
| `cluster` | k-means with k-means++ seeding | Nested rings (`ClusterTransforms.applyNestedRings`) |
| `hierarchical` | Agglomerative (single/complete/average) | Dendrogram arcs (`applyDendrogramArc`) |
| `dbscan` | Density-based | Density clouds + noise sink (`applyDensityCloud`) |

`Dataset` rows also receive `_meta` on hierarchical and DBSCAN results describing linkage history, eps/minPoints, noise count, etc.

---

## Anomaly Detection (Rust WASM Kernel)

`anomaly` calculates outliers via the WASM kernel and adds `_anomaly` and `_anomalyScore` columns.

| Method | Description |
|--------|-------------|
| `iqr` | Interquartile range; sensitivity scales the whisker distance (default `1.5`). |
| `zscore` | Standard-deviation threshold (default `3`). |
| `isolation` | Lightweight isolation-forest approximation using recursive random splits; score is normalised split depth. |

### VR rendering (`src/vr/interactions/AnomalyTransforms.ts`)

- Outliers receive a pulsing magenta halo (`ensureHalo`) and lift above the dataset.
- `applyOutlierLens` gathers outliers around a focus point (e.g. the user's hand) while dimming non-outliers.
- `updateAnomalyPulse` animates halo scale/opacity each frame.

### Outlier recommender rule

The `ConstraintEngine` already flags `hasOutliers` via a robust MAD-based modified Z-score and prefers `ORB` geometry when outliers are present.

---

## Chart Planes in VR (`ChartPlane.ts`)

`src/vr/artifacts/ChartPlane.ts` renders Canvas 2D plots onto a world-space quad:

| ChartType | Dataset requirement |
|-----------|---------------------|
| `BAR` | Numeric column + optional categorical label |
| `LINE` | Temporal + numeric columns |
| `HISTOGRAM` | Single numeric column |
| `BOX` | Single numeric column (5+ values) |
| `CORRELATION` | Two or more numeric columns |

Chart planes are auto-attached by `VRTopologyTranslator` when the dataset has multiple numeric columns or a temporal column. They update in place when the dataset changes, so they work with live streams and data operations.

The `ConstraintEngine` includes a low-weight `attach_chart_plane_for_rich_numeric_or_time` preference that nudges the solver toward specs compatible with inspection interactions.

---

## TDA Artefacts (Rust WASM & `src/vr/artifacts/TDAPlanes.ts`)

Topological data analysis summaries give analysts a shape-first view of their data without leaving VR.

### Algorithms (Rust WASM Kernel)

| Function | What it computes |
|----------|------------------|
| `compute_mapper_graph` | Approximate Mapper graph: rows are binned by a 1-D filter function, clustered inside each overlapping bin, and connected when clusters share rows. |
| `compute_persistence_intervals` | 0-D persistence intervals for a 1-D filtration; union-find grows components as the filter threshold sweeps outward. |
| `compute_betti_0_curve` | Number of connected components of a VR-style proximity graph as the radius grows. |

### Panels (`src/vr/artifacts/TDAPlanes.ts`)

`buildTDASummaryGroup(dataset, featureColumns, filterColumn)` creates three world-space canvas panels:

| Panel | Visual |
|-------|--------|
| Persistence barcode | Horizontal bars with birth/death ticks; infinite deaths are filtered out of the finite view. |
| Mapper graph | Nodes laid out on a circle ordered by filter centre; edges drawn when bins overlap. |
| Betti-0 curve | Connected-component count vs. proximity radius. |

The group is auto-attached by `World._attachTDASummary()` for datasets with numeric columns and recomputes after each non-anomaly data operation. Each panel exposes `update(data)` so it can also be driven by the diagnostic HUD or live streams.
