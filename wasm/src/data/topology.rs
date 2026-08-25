use std::collections::{HashMap, HashSet};
use serde::Serialize;
use crate::data::column::Column;
use crate::data::columnar::ColumnarDataset;
use crate::data::dataset::Dataset;
use crate::data::value::Value;

/// Topology inference categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Topology {
    Tabular,
    Hierarchy,
    Graph,
    TimeSeries,
    VectorField,
    Geo,
    Flow,
}

impl Topology {
    pub fn as_str(self) -> &'static str {
        match self {
            Topology::Tabular => "TABULAR",
            Topology::Hierarchy => "HIERARCHY",
            Topology::Graph => "GRAPH",
            Topology::TimeSeries => "TIME_SERIES",
            Topology::VectorField => "VECTOR_FIELD",
            Topology::Geo => "GEO",
            Topology::Flow => "FLOW",
        }
    }
}

// Fuzzy column-name hint substrings, mirrored verbatim from
// `src/data/TopologyInference.ts`. A column matches a hint when its
// *normalised* name (lowercased, with `_`/`-`/` ` stripped) *contains* the hint
// substring — not equality. This deliberately reproduces the JS behaviour,
// including the loose `x`/`y` GEO hints (which match any column containing
// those letters). Wave 5 may tighten these; Wave 1 is parity-only.
const GRAPH_HINTS: &[&str] = &["source", "target", "from", "to", "src", "dst", "edge"];
const HIERARCHY_HINTS: &[&str] = &["parent", "child", "level", "parentid", "childid"];
const GEO_HINTS: &[&str] = &["lat", "latitude", "lon", "longitude", "x", "y", "lng"];
const VECTOR_HINTS: &[&str] = &["u", "v", "w", "vx", "vy", "vz"];

fn normalize_name(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .filter(|c| *c != '_' && *c != '-' && *c != ' ')
        .collect()
}

fn matches_hint(norm: &str, hints: &[&str]) -> bool {
    hints.iter().any(|h| norm.contains(h))
}

fn count_hinted(columns: &[crate::data::column::Column], hints: &[&str]) -> usize {
    columns
        .iter()
        .filter(|c| matches_hint(&normalize_name(&c.name), hints))
        .count()
}

/// Parse a topology name string into a `Topology` (case-insensitive).
pub fn parse_topology(s: &str) -> Option<Topology> {
    match s.to_uppercase().as_str() {
        "TABULAR" => Some(Topology::Tabular),
        "HIERARCHY" => Some(Topology::Hierarchy),
        "GRAPH" => Some(Topology::Graph),
        "TIME_SERIES" => Some(Topology::TimeSeries),
        "VECTOR_FIELD" => Some(Topology::VectorField),
        "GEO" => Some(Topology::Geo),
        "FLOW" => Some(Topology::Flow),
        _ => None,
    }
}

/// Infer topology from column names and types, optionally honouring an explicit
/// override. Mirrors `src/data/TopologyInference.ts::inferTopology` precedence:
/// explicit → GRAPH (≥2) → HIERARCHY (≥1 + cat/num) → GEO (≥2) → VECTOR_FIELD
/// (≥2 + ≥2 numeric) → TIME_SERIES (temporal + numeric) → TABULAR.
pub fn infer_with_explicit(dataset: &Dataset, explicit: Option<Topology>) -> Topology {
    if let Some(t) = explicit {
        return t;
    }
    let graph_cols = count_hinted(&dataset.columns, GRAPH_HINTS);
    let hier_cols = count_hinted(&dataset.columns, HIERARCHY_HINTS);
    let geo_cols = count_hinted(&dataset.columns, GEO_HINTS);
    let vec_cols = count_hinted(&dataset.columns, VECTOR_HINTS);
    let n_cat = dataset.categorical_columns().len();
    let n_num = dataset.numeric_columns().len();
    let n_time = dataset.temporal_columns().len();

    if graph_cols >= 2 {
        return Topology::Graph;
    }
    if hier_cols >= 1 && (n_cat > 0 || n_num > 0) {
        return Topology::Hierarchy;
    }
    if geo_cols >= 2 {
        return Topology::Geo;
    }
    if vec_cols >= 2 && n_num >= 2 {
        return Topology::VectorField;
    }
    if n_time > 0 && n_num > 0 {
        return Topology::TimeSeries;
    }
    Topology::Tabular
}

