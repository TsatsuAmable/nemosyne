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

pub const TDA_MISSING_DATA_POLICY: &str = "complete_case_selected_features";

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

/// Numeric metric-space source for TDA.
///
/// RF-007 validity rule: only complete observations over the selected feature
/// tuple enter the metric space. `source_row_indices[local]` maps every local
/// TDA point back to its original dataset row, so exclusion never corrupts
/// durable observation identity or Mapper row membership.
#[derive(Debug, Clone)]
pub struct FeatureSpace {
    row_count: usize,
    source_row_count: usize,
    source_row_indices: Vec<usize>,
    /// `points[i]` is the gathered feature vector for eligible local point `i`.
    points: Vec<Vec<f64>>,
    /// First selected feature for eligible points, used as filtration fallback.
    first_feature: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ColumnarTdaError {
    UnknownColumn(String),
    UnsupportedColumnKind(String),
    InvalidColumnLength(String),
}

impl std::fmt::Display for ColumnarTdaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ColumnarTdaError::UnknownColumn(name) => {
                write!(f, "feature column {name:?} not found in dataset schema")
            }
            ColumnarTdaError::UnsupportedColumnKind(name) => write!(
                f,
                "feature column {name:?} is categorical/non-numeric; TDA requires numeric or temporal columns"
            ),
            ColumnarTdaError::InvalidColumnLength(name) => write!(
                f,
                "feature column {name:?} has inconsistent value/validity length"
            ),
        }
    }
}

impl FeatureSpace {
    /// Row-major complete-case path. A row is eligible only when every selected
    /// feature resolves to a finite number. Real numeric zero remains valid;
    /// missing, non-numeric and non-finite values are excluded rather than
    /// silently converted into geometric zero.
    pub fn from_rows(dataset: &Dataset, feature_columns: &[&str]) -> Self {
        let source_row_count = dataset.row_count();
        let mut points = Vec::with_capacity(source_row_count);
        let mut source_row_indices = Vec::with_capacity(source_row_count);

        for (source_row, row) in dataset.rows.iter().enumerate() {
            let mut point = Vec::with_capacity(feature_columns.len());
            let mut valid = true;
            for column in feature_columns {
                match row.get(*column).and_then(|value| value.as_number()) {
                    Some(value) if value.is_finite() => point.push(value),
                    _ => {
                        valid = false;
                        break;
                    }
                }
            }
            if valid {
                source_row_indices.push(source_row);
                points.push(point);
            }
        }

        let first_feature = if feature_columns.is_empty() {
            Vec::new()
        } else {
            points.iter().map(|point| point[0]).collect()
        };
        Self {
            row_count: points.len(),
            source_row_count,
            source_row_indices,
            points,
            first_feature,
        }
    }

    /// Columnar complete-case path. Values and validity are borrowed from the
    /// resident `ColumnarDataset`; only rows valid in every selected primitive
    /// feature are transposed into the local TDA point matrix.
    pub fn from_columnar(
        columns: &[Column],
        columnar: &ColumnarDataset,
        feature_columns: &[&str],
    ) -> Result<Self, ColumnarTdaError> {
        let borrowed = crate::data::point_access::borrowed_feature_columns(
            columns,
            columnar,
            feature_columns,
        )
        .map_err(|err| match err {
            crate::data::point_access::PointAccessError::MissingColumn(name) => {
                ColumnarTdaError::UnknownColumn(name)
            }
            crate::data::point_access::PointAccessError::UnsupportedColumnKind(name) => {
                ColumnarTdaError::UnsupportedColumnKind(name)
            }
            crate::data::point_access::PointAccessError::InvalidColumnLength(name) => {
                ColumnarTdaError::InvalidColumnLength(name)
            }
        })?;

        let source_row_count = columnar.row_count();
        let source_row_indices = crate::data::point_access::complete_case_row_indices(
            &borrowed,
            source_row_count,
        );
        let points: Vec<Vec<f64>> = source_row_indices
            .iter()
            .map(|&source_row| {
                borrowed
                    .iter()
                    .map(|column| column.values[source_row])
                    .collect()
            })
            .collect();
        let first_feature = match borrowed.first() {
            Some(column) => source_row_indices
                .iter()
                .map(|&source_row| column.values[source_row])
                .collect(),
            None => Vec::new(),
        };

        Ok(Self {
            row_count: points.len(),
            source_row_count,
            source_row_indices,
            points,
            first_feature,
        })
    }

