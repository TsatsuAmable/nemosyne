# Nemosyne Analytics Layer

The analytics layer turns Nemosyne from a spatial viewer into a spatial analytics workbench. It extracts statistical facts from datasets, runs clustering and anomaly detection, and feeds the results back into the Draco recommender so that VR layout, geometry, behaviour, and interaction all adapt to the data.

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

## Clustering Operations (`src/data/DatasetOperations.js`)

All clustering operations return a new `Dataset` with a `_cluster` column so the original data is preserved.

| Function | Method | VR visualisation |
|----------|--------|------------------|
| `cluster(dataset, k, features)` | k-means with k-means++ seeding | Nested rings (`ClusterTransforms.applyNestedRings`) |
| `hierarchical(dataset, features, linkage, targetClusters)` | Agglomerative (single/complete/average) | Dendrogram arcs (`applyDendrogramArc`) |
| `dbscan(dataset, eps, minPoints, features)` | Density-based | Density clouds + noise sink (`applyDensityCloud`) |

`Dataset` rows also receive `_meta` on hierarchical and DBSCAN results describing linkage history, eps/minPoints, noise count, etc.

---

## Anomaly Detection (`DatasetOperations.anomaly`)

`anomaly(dataset, columnName, method, sensitivity)` adds `_anomaly` and `_anomalyScore` columns.

| Method | Description |
|--------|-------------|
| `iqr` | Interquartile range; sensitivity scales the whisker distance (default `1.5`). |
| `zscore` | Standard-deviation threshold (default `3`). |
| `isolation` | Lightweight isolation-forest approximation using recursive random splits; score is normalised split depth. |

### VR rendering (`AnomalyTransforms.js`)

- Outliers receive a pulsing magenta halo (`ensureHalo`) and lift above the dataset.
- `applyOutlierLens` gathers outliers around a focus point (e.g. the user's hand) while dimming non-outliers.
- `updateAnomalyPulse` animates halo scale/opacity each frame.

### Outlier recommender rule

The `ConstraintEngine` already flags `hasOutliers` via a robust MAD-based modified Z-score and prefers `ORB` geometry when outliers are present.

---

## Chart Planes in VR (`ChartPlane`)

`src/vr/artifacts/ChartPlane.js` renders Canvas 2D plots onto a world-space quad:

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

## TDA Artefacts (`src/analytics/TDAMapper.js`, `src/vr/artifacts/TDAPlanes.js`)

Lightweight, JS-only topological summaries give analysts a shape-first view of their data without leaving VR.

### Algorithms

| Function | What it computes |
|----------|------------------|
| `mapper(rows, featureColumns, filterFn, bins, overlap, linkage)` | Approximate Mapper graph: rows are binned by a 1-D filter function, clustered inside each overlapping bin, and connected when clusters share rows. |
| `persistenceIntervals(rows, filterFn, featureColumns, maxDistance)` | 0-D persistence intervals for a 1-D filtration; union-find grows components as the filter threshold sweeps outward. |
| `betti0Curve(rows, featureColumns, samples, maxRadius)` | Number of connected components of a VR-style proximity graph as the radius grows. |

These are intentionally fast approximations for live VR datasets, not replacements for full TDA libraries.

### Panels (`TDAPlanes.js`)

`buildTDASummaryGroup(dataset, featureColumns, filterColumn)` creates three world-space canvas panels:

| Panel | Visual |
|-------|--------|
| Persistence barcode | Horizontal bars with birth/death ticks; infinite deaths are filtered out of the finite view. |
| Mapper graph | Nodes laid out on a circle ordered by filter centre; edges drawn when bins overlap. |
| Betti-0 curve | Connected-component count vs. proximity radius. |

The group is auto-attached by `World._attachTDASummary()` for datasets with numeric columns and recomputes after each non-anomaly data operation. Each panel exposes `update(data)` so it can also be driven by the diagnostic HUD or live streams.