/// Infer topology with no explicit override.
pub fn infer(dataset: &Dataset) -> Topology {
    infer_with_explicit(dataset, None)
}

// ---------------------------------------------------------------------------
// Topological Data Analysis (TDA) Mapper & Persistence Engine
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TdaMapperNode {
    pub id: usize,
    pub row_indices: Vec<usize>,
    pub level: usize,
    pub center: Vec<f64>,
    pub filter_center: f64,
    pub size: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TdaMapperGraph {
    pub nodes: Vec<TdaMapperNode>,
    pub edges: Vec<(usize, usize)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct PersistenceInterval {
    pub birth: f64,
    pub death: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct BettiPoint {
    pub radius: f64,
    pub betti0: usize,
}

fn euclidean_dist(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b.iter()).map(|(x, y)| (x - y) * (x - y)).sum::<f64>().sqrt()
}

/// Borrowed numeric point source for TDA. Implementations never materialize
/// row maps (`HashMap<String, Value>`): the row path gathers `f64` points
/// exactly as the legacy algorithm bodies did; the columnar path reads the
/// primitive `f64` buffers directly from `ColumnarDataset`. Categorical /
/// dictionary feature columns are out of scope for TDA and fail closed.
#[derive(Debug, Clone)]
pub struct FeatureSpace {
    row_count: usize,
    /// `points[i]` is the gathered feature vector for row `i` (row-major
    /// layout, identical to the legacy `values: Vec<Vec<f64>>` local).
    points: Vec<Vec<f64>>,
    /// First feature column's per-row values — the filtration fallback used
    /// when explicit `filter_values` are omitted or length-mismatched. Empty
    /// when there are no feature columns, matching the legacy
    /// `resolve_filter_values` empty-vector contract.
    first_feature: Vec<f64>,
}

/// Typed errors for the columnar TDA path. Surfaced by exports as a 0 return
/// plus a `log_error` side-channel message; never a panic, never partial output.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ColumnarTdaError {
    UnknownColumn(String),
    UnsupportedColumnKind(String),
}

impl std::fmt::Display for ColumnarTdaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ColumnarTdaError::UnknownColumn(name) => {
                write!(f, "feature column {name:?} not found in dataset schema")
            }
            ColumnarTdaError::UnsupportedColumnKind(name) => {
                write!(
                    f,
                    "feature column {name:?} is categorical/non-numeric; TDA requires numeric or temporal columns"
                )
            }
        }
    }
}

impl FeatureSpace {
    /// Row-major path. Gathers exactly as the legacy algorithm bodies did:
    /// `row.get(col).and_then(|v| v.as_number()).unwrap_or(0.0)` per feature.
    /// Byte-identical behaviour to the pre-columnar TDA implementation.
    pub fn from_rows(dataset: &Dataset, feature_columns: &[&str]) -> Self {
        let points: Vec<Vec<f64>> = dataset
            .rows
            .iter()
            .map(|r| {
                feature_columns
                    .iter()
                    .map(|col| r.get(*col).and_then(|v| v.as_number()).unwrap_or(0.0))
                    .collect()
            })
            .collect();
        let first_feature = if feature_columns.is_empty() {
            Vec::new()
        } else {
            points.iter().map(|p| p[0]).collect()
        };
        Self {
            row_count: dataset.row_count(),
            points,
            first_feature,
        }
    }

