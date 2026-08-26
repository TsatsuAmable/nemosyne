# Nemosyne Analytics Layer

The analytics layer computes statistical facts, clustering, anomaly detection, topological summaries and data-derived layouts in the deterministic Rust/WASM kernel (`wasm/src/`). `AtlasCore.datasetEvidence()` validates the compact kernel structure profile for bounded Moneta representation reasoning. Desktop and WebXR then embody the resulting decision with provenance; they do not recompute analytical facts.

---

## Statistical facts (Rust kernel and `DatasetEvidence`)

All statistical facts are computed in the Rust/WASM kernel. Production Moneta consumes the validated `DatasetEvidence` path. `AtlasCore.dracoFacts()` remains compatibility-only:

- **`columnStats`** — per numeric column: `mean`, `median`, `stdDev`, `skew`, `kurtosis`, `min`, `max`, `outlierCount`.
- **`correlationMatrix`** — pairwise complete Pearson correlation for every numeric column pair.
- **`categoryDistribution`** — top categories with counts/fractions and entropy.
- **`trendDirection`** / **`seasonalityHint`** / **`normalizedSlope`** — temporal trend heuristics.
- **`hasOutliers`** — robust modified Z-score (MAD) outlier flag.
- **`hasHighVariance`**, **`numericSkew`**, **`topCategory`** — summary signals used by soft constraints.

These facts inform bounded Moneta feasibility and utility rules:

| Fact                    | Preferred VR mapping             |
| ----------------------- | -------------------------------- |
| Outliers present        | `ORB` geometry with pulsing halo |
| High variance (tabular) | `COLUMN` geometry                |
| Strong correlation      | `BEAM` geometry                  |
| Temporal trend          | `CHRONO_DIAL` interaction        |
| Seasonality hint        | `WAVE_OSCILLATION` behaviour     |

---

## Clustering Operations (Rust WASM Kernel & `src/atlas/`)

All clustering operations execute in the Rust WASM kernel (`wasm/src/operations.rs`) and return a new dataset with a `_cluster` column, recorded immutably to the Atlas provenance ledger.

| Operation      | Method                                  | VR visualisation                                    |
| -------------- | --------------------------------------- | --------------------------------------------------- |
| `cluster`      | k-means with k-means++ seeding          | Nested rings (`ClusterTransforms.applyNestedRings`) |
| `hierarchical` | Agglomerative (single/complete/average) | Dendrogram arcs (`applyDendrogramArc`)              |
| `dbscan`       | Density-based                           | Density clouds + noise sink (`applyDensityCloud`)   |

`Dataset` rows also receive `_meta` on hierarchical and DBSCAN results describing linkage history, eps/minPoints, noise count, etc.

---

## Anomaly Detection (Rust WASM Kernel)

`anomaly` calculates outliers via the WASM kernel and adds `_anomaly` and `_anomalyScore` columns.

| Method      | Description                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| `iqr`       | Interquartile range; sensitivity scales the whisker distance (default `1.5`).                              |
| `zscore`    | Standard-deviation threshold (default `3`).                                                                |
| `isolation` | Lightweight isolation-forest approximation using recursive random splits; score is normalised split depth. |

### VR rendering (`src/vr/interactions/AnomalyTransforms.ts`)

- Outliers receive a pulsing magenta halo (`ensureHalo`) and lift above the dataset.
- `applyOutlierLens` gathers outliers around a focus point (e.g. the user's hand) while dimming non-outliers.
- `updateAnomalyPulse` animates halo scale/opacity each frame.

### Outlier recommender rule

The Moneta `ConstraintEngine` consumes the kernel-derived outlier evidence and can prefer an `ORB` embodiment when feasible.

---

## Chart Planes in VR (`ChartPlane.ts`)

`src/vr/artifacts/ChartPlane.ts` renders Canvas 2D plots onto a world-space quad:

| ChartType     | Dataset requirement                         |
| ------------- | ------------------------------------------- |
| `BAR`         | Numeric column + optional categorical label |
| `LINE`        | Temporal + numeric columns                  |
| `HISTOGRAM`   | Single numeric column                       |
| `BOX`         | Single numeric column (5+ values)           |
| `CORRELATION` | Two or more numeric columns                 |

Chart planes are auto-attached by `VRTopologyTranslator` when the dataset has multiple numeric columns or a temporal column. They update in place when the dataset changes, so they work with live streams and data operations.

The `ConstraintEngine` includes a low-weight `attach_chart_plane_for_rich_numeric_or_time` preference that nudges the solver toward specs compatible with inspection interactions.

---

## TDA Artefacts (Rust WASM & `src/vr/artifacts/TDAPlanes.ts`)

Topological data analysis summaries give analysts a shape-first view of their data without leaving VR.

### Algorithms (Rust WASM Kernel & `wasm/src/data/neighbourhood.rs`)

All topological summaries run over the unified `PointCloud` and `RaggedNeighbourhood` CSR sparse substrate, supporting `Exact` and `GridSparse` neighbourhood modes.

| Function                        | What it computes                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compute_mapper_graph`          | Mapper graph: rows are binned by a 1-D filter function, clustered inside overlapping bins via `RaggedNeighbourhood`, and connected when clusters share rows. |
| `compute_persistence_intervals` | $H_0$ persistence intervals for single-linkage filtration over sorted CSR edges; computes exact births and merge deaths; unmerged components retain `death: None` (infinite persistence bars). |
| `compute_betti_0_curve`         | $Betti_0$ connected-component count curve as proximity radius sweeps outward, computed via single-pass edge-sorted Union-Find over CSR.                                                                  |

### Substrate Modes

- **`exact`**: Brute-force all-pairs comparison within radius $\epsilon$ (default for $N \le 8,192$).
- **`sparse`**: Deterministic grid hashing with multi-cell neighbor traversal and exact distance validation for high-throughput scaling without point loss.

### Panels (`src/vr/artifacts/TDAPlanes.ts`)

`buildTDASummaryGroup(dataset, featureColumns, filterColumn)` creates three world-space canvas panels:

| Panel               | Visual                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Persistence barcode | Horizontal bars with birth/death ticks; infinite deaths are filtered out of the finite view. |
| Mapper graph        | Nodes laid out on a circle ordered by filter centre; edges drawn when bins overlap.          |
| Betti-0 curve       | Connected-component count vs. proximity radius.                                              |

The group is auto-attached by `World._attachTDASummary()` for datasets with numeric columns and recomputes after each non-anomaly data operation. Each panel exposes `update(data)` so it can also be driven by the diagnostic HUD or live streams.