    pub fn row_count(&self) -> usize {
        self.row_count
    }

    pub fn source_row_count(&self) -> usize {
        self.source_row_count
    }

    pub fn excluded_row_count(&self) -> usize {
        self.source_row_count.saturating_sub(self.row_count)
    }

    pub fn source_row_indices(&self) -> &[usize] {
        &self.source_row_indices
    }

    pub fn missing_data_policy(&self) -> &'static str {
        TDA_MISSING_DATA_POLICY
    }

    pub fn points(&self) -> &[Vec<f64>] {
        &self.points
    }
}

/// Resolve filtration values inside the Rust analytical authority.
///
/// Explicit values may be supplied either for the eligible TDA point set or
/// for the full source dataset. Full-source vectors are projected through the
/// complete-case row map. Otherwise the first eligible feature is used.
fn resolve_filter_values_space(
    space: &FeatureSpace,
    filter_values: &[f64],
) -> Vec<f64> {
    if filter_values.len() == space.row_count {
        return filter_values.to_vec();
    }
    if filter_values.len() == space.source_row_count {
        return space
            .source_row_indices
            .iter()
            .map(|&source_row| filter_values[source_row])
            .collect();
    }
    space.first_feature.clone()
}

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

        let eps = step * 0.5;
        let dim = values[0].len();
        let mut bucket_columns = vec![Vec::with_capacity(bucket.len()); dim];
        for &idx in &bucket {
            for d in 0..dim {
                bucket_columns[d].push(values[idx][d]);
            }
        }
        let bucket_cloud = crate::data::neighbourhood::PointCloud {
            columns: bucket_columns,
            n: bucket.len(),
            d: dim,
        };

        let (csr, _) = if bucket.len() > 8192 {
            crate::data::neighbourhood::GridSparseIndex::new(eps).radius_neighbourhood(&bucket_cloud, eps)
        } else {
            crate::data::neighbourhood::ExactIndex.radius_neighbourhood(&bucket_cloud, eps)
        };

        let mut visited = vec![false; bucket.len()];
        for start in 0..bucket.len() {
            if visited[start] {
                continue;
            }
            visited[start] = true;
            let mut cluster_local = vec![start];
            let mut stack = vec![start];

            while let Some(u) = stack.pop() {
                for (v, _) in csr.neighbors(u) {
                    if !visited[v] {
                        visited[v] = true;
                        cluster_local.push(v);
                        stack.push(v);
                    }
                }
            }

            let cluster: Vec<usize> = cluster_local.into_iter().map(|loc| bucket[loc]).collect();

            if !cluster.is_empty() {
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
                    row_indices: cluster
                        .iter()
                        .map(|&local| space.source_row_indices[local])
                        .collect(),
                    level: i,
                    center,
                    filter_center: filter_sum / cluster.len() as f64,
                    size: cluster.len(),
                });
            }
        }
    }

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

    edges.sort();

    TdaMapperGraph { nodes, edges }
}

pub fn compute_persistence_intervals(
    dataset: &Dataset,
    feature_columns: &[&str],
    filter_values: &[f64],
    max_distance: f64,
) -> Vec<PersistenceInterval> {
    let space = FeatureSpace::from_rows(dataset, feature_columns);
    compute_persistence_intervals_space(&space, filter_values, max_distance)
}