    /// Columnar-only path. Reads primitive `f64` buffers directly from the
    /// resident `ColumnarDataset` — no row maps are built and the row-major
    /// `Dataset` slot is never consulted. Dictionary/categorical feature
    /// columns fail closed with `UnsupportedColumnKind`; expanding categorical
    /// support is a governed P1-C/P2 decision, not smuggled in here.
    pub fn from_columnar(
        columns: &[Column],
        columnar: &ColumnarDataset,
        feature_columns: &[&str],
    ) -> Result<Self, ColumnarTdaError> {
        let mut feature_buffers: Vec<Vec<f64>> = Vec::with_capacity(feature_columns.len());
        for name in feature_columns {
            let index = columns
                .iter()
                .position(|c| &c.name == name)
                .ok_or_else(|| ColumnarTdaError::UnknownColumn(name.to_string()))?;
            match columnar.primitive_column(index) {
                Some(primitive) => feature_buffers.push(primitive.values.clone()),
                None => return Err(ColumnarTdaError::UnsupportedColumnKind(name.to_string())),
            }
        }
        let row_count = columnar.row_count();
        let first_feature = match feature_buffers.first() {
            Some(buf) => buf.clone(),
            None => Vec::new(),
        };
        // Transpose into row-major points to keep the algorithm bodies
        // byte-identical with the row path (they index `points[i]`).
        let points: Vec<Vec<f64>> = (0..row_count)
            .map(|i| feature_buffers.iter().map(|buf| buf[i]).collect())
            .collect();
        Ok(Self {
            row_count,
            points,
            first_feature,
        })
    }

    pub fn row_count(&self) -> usize {
        self.row_count
    }
}

/// Resolve the filtration vector inside the Rust analytical authority.
///
/// Explicit `filter_values` remain supported for compatibility and tests. When
/// they are omitted (or length-mismatched), the first feature column becomes the
/// filtration column. Production Atlas/TDA uses this mode so UI code never
/// traverses raw rows to manufacture an analytical input vector.
fn resolve_filter_values_space(
    space: &FeatureSpace,
    filter_values: &[f64],
) -> Vec<f64> {
    if filter_values.len() == space.row_count {
        return filter_values.to_vec();
    }
    space.first_feature.clone()
}

/// Compute TDA Mapper graph over dataset numeric feature columns.
///
/// Row-major convenience wrapper: builds a `FeatureSpace` from the dataset and
/// delegates to `compute_mapper_graph_space`. Behaviour is byte-identical to
/// the pre-columnar implementation; kept for direct callers and tests.
pub fn compute_mapper_graph(
    dataset: &Dataset,
    feature_columns: &[&str],
    filter_values: &[f64],
    bins: usize,
    overlap: f64,
) -> TdaMapperGraph {
    let space = FeatureSpace::from_rows(dataset, feature_columns);
    compute_mapper_graph_space(&space, filter_values, bins, overlap)
}

/// Columnar-native Mapper graph over a borrowed `FeatureSpace`. This is the
/// substrate-agnostic core: the row path and the columnar-only path both arrive
/// here, so the algorithm runs identically regardless of ingest mode.
pub fn compute_mapper_graph_space(
    space: &FeatureSpace,
    filter_values: &[f64],
    bins: usize,
    overlap: f64,
) -> TdaMapperGraph {
    let filter_values = resolve_filter_values_space(space, filter_values);
    if space.row_count == 0 || filter_values.len() != space.row_count {
        return TdaMapperGraph {
            nodes: Vec::new(),
            edges: Vec::new(),
        };
    }

    let values: &[Vec<f64>] = &space.points;

    let f_min = filter_values.iter().copied().fold(f64::INFINITY, f64::min);
    let f_max = filter_values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let span = (f_max - f_min).max(1e-6);
    let step = span / (bins as f64 - overlap * 2.0).max(1.0);

    let mut nodes: Vec<TdaMapperNode> = Vec::new();

    for i in 0..bins {
        let lo = f_min + i as f64 * step - overlap * step;
        let hi = lo + step + 2.0 * overlap * step;

        let bucket: Vec<usize> = (0..space.row_count)
            .filter(|&idx| filter_values[idx] >= lo && filter_values[idx] <= hi)
            .collect();

        if bucket.is_empty() {
            continue;
        }

        let mut visited = HashSet::new();
        for &a in &bucket {
            if visited.contains(&a) {
                continue;
            }
            let mut cluster = vec![a];
            visited.insert(a);
            let mut stack = vec![a];

            while let Some(curr) = stack.pop() {
                for &b in &bucket {
                    if visited.contains(&b) {
                        continue;
                    }
                    if euclidean_dist(&values[curr], &values[b]) <= step * 0.5 {
                        visited.insert(b);
                        cluster.push(b);
                        stack.push(b);
                    }
                }
            }

            if !cluster.is_empty() {
                let dim = values[0].len();
                let mut center = vec![0.0; dim];
                let mut filter_sum = 0.0;
                for &idx in &cluster {
                    filter_sum += filter_values[idx];
                    for d in 0..dim {
                        center[d] += values[idx][d];
                    }
                }
                for c in &mut center {
                    *c /= cluster.len() as f64;
                }

                nodes.push(TdaMapperNode {
                    id: nodes.len(),
                    row_indices: cluster.clone(),
                    level: i,
                    center,
                    filter_center: filter_sum / cluster.len() as f64,
                    size: cluster.len(),
                });
            }
        }
    }

    // Build edges for shared dataset rows
    let mut row_to_nodes: HashMap<usize, Vec<usize>> = HashMap::new();
    for node in &nodes {
        for &row_idx in &node.row_indices {
            row_to_nodes.entry(row_idx).or_default().push(node.id);
        }
    }

    let mut edge_set = HashSet::new();
    let mut edges = Vec::new();

    for node_ids in row_to_nodes.values() {
        for i in 0..node_ids.len() {
            for j in (i + 1)..node_ids.len() {
                let a = node_ids[i];
                let b = node_ids[j];
                let pair = if a < b { (a, b) } else { (b, a) };
                if edge_set.insert(pair) {
                    edges.push(pair);
                }
            }
        }
    }

    TdaMapperGraph { nodes, edges }
}