pub fn compute_persistence_intervals_space(
    space: &FeatureSpace,
    filter_values: &[f64],
    max_distance: f64,
) -> Vec<PersistenceInterval> {
    let filter_values = resolve_filter_values_space(space, filter_values);
    let n = space.row_count;
    if n == 0 || filter_values.len() != n {
        return Vec::new();
    }

    let values: &[Vec<f64>] = &space.points;
    let d_dim = if values.is_empty() { 0 } else { values[0].len() };

    let mut columns = vec![Vec::with_capacity(n); d_dim];
    for p in values {
        for (dim, &val) in p.iter().enumerate() {
            columns[dim].push(val);
        }
    }
    let cloud = crate::data::neighbourhood::PointCloud {
        columns,
        n,
        d: d_dim,
    };

    let (csr, _) = if n > 8192 {
        crate::data::neighbourhood::GridSparseIndex::new(max_distance).radius_neighbourhood(&cloud, max_distance)
    } else {
        crate::data::neighbourhood::ExactIndex.radius_neighbourhood(&cloud, max_distance)
    };

    let mut edges: Vec<(usize, usize, f64)> = Vec::new();
    for u in 0..n {
        for (v, _) in csr.neighbors(u) {
            if u < v {
                let edge_filt = filter_values[u].max(filter_values[v]);
                edges.push((u, v, edge_filt));
            }
        }
    }
    edges.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal));

    struct Component {
        birth: f64,
    }

    let mut parent: Vec<usize> = (0..n).collect();
    let comp: Vec<Component> = (0..n).map(|i| Component { birth: filter_values[i] }).collect();

    fn find(parent: &mut [usize], mut i: usize) -> usize {
        while parent[i] != i {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        i
    }

    let mut intervals = Vec::new();

    for (u, v, edge_filt) in edges {
        let ru = find(&mut parent, u);
        let rv = find(&mut parent, v);
        if ru != rv {
            let (survivor, dying) = if comp[ru].birth < comp[rv].birth {
                (ru, rv)
            } else if comp[rv].birth < comp[ru].birth {
                (rv, ru)
            } else if ru < rv {
                (ru, rv)
            } else {
                (rv, ru)
            };

            intervals.push(PersistenceInterval {
                birth: comp[dying].birth,
                death: Some(edge_filt),
            });

            parent[dying] = survivor;
        }
    }

    for i in 0..n {
        if parent[i] == i {
            intervals.push(PersistenceInterval {
                birth: comp[i].birth,
                death: None,
            });
        }
    }

    intervals.sort_by(|a, b| {
        a.birth.partial_cmp(&b.birth)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| match (a.death, b.death) {
                (Some(d1), Some(d2)) => d2.partial_cmp(&d1).unwrap_or(std::cmp::Ordering::Equal),
                (None, Some(_)) => std::cmp::Ordering::Less,
                (Some(_), None) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            })
    });

    intervals
}

pub fn compute_betti0_curve(
    dataset: &Dataset,
    feature_columns: &[&str],
    steps: usize,
) -> Vec<BettiPoint> {
    let space = FeatureSpace::from_rows(dataset, feature_columns);
    compute_betti0_curve_space(&space, steps)
}