/// Compute 1D persistence intervals using Union-Find.
///
/// Row-major convenience wrapper; byte-identical to the pre-columnar
/// implementation. Delegates to `compute_persistence_intervals_space`.
pub fn compute_persistence_intervals(
    dataset: &Dataset,
    feature_columns: &[&str],
    filter_values: &[f64],
    max_distance: f64,
) -> Vec<PersistenceInterval> {
    let space = FeatureSpace::from_rows(dataset, feature_columns);
    compute_persistence_intervals_space(&space, filter_values, max_distance)
}

/// Columnar-native persistence intervals over a borrowed `FeatureSpace`.
pub fn compute_persistence_intervals_space(
    space: &FeatureSpace,
    filter_values: &[f64],
    max_distance: f64,
) -> Vec<PersistenceInterval> {
    let n = space.row_count;
    let filter_values = resolve_filter_values_space(space, filter_values);
    if n == 0 || filter_values.len() != n {
        return Vec::new();
    }

    let values: &[Vec<f64>] = &space.points;

    let mut indices: Vec<usize> = (0..n).collect();
    indices.sort_by(|&a, &b| filter_values[a].partial_cmp(&filter_values[b]).unwrap_or(std::cmp::Ordering::Equal));

    let mut parent: Vec<usize> = (0..n).collect();

    fn find(parent: &mut [usize], mut i: usize) -> usize {
        while parent[i] != i {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        i
    }

    let mut intervals = Vec::new();
    let mut born_at: HashMap<usize, f64> = HashMap::new();

    for &i in &indices {
        let root = find(&mut parent, i);
        born_at.entry(root).or_insert(filter_values[i]);

        for &j in &indices {
            if filter_values[j] - filter_values[i] > max_distance {
                break;
            }
            if euclidean_dist(&values[i], &values[j]) <= max_distance {
                let ri = find(&mut parent, i);
                let rj = find(&mut parent, j);
                if ri != rj {
                    parent[ri] = rj;
                }
            }
        }
    }

    for (&root, &birth) in &born_at {
        if parent[root] == root {
            intervals.push(PersistenceInterval { birth, death: None });
        }
    }

    intervals.sort_by(|a, b| a.birth.partial_cmp(&b.birth).unwrap_or(std::cmp::Ordering::Equal));

    intervals
}

/// Compute Betti-0 curve over distance radius steps.
///
/// Row-major convenience wrapper; byte-identical to the pre-columnar
/// implementation. Delegates to `compute_betti0_curve_space`.
pub fn compute_betti0_curve(
    dataset: &Dataset,
    feature_columns: &[&str],
    steps: usize,
) -> Vec<BettiPoint> {
    let space = FeatureSpace::from_rows(dataset, feature_columns);
    compute_betti0_curve_space(&space, steps)
}

/// Columnar-native Betti-0 curve over a borrowed `FeatureSpace`.
pub fn compute_betti0_curve_space(
    space: &FeatureSpace,
    steps: usize,
) -> Vec<BettiPoint> {
    let n = space.row_count;
    if n == 0 {
        return Vec::new();
    }

    let values: &[Vec<f64>] = &space.points;

    let mut max_d = 0.0f64;
    for i in 0..n {
        for j in (i + 1)..n {
            let d = euclidean_dist(&values[i], &values[j]);
            if d > max_d {
                max_d = d;
            }
        }
    }

    let step_size = (max_d / steps.max(1) as f64).max(0.1);
    let mut points = Vec::with_capacity(steps);

    for s in 0..=steps {
        let r = s as f64 * step_size;
        let mut parent: Vec<usize> = (0..n).collect();

        fn find(parent: &mut [usize], mut i: usize) -> usize {
            while parent[i] != i {
                parent[i] = parent[parent[i]];
                i = parent[i];
            }
            i
        }

        for i in 0..n {
            for j in (i + 1)..n {
                if euclidean_dist(&values[i], &values[j]) <= r {
                    let ri = find(&mut parent, i);
                    let rj = find(&mut parent, j);
                    if ri != rj {
                        parent[ri] = rj;
                    }
                }
            }
        }

        let components: HashSet<usize> = (0..n).map(|i| find(&mut parent, i)).collect();
        points.push(BettiPoint {
            radius: r,
            betti0: components.len(),
        });
    }

    points
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::{Column, ColumnType};

    #[test]
    fn infers_topology_types() {
        let cols = vec![Column::new("parent", ColumnType::Categorical)];
        let ds = Dataset::new("hier", cols, vec![]);
        assert_eq!(infer(&ds), Topology::Hierarchy);
    }

    #[test]
    fn fuzzy_graph_from_source_and_target() {
        let cols = vec![
            Column::new("source", ColumnType::Categorical),
            Column::new("target", ColumnType::Categorical),
        ];
        let ds = Dataset::new("g", cols, vec![]);
        assert_eq!(infer(&ds), Topology::Graph);
    }

    #[test]
    fn fuzzy_geo_from_lat_lon() {
        let cols = vec![
            Column::new("lat", ColumnType::Numeric),
            Column::new("lon", ColumnType::Numeric),
            Column::new("population", ColumnType::Numeric),
        ];
        let ds = Dataset::new("geo", cols, vec![]);
        assert_eq!(infer(&ds), Topology::Geo);
    }

    #[test]
    fn fuzzy_time_series_needs_numeric() {
        // Temporal alone (no numeric) must NOT be TIME_SERIES — falls to TABULAR.
        let cols = vec![Column::new("time", ColumnType::Temporal)];
        let ds = Dataset::new("t", cols, vec![]);
        assert_eq!(infer(&ds), Topology::Tabular);
    }

    #[test]
    fn explicit_topology_overrides_inference() {
        let cols = vec![Column::new("source", ColumnType::Categorical)];
        let ds = Dataset::new("g", cols, vec![]);
        assert_eq!(
            infer_with_explicit(&ds, Some(Topology::Geo)),
            Topology::Geo
        );
    }

    #[test]
    fn parse_topology_round_trips() {
        assert_eq!(parse_topology("geo"), Some(Topology::Geo));
        assert_eq!(parse_topology("VECTOR_FIELD"), Some(Topology::VectorField));
        assert_eq!(parse_topology("nonsense"), None);
    }

    #[test]
    fn computes_tda_mapper_graph() {
        let cols = vec![Column::new("val", ColumnType::Numeric)];
        let mut row0 = HashMap::new();
        row0.insert("val".to_string(), Value::Number(1.0));
        let mut row1 = HashMap::new();
        row1.insert("val".to_string(), Value::Number(2.0));
        let ds = Dataset::new("tda", cols, vec![row0, row1]);

        let filter_vals = vec![1.0, 2.0];
        let graph = compute_mapper_graph(&ds, &["val"], &filter_vals, 3, 0.3);
        assert!(!graph.nodes.is_empty());
    }

    #[test]
    fn tda_derives_filtration_from_first_feature_when_explicit_values_are_omitted() {
        let cols = vec![Column::new("val", ColumnType::Numeric)];
        let mut row0 = HashMap::new();
        row0.insert("val".to_string(), Value::Number(1.0));
        let mut row1 = HashMap::new();
        row1.insert("val".to_string(), Value::Number(2.0));
        let ds = Dataset::new("tda", cols, vec![row0, row1]);

        let graph = compute_mapper_graph(&ds, &["val"], &[], 3, 0.3);
        let intervals = compute_persistence_intervals(&ds, &["val"], &[], 1.0);

        assert!(!graph.nodes.is_empty());
        assert!(!intervals.is_empty());
    }

    /// The TS `TdaMapperNode` interface expects camelCase field names
    /// (`rowIndices`, `filterCenter`). serde defaults to snake_case, which
    /// made `JSON.parse(json) as TdaMapperGraph` yield nodes with no
    /// `rowIndices` and crash `[...node.rowIndices]` on the Quest. Guard the
    /// ABI contract: the JSON MUST use camelCase.
    #[test]
    fn tda_mapper_graph_serializes_camel_case() {
        let graph = TdaMapperGraph {
            nodes: vec![TdaMapperNode {
                id: 0,
                row_indices: vec![1, 0],
                level: 2,
                center: vec![0.5, 0.25],
                filter_center: 1.5,
                size: 2,
            }],
            edges: vec![(0, 0)],
        };
        let json = serde_json::to_string(&graph).expect("serialize");
        let obj: serde_json::Value = serde_json::from_str(&json).expect("parse");
        let node = &obj["nodes"][0];
        assert!(node.get("rowIndices").is_some(), "camelCase rowIndices missing: {json}");
        assert!(node.get("filterCenter").is_some(), "camelCase filterCenter missing: {json}");
        assert!(node.get("row_indices").is_none(), "snake_case row_indices leaked: {json}");
        assert!(node.get("filter_center").is_none(), "snake_case filter_center leaked: {json}");
    }
}

#[cfg(test)]
mod columnar_tda_tests {
    use super::*;
    use crate::data::column::ColumnType;
    use crate::data::columnar::ColumnarDataset;

    /// A dataset with two numeric feature columns, including a row with a
    /// missing value in `x` (so the columnar validity bitmap is exercised).
    /// The columnar sidecar is built via `from_dataset` so both substrates see
    /// byte-identical normalization (invalid -> 0.0).
    fn parity_fixture() -> (Dataset, ColumnarDataset, Vec<&'static str>) {
        let cols = vec![
            Column::new("x", ColumnType::Numeric),
            Column::new("y", ColumnType::Numeric),
        ];
        let mut r0 = HashMap::new();
        r0.insert("x".to_string(), Value::Number(0.0));
        r0.insert("y".to_string(), Value::Number(0.0));
        let mut r1 = HashMap::new();
        r1.insert("x".to_string(), Value::Number(1.0));
        r1.insert("y".to_string(), Value::Number(0.5));
        let mut r2 = HashMap::new();
        r2.insert("y".to_string(), Value::Number(1.0)); // missing x
        let mut r3 = HashMap::new();
        r3.insert("x".to_string(), Value::Number(1.0));
        r3.insert("y".to_string(), Value::Number(1.0));
        let ds = Dataset::new("parity", cols, vec![r0, r1, r2, r3]);
        let columnar = ColumnarDataset::from_dataset(&ds);
        (ds, columnar, vec!["x", "y"])
    }

    fn spaces() -> (FeatureSpace, FeatureSpace) {
        let (ds, columnar, fc) = parity_fixture();
        let row_space = FeatureSpace::from_rows(&ds, &fc);
        let col_space = FeatureSpace::from_columnar(&ds.columns, &columnar, &fc).expect("columnar feature space");
        (row_space, col_space)
    }

    #[test]
    fn r1_columnar_mapper_parity() {
        let (row_space, col_space) = spaces();
        let row_graph = compute_mapper_graph_space(&row_space, &[], 4, 0.3);
        let col_graph = compute_mapper_graph_space(&col_space, &[], 4, 0.3);
        assert_eq!(row_graph.nodes.len(), col_graph.nodes.len());
        assert_eq!(row_graph.edges, col_graph.edges);
        for (rn, cn) in row_graph.nodes.iter().zip(col_graph.nodes.iter()) {
            assert_eq!(rn.id, cn.id);
            assert_eq!(rn.row_indices, cn.row_indices);
            assert_eq!(rn.level, cn.level);
            assert_eq!(rn.center, cn.center);
            assert_eq!(rn.filter_center, cn.filter_center);
            assert_eq!(rn.size, cn.size);
        }
    }

    #[test]
    fn r2_columnar_persistence_parity() {
        let (row_space, col_space) = spaces();
        let row_iv = compute_persistence_intervals_space(&row_space, &[], 1.0);
        let col_iv = compute_persistence_intervals_space(&col_space, &[], 1.0);
        assert_eq!(row_iv.len(), col_iv.len());
        for (r, c) in row_iv.iter().zip(col_iv.iter()) {
            assert_eq!(r.birth, c.birth);
            assert_eq!(r.death, c.death);
        }
    }

    #[test]
    fn r3_columnar_betti0_parity() {
        let (row_space, col_space) = spaces();
        let row_curve = compute_betti0_curve_space(&row_space, 8);
        let col_curve = compute_betti0_curve_space(&col_space, 8);
        assert_eq!(row_curve.len(), col_curve.len());
        for (r, c) in row_curve.iter().zip(col_curve.iter()) {
            assert_eq!(r.radius, c.radius);
            assert_eq!(r.betti0, c.betti0);
        }
    }

    #[test]
    fn r4_columnar_filtration_derivation_parity() {
        let (row_space, col_space) = spaces();
        // No explicit filterValues -> first feature column drives filtration,
        // and the derived vectors must match exactly across substrates.
        assert_eq!(row_space.first_feature, col_space.first_feature);
        let row_graph = compute_mapper_graph_space(&row_space, &[], 4, 0.3);
        let col_graph = compute_mapper_graph_space(&col_space, &[], 4, 0.3);
        assert_eq!(row_graph.nodes.len(), col_graph.nodes.len());
    }

    #[test]
    fn r5_columnar_unsupported_column_kind_fails_closed() {
        let cols = vec![
            Column::new("x", ColumnType::Numeric),
            Column::new("cohort", ColumnType::Categorical),
        ];
        let columnar = ColumnarDataset::from_parts(
            2,
            std::collections::HashMap::from([(
                0,
                crate::data::columnar::PrimitiveColumn {
                    values: vec![0.0, 1.0],
                    validity: vec![1, 1],
                },
            )]),
            std::collections::HashMap::from([(
                1,
                crate::data::columnar::CategoricalColumn {
                    dictionary: vec!["A".to_string(), "B".to_string()],
                    codes: vec![0, 1],
                    validity: vec![1, 1],
                },
            )]),
        )
        .expect("valid columnar dataset");
        let err = FeatureSpace::from_columnar(&cols, &columnar, &["cohort"])
            .expect_err("categorical feature column must fail closed");
        assert_eq!(err, ColumnarTdaError::UnsupportedColumnKind("cohort".into()));

        let err = FeatureSpace::from_columnar(&cols, &columnar, &["missing"])
            .expect_err("unknown feature column must fail closed");
        assert_eq!(err, ColumnarTdaError::UnknownColumn("missing".into()));
    }

    #[test]
    fn r6_columnar_validity_bitmap_matches_row_missing_value_handling() {
        // Row with a missing `x` becomes 0.0 in the row path (unwrap_or(0.0)) and
        // 0.0 with validity 0 in the columnar sidecar. Both substrates must
        // produce the identical gathered point (no row dropped, no divergence).
        let (row_space, col_space) = spaces();
        assert_eq!(row_space.row_count, col_space.row_count);
        assert_eq!(row_space.points, col_space.points);
        // Row index 2 is the missing-x row: its x feature is 0.0 in both paths.
        assert_eq!(row_space.points[2][0], 0.0);
        assert_eq!(col_space.points[2][0], 0.0);
    }
}