pub fn compute_betti0_curve_space(
    space: &FeatureSpace,
    steps: usize,
) -> Vec<BettiPoint> {
    let n = space.row_count;
    if n == 0 {
        return Vec::new();
    }

    let values: &[Vec<f64>] = &space.points;
    let d_dim = if values.is_empty() { 0 } else { values[0].len() };

    let mut columns = vec![Vec::with_capacity(n); d_dim];
    for p in values {
        for (dim, &val) in p.iter().enumerate() {
            columns[dim].push(val);
        }
    }
    let cloud = crate::data::neighbourhood::PointCloud {
        columns,
        n,
        d: d_dim,
    };

    let max_d = if n <= 100 {
        let mut d_max = 0.0f64;
        for i in 0..n {
            for j in (i + 1)..n {
                let d = cloud.dist(i, j);
                if d > d_max {
                    d_max = d;
                }
            }
        }
        d_max
    } else {
        cloud.bounding_box_diagonal()
    };

    let step_size = (max_d / steps.max(1) as f64).max(0.1);
    let effective_max_r = steps as f64 * step_size;

    let (csr, _) = if n > 8192 {
        crate::data::neighbourhood::GridSparseIndex::new(effective_max_r).radius_neighbourhood(&cloud, effective_max_r)
    } else {
        crate::data::neighbourhood::ExactIndex.radius_neighbourhood(&cloud, effective_max_r)
    };

    let mut edges: Vec<(usize, usize, f32)> = Vec::new();
    for u in 0..n {
        for (v, dist) in csr.neighbors(u) {
            if u < v {
                edges.push((u, v, dist));
            }
        }
    }
    edges.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal));

    let mut points = Vec::with_capacity(steps + 1);
    let mut parent: Vec<usize> = (0..n).collect();
    let mut num_components = n;
    let mut edge_cursor = 0usize;

    fn find(parent: &mut [usize], mut i: usize) -> usize {
        while parent[i] != i {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        i
    }

    for s in 0..=steps {
        let r = s as f64 * step_size;
        let r_f32 = (r + 1e-6) as f32;

        while edge_cursor < edges.len() && edges[edge_cursor].2 <= r_f32 {
            let (u, v, _) = edges[edge_cursor];
            let ru = find(&mut parent, u);
            let rv = find(&mut parent, v);
            if ru != rv {
                parent[ru] = rv;
                num_components -= 1;
            }
            edge_cursor += 1;
        }

        points.push(BettiPoint {
            radius: r,
            betti0: num_components,
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

    #[test]
    fn c5b_persistence_death_semantics() {
        let cols = vec![Column::new("val", ColumnType::Numeric)];
        let mut rows = Vec::new();
        for &v in &[0.0, 1.0, 5.0] {
            let mut r = HashMap::new();
            r.insert("val".to_string(), Value::Number(v));
            rows.push(r);
        }
        let ds = Dataset::new("tda_persist", cols, rows);
        let intervals = compute_persistence_intervals(&ds, &["val"], &[0.0, 1.0, 5.0], 2.0);

        assert_eq!(intervals.len(), 3);
        assert_eq!(intervals[0].birth, 0.0);
        assert_eq!(intervals[0].death, None);
        assert_eq!(intervals[1].birth, 1.0);
        assert_eq!(intervals[1].death, Some(1.0));
        assert_eq!(intervals[2].birth, 5.0);
        assert_eq!(intervals[2].death, None);
    }

    #[test]
    fn c6_betti0_monotone_sanity() {
        let cols = vec![Column::new("x", ColumnType::Numeric)];
        let mut rows = Vec::new();
        for i in 0..20 {
            let mut r = HashMap::new();
            r.insert("x".to_string(), Value::Number(i as f64));
            rows.push(r);
        }
        let ds = Dataset::new("tda_betti", cols, rows);
        let curve = compute_betti0_curve(&ds, &["x"], 10);

        assert!(!curve.is_empty());
        for i in 1..curve.len() {
            assert!(curve[i].betti0 <= curve[i - 1].betti0, "Betti0 curve must be non-increasing");
        }
        assert_eq!(curve.last().unwrap().betti0, 1, "At max radius all points merge to 1 component");
    }

    #[test]
    fn c7_betti0_bounding_box_diagonal_path_n_gt_100() {
        let cols = vec![Column::new("x", ColumnType::Numeric)];
        let mut rows = Vec::new();
        for i in 0..110 {
            let mut r = HashMap::new();
            r.insert("x".to_string(), Value::Number(i as f64));
            rows.push(r);
        }
        let ds = Dataset::new("tda_betti_large", cols, rows);
        let curve = compute_betti0_curve(&ds, &["x"], 20);

        assert!(!curve.is_empty());
        for i in 1..curve.len() {
            assert!(
                curve[i].betti0 <= curve[i - 1].betti0,
                "Betti0 must be non-increasing at step {i}: {} -> {}",
                curve[i - 1].betti0,
                curve[i].betti0
            );
        }
        assert_eq!(
            curve.last().unwrap().betti0,
            1,
            "All 110 chain points must merge to 1 component at max radius"
        );
    }
}

#[cfg(test)]
mod columnar_tda_tests {
    use super::*;
    use crate::data::column::ColumnType;
    use crate::data::columnar::ColumnarDataset;

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
        r2.insert("y".to_string(), Value::Number(1.0));
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
        let col_space = FeatureSpace::from_columnar(&ds.columns, &columnar, &fc)
            .expect("columnar feature space");
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
        assert_eq!(row_iv, col_iv);
    }

    #[test]
    fn r3_columnar_betti0_parity() {
        let (row_space, col_space) = spaces();
        let row_curve = compute_betti0_curve_space(&row_space, 8);
        let col_curve = compute_betti0_curve_space(&col_space, 8);
        assert_eq!(row_curve, col_curve);
    }

    #[test]
    fn r4_columnar_filtration_derivation_parity() {
        let (row_space, col_space) = spaces();
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
    fn r6_rf007_complete_case_excludes_missing_without_conflating_zero() {
        let (row_space, col_space) = spaces();
        assert_eq!(row_space.row_count(), 3);
        assert_eq!(col_space.row_count(), 3);
        assert_eq!(row_space.source_row_count(), 4);
        assert_eq!(col_space.source_row_count(), 4);
        assert_eq!(row_space.excluded_row_count(), 1);
        assert_eq!(col_space.excluded_row_count(), 1);
        assert_eq!(row_space.source_row_indices(), &[0, 1, 3]);
        assert_eq!(col_space.source_row_indices(), &[0, 1, 3]);
        assert_eq!(row_space.points(), col_space.points());
        assert_eq!(row_space.points()[0][0], 0.0, "real zero remains an eligible coordinate");
        assert_eq!(row_space.missing_data_policy(), TDA_MISSING_DATA_POLICY);
    }

    #[test]
    fn r7_rf007_mapper_preserves_original_row_identity() {
        let (row_space, col_space) = spaces();
        let full_source_filter = [0.0, 1.0, 999.0, 2.0];
        let row_graph = compute_mapper_graph_space(&row_space, &full_source_filter, 4, 0.3);
        let col_graph = compute_mapper_graph_space(&col_space, &full_source_filter, 4, 0.3);
        assert_eq!(row_graph.nodes.len(), col_graph.nodes.len());
        for graph in [&row_graph, &col_graph] {
            let rows: Vec<usize> = graph
                .nodes
                .iter()
                .flat_map(|node| node.row_indices.iter().copied())
                .collect();
            assert!(rows.iter().all(|row| *row != 2), "missing-feature row leaked into Mapper");
            assert!(rows.iter().all(|row| matches!(*row, 0 | 1 | 3)));
        }
    }

    #[test]
    fn r8_rf007_missing_and_numeric_zero_are_not_metric_equivalent() {
        let cols = vec![Column::new("x", ColumnType::Numeric)];
        let missing = Dataset::new(
            "missing",
            cols.clone(),
            vec![
                HashMap::from([("x".to_string(), Value::Number(1.0))]),
                HashMap::from([("x".to_string(), Value::Null)]),
                HashMap::from([("x".to_string(), Value::Number(2.0))]),
            ],
        );
        let zero = Dataset::new(
            "zero",
            cols,
            vec![
                HashMap::from([("x".to_string(), Value::Number(1.0))]),
                HashMap::from([("x".to_string(), Value::Number(0.0))]),
                HashMap::from([("x".to_string(), Value::Number(2.0))]),
            ],
        );
        let missing_space = FeatureSpace::from_rows(&missing, &["x"]);
        let zero_space = FeatureSpace::from_rows(&zero, &["x"]);
        assert_eq!(missing_space.row_count(), 2);
        assert_eq!(zero_space.row_count(), 3);
        assert_eq!(missing_space.source_row_indices(), &[0, 2]);
        assert_eq!(zero_space.source_row_indices(), &[0, 1, 2]);
    }
}