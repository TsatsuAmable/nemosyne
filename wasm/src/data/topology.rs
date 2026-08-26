use std::collections::{HashMap, HashSet};
use serde::Serialize;
use crate::data::column::{Column, ColumnType};
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

// RF-032: topology evidence is semantic, not substring typography. Exact
// normalized aliases prevent ordinary names such as `index`, `salary`, or
// `total` from manufacturing GEO/GRAPH/VECTOR evidence merely because they
// contain x/y/to/u/v characters.
const GRAPH_SOURCE_ALIASES: &[&str] = &["source", "sourceid", "from", "fromid", "src", "srcid"];
const GRAPH_TARGET_ALIASES: &[&str] = &["target", "targetid", "to", "toid", "dst", "dstid"];
const HIERARCHY_PARENT_ALIASES: &[&str] = &["parent", "parentid"];
const HIERARCHY_CHILD_ALIASES: &[&str] = &["child", "childid"];
const HIERARCHY_LEVEL_ALIASES: &[&str] = &["level", "depth"];
const LATITUDE_ALIASES: &[&str] = &["lat", "latitude"];
const LONGITUDE_ALIASES: &[&str] = &["lon", "lng", "longitude"];
const EASTING_ALIASES: &[&str] = &["easting", "eastings"];
const NORTHING_ALIASES: &[&str] = &["northing", "northings"];
const GEO_CORROBORATION_ALIASES: &[&str] = &["crs", "epsg", "geometry", "geom", "coordinatesystem"];
const VECTOR_ALIASES: &[&str] = &["u", "v", "w", "vx", "vy", "vz"];

fn normalize_name(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .filter(|character| !matches!(*character, '_' | '-' | ' '))
        .collect()
}

fn exact_alias(name: &str, aliases: &[&str]) -> bool {
    let normalized = normalize_name(name);
    aliases.iter().any(|alias| normalized == *alias)
}

fn column_with_alias<'a>(
    columns: &'a [Column],
    aliases: &[&str],
    require_numeric: bool,
) -> Option<&'a Column> {
    columns.iter().find(|column| {
        (!require_numeric || column.ty == ColumnType::Numeric)
            && exact_alias(&column.name, aliases)
    })
}

fn has_alias(columns: &[Column], aliases: &[&str]) -> bool {
    columns.iter().any(|column| exact_alias(&column.name, aliases))
}

fn coordinate_values_within(dataset: &Dataset, column_name: &str, min: f64, max: f64) -> bool {
    let mut saw_finite = false;
    for row in &dataset.rows {
        let Some(value) = row.get(column_name).and_then(Value::as_number) else {
            continue;
        };
        if !value.is_finite() {
            continue;
        }
        saw_finite = true;
        if value < min || value > max {
            return false;
        }
    }
    // Empty datasets and all-missing coordinate columns retain schema-level
    // eligibility; missingness is handled separately. Any observed finite value
    // must, however, satisfy the coordinate domain.
    saw_finite || dataset.rows.is_empty() || dataset.rows.iter().all(|row| {
        row.get(column_name)
            .and_then(Value::as_number)
            .is_none_or(|value| !value.is_finite())
    })
}

fn has_geographic_coordinates(dataset: &Dataset) -> bool {
    if let (Some(latitude), Some(longitude)) = (
        column_with_alias(&dataset.columns, LATITUDE_ALIASES, true),
        column_with_alias(&dataset.columns, LONGITUDE_ALIASES, true),
    ) {
        return coordinate_values_within(dataset, &latitude.name, -90.0, 90.0)
            && coordinate_values_within(dataset, &longitude.name, -180.0, 180.0);
    }

    // Projected coordinate systems are unambiguously semantic by name.
    if column_with_alias(&dataset.columns, EASTING_ALIASES, true).is_some()
        && column_with_alias(&dataset.columns, NORTHING_ALIASES, true).is_some()
    {
        return true;
    }

    // Bare x/y are generic Cartesian variables. They count as geographic only
    // when an explicit CRS/geometry cue corroborates the interpretation.
    let has_x = dataset
        .columns
        .iter()
        .any(|column| column.ty == ColumnType::Numeric && normalize_name(&column.name) == "x");
    let has_y = dataset
        .columns
        .iter()
        .any(|column| column.ty == ColumnType::Numeric && normalize_name(&column.name) == "y");
    has_x && has_y && has_alias(&dataset.columns, GEO_CORROBORATION_ALIASES)
}

fn has_graph_coordinates(dataset: &Dataset) -> bool {
    has_alias(&dataset.columns, GRAPH_SOURCE_ALIASES)
        && has_alias(&dataset.columns, GRAPH_TARGET_ALIASES)
}

fn has_hierarchy_coordinates(dataset: &Dataset) -> bool {
    let has_parent = has_alias(&dataset.columns, HIERARCHY_PARENT_ALIASES);
    let has_child = has_alias(&dataset.columns, HIERARCHY_CHILD_ALIASES);
    let has_level = has_alias(&dataset.columns, HIERARCHY_LEVEL_ALIASES);
    has_parent && (has_child || has_level || dataset.columns.len() > 1)
}

fn vector_component_count(dataset: &Dataset) -> usize {
    dataset
        .columns
        .iter()
        .filter(|column| column.ty == ColumnType::Numeric && exact_alias(&column.name, VECTOR_ALIASES))
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

/// Infer topology from schema semantics and bounded value-domain checks,
/// optionally honouring an explicit investigator override.
pub fn infer_with_explicit(dataset: &Dataset, explicit: Option<Topology>) -> Topology {
    if let Some(topology) = explicit {
        return topology;
    }

    let numeric_count = dataset.numeric_columns().len();
    let temporal_count = dataset.temporal_columns().len();

    if has_graph_coordinates(dataset) {
        return Topology::Graph;
    }
    if has_hierarchy_coordinates(dataset) {
        return Topology::Hierarchy;
    }
    if has_geographic_coordinates(dataset) {
        return Topology::Geo;
    }
    if vector_component_count(dataset) >= 2 && numeric_count >= 2 {
        return Topology::VectorField;
    }
    if temporal_count > 0 && numeric_count > 0 {
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
    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x - y) * (x - y))
        .sum::<f64>()
        .sqrt()
}

/// Numeric metric-space source for TDA.
#[derive(Debug, Clone)]
pub struct FeatureSpace {
    row_count: usize,
    source_row_count: usize,
    source_row_indices: Vec<usize>,
    points: Vec<Vec<f64>>,
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
    pub fn from_rows(dataset: &Dataset, feature_columns: &[&str]) -> Self {
        let source_row_count = dataset.row_count();
        let mut points = Vec::with_capacity(source_row_count);
        let mut source_row_indices = Vec::with_capacity(source_row_count);
        for (source_row, row) in dataset.rows.iter().enumerate() {
            let mut point = Vec::with_capacity(feature_columns.len());
            let mut valid = true;
            for column in feature_columns {
                match row.get(*column).and_then(Value::as_number) {
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
        .map_err(|error| match error {
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
        let first_feature = borrowed.first().map_or_else(Vec::new, |column| {
            source_row_indices
                .iter()
                .map(|&source_row| column.values[source_row])
                .collect()
        });
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

fn resolve_filter_values_space(space: &FeatureSpace, filter_values: &[f64]) -> Vec<f64> {
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
    let values = &space.points;
    let f_min = filter_values.iter().copied().fold(f64::INFINITY, f64::min);
    let f_max = filter_values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let span = (f_max - f_min).max(1e-6);
    let step = span / (bins as f64 - overlap * 2.0).max(1.0);
    let mut nodes = Vec::new();

    for level in 0..bins {
        let lo = f_min + level as f64 * step - overlap * step;
        let hi = lo + step + 2.0 * overlap * step;
        let bucket: Vec<usize> = (0..space.row_count)
            .filter(|&index| filter_values[index] >= lo && filter_values[index] <= hi)
            .collect();
        if bucket.is_empty() {
            continue;
        }
        let eps = step * 0.5;
        let dimensions = values[0].len();
        let mut bucket_columns = vec![Vec::with_capacity(bucket.len()); dimensions];
        for &index in &bucket {
            for dimension in 0..dimensions {
                bucket_columns[dimension].push(values[index][dimension]);
            }
        }
        let bucket_cloud = crate::data::neighbourhood::PointCloud {
            columns: bucket_columns,
            n: bucket.len(),
            d: dimensions,
        };
        let (neighbourhood, _) = if bucket.len() > 8192 {
            crate::data::neighbourhood::GridSparseIndex::new(eps)
                .radius_neighbourhood(&bucket_cloud, eps)
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
            while let Some(current) = stack.pop() {
                for (next, _) in neighbourhood.neighbors(current) {
                    if !visited[next] {
                        visited[next] = true;
                        cluster_local.push(next);
                        stack.push(next);
                    }
                }
            }
            let cluster: Vec<usize> = cluster_local.into_iter().map(|local| bucket[local]).collect();
            if !cluster.is_empty() {
                let mut center = vec![0.0; dimensions];
                let mut filter_sum = 0.0;
                for &index in &cluster {
                    filter_sum += filter_values[index];
                    for dimension in 0..dimensions {
                        center[dimension] += values[index][dimension];
                    }
                }
                for coordinate in &mut center {
                    *coordinate /= cluster.len() as f64;
                }
                nodes.push(TdaMapperNode {
                    id: nodes.len(),
                    row_indices: cluster
                        .iter()
                        .map(|&local| space.source_row_indices[local])
                        .collect(),
                    level,
                    center,
                    filter_center: filter_sum / cluster.len() as f64,
                    size: cluster.len(),
                });
            }
        }
    }

    let mut row_to_nodes: HashMap<usize, Vec<usize>> = HashMap::new();
    for node in &nodes {
        for &row_index in &node.row_indices {
            row_to_nodes.entry(row_index).or_default().push(node.id);
        }
    }
    let mut edge_set = HashSet::new();
    let mut edges = Vec::new();
    for node_ids in row_to_nodes.values() {
        for left in 0..node_ids.len() {
            for right in left + 1..node_ids.len() {
                let a = node_ids[left];
                let b = node_ids[right];
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
    let values = &space.points;
    let dimensions = values.first().map_or(0, Vec::len);
    let mut columns = vec![Vec::with_capacity(n); dimensions];
    for point in values {
        for (dimension, &value) in point.iter().enumerate() {
            columns[dimension].push(value);
        }
    }
    let cloud = crate::data::neighbourhood::PointCloud {
        columns,
        n,
        d: dimensions,
    };
    let (neighbourhood, _) = if n > 8192 {
        crate::data::neighbourhood::GridSparseIndex::new(max_distance)
            .radius_neighbourhood(&cloud, max_distance)
    } else {
        crate::data::neighbourhood::ExactIndex.radius_neighbourhood(&cloud, max_distance)
    };
    let mut edges = Vec::new();
    for source in 0..n {
        for (target, _) in neighbourhood.neighbors(source) {
            if source < target {
                edges.push((source, target, filter_values[source].max(filter_values[target])));
            }
        }
    }
    edges.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal));

    struct Component {
        birth: f64,
    }
    let mut parent: Vec<usize> = (0..n).collect();
    let components: Vec<Component> = (0..n)
        .map(|index| Component {
            birth: filter_values[index],
        })
        .collect();
    fn find(parent: &mut [usize], mut index: usize) -> usize {
        while parent[index] != index {
            parent[index] = parent[parent[index]];
            index = parent[index];
        }
        index
    }
    let mut intervals = Vec::new();
    for (source, target, edge_filter) in edges {
        let source_root = find(&mut parent, source);
        let target_root = find(&mut parent, target);
        if source_root == target_root {
            continue;
        }
        let (survivor, dying) = if components[source_root].birth < components[target_root].birth {
            (source_root, target_root)
        } else if components[target_root].birth < components[source_root].birth {
            (target_root, source_root)
        } else if source_root < target_root {
            (source_root, target_root)
        } else {
            (target_root, source_root)
        };
        intervals.push(PersistenceInterval {
            birth: components[dying].birth,
            death: Some(edge_filter),
        });
        parent[dying] = survivor;
    }
    for index in 0..n {
        if parent[index] == index {
            intervals.push(PersistenceInterval {
                birth: components[index].birth,
                death: None,
            });
        }
    }
    intervals.sort_by(|a, b| {
        a.birth
            .partial_cmp(&b.birth)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| match (a.death, b.death) {
                (Some(left), Some(right)) => right
                    .partial_cmp(&left)
                    .unwrap_or(std::cmp::Ordering::Equal),
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

pub fn compute_betti0_curve_space(space: &FeatureSpace, steps: usize) -> Vec<BettiPoint> {
    let n = space.row_count;
    if n == 0 {
        return Vec::new();
    }
    let values = &space.points;
    let dimensions = values.first().map_or(0, Vec::len);
    let mut columns = vec![Vec::with_capacity(n); dimensions];
    for point in values {
        for (dimension, &value) in point.iter().enumerate() {
            columns[dimension].push(value);
        }
    }
    let cloud = crate::data::neighbourhood::PointCloud {
        columns,
        n,
        d: dimensions,
    };
    let max_distance = if n <= 100 {
        let mut maximum: f64 = 0.0;
        for left in 0..n {
            for right in left + 1..n {
                maximum = maximum.max(cloud.dist(left, right));
            }
        }
        maximum
    } else {
        cloud.bounding_box_diagonal()
    };
    let step_size = (max_distance / steps.max(1) as f64).max(0.1);
    let effective_maximum = steps as f64 * step_size;
    let (neighbourhood, _) = if n > 8192 {
        crate::data::neighbourhood::GridSparseIndex::new(effective_maximum)
            .radius_neighbourhood(&cloud, effective_maximum)
    } else {
        crate::data::neighbourhood::ExactIndex.radius_neighbourhood(&cloud, effective_maximum)
    };
    let mut edges = Vec::new();
    for source in 0..n {
        for (target, distance) in neighbourhood.neighbors(source) {
            if source < target {
                edges.push((source, target, distance));
            }
        }
    }
    edges.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal));
    let mut parent: Vec<usize> = (0..n).collect();
    let mut component_count = n;
    let mut edge_cursor = 0usize;
    fn find(parent: &mut [usize], mut index: usize) -> usize {
        while parent[index] != index {
            parent[index] = parent[parent[index]];
            index = parent[index];
        }
        index
    }
    let mut points = Vec::with_capacity(steps + 1);
    for step in 0..=steps {
        let radius = step as f64 * step_size;
        let radius_f32 = (radius + 1e-6) as f32;
        while edge_cursor < edges.len() && edges[edge_cursor].2 <= radius_f32 {
            let (source, target, _) = edges[edge_cursor];
            let source_root = find(&mut parent, source);
            let target_root = find(&mut parent, target);
            if source_root != target_root {
                parent[source_root] = target_root;
                component_count -= 1;
            }
            edge_cursor += 1;
        }
        points.push(BettiPoint {
            radius,
            betti0: component_count,
        });
    }
    points
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn infers_hierarchy_from_exact_parent_semantics() {
        let dataset = Dataset::new(
            "hierarchy",
            vec![
                Column::new("parent", ColumnType::Categorical),
                Column::new("id", ColumnType::Categorical),
            ],
            vec![],
        );
        assert_eq!(infer(&dataset), Topology::Hierarchy);
    }

    #[test]
    fn graph_requires_exact_source_and_target_roles() {
        let dataset = Dataset::new(
            "graph",
            vec![
                Column::new("source", ColumnType::Categorical),
                Column::new("target", ColumnType::Categorical),
            ],
            vec![],
        );
        assert_eq!(infer(&dataset), Topology::Graph);

        let ordinary = Dataset::new(
            "ordinary",
            vec![
                Column::new("total", ColumnType::Numeric),
                Column::new("destination_score", ColumnType::Numeric),
            ],
            vec![],
        );
        assert_eq!(infer(&ordinary), Topology::Tabular);
    }

    #[test]
    fn geo_requires_exact_numeric_coordinate_pair() {
        let valid = Dataset::new(
            "geo",
            vec![
                Column::new("latitude", ColumnType::Numeric),
                Column::new("longitude", ColumnType::Numeric),
                Column::new("population", ColumnType::Numeric),
            ],
            vec![HashMap::from([
                ("latitude".to_string(), Value::Number(51.5)),
                ("longitude".to_string(), Value::Number(-0.1)),
                ("population".to_string(), Value::Number(1.0)),
            ])],
        );
        assert_eq!(infer(&valid), Topology::Geo);

        let false_positive = Dataset::new(
            "not-geo",
            vec![
                Column::new("index", ColumnType::Numeric),
                Column::new("salary", ColumnType::Numeric),
            ],
            vec![],
        );
        assert_eq!(infer(&false_positive), Topology::Tabular);
    }

    #[test]
    fn bare_xy_requires_crs_or_geometry_corroboration() {
        let xy = Dataset::new(
            "xy",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            vec![],
        );
        assert_eq!(infer(&xy), Topology::Tabular);

        let projected = Dataset::new(
            "projected",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
                Column::new("crs", ColumnType::Categorical),
            ],
            vec![],
        );
        assert_eq!(infer(&projected), Topology::Geo);
    }

    #[test]
    fn latitude_longitude_ranges_reject_semantic_lookalikes() {
        let dataset = Dataset::new(
            "bad-ranges",
            vec![
                Column::new("lat", ColumnType::Numeric),
                Column::new("lon", ColumnType::Numeric),
            ],
            vec![HashMap::from([
                ("lat".to_string(), Value::Number(120.0)),
                ("lon".to_string(), Value::Number(500.0)),
            ])],
        );
        assert_eq!(infer(&dataset), Topology::Tabular);
    }

    #[test]
    fn geo_aliases_must_be_numeric() {
        let dataset = Dataset::new(
            "text-coordinates",
            vec![
                Column::new("lat", ColumnType::Categorical),
                Column::new("lon", ColumnType::Categorical),
            ],
            vec![],
        );
        assert_eq!(infer(&dataset), Topology::Tabular);
    }

    #[test]
    fn time_series_needs_numeric_measure() {
        let temporal_only = Dataset::new(
            "t",
            vec![Column::new("time", ColumnType::Temporal)],
            vec![],
        );
        assert_eq!(infer(&temporal_only), Topology::Tabular);
    }

    #[test]
    fn explicit_topology_overrides_inference() {
        let dataset = Dataset::new(
            "g",
            vec![Column::new("source", ColumnType::Categorical)],
            vec![],
        );
        assert_eq!(infer_with_explicit(&dataset, Some(Topology::Geo)), Topology::Geo);
    }

    #[test]
    fn parse_topology_round_trips() {
        assert_eq!(parse_topology("geo"), Some(Topology::Geo));
        assert_eq!(parse_topology("VECTOR_FIELD"), Some(Topology::VectorField));
        assert_eq!(parse_topology("nonsense"), None);
    }

    #[test]
    fn computes_tda_mapper_graph() {
        let columns = vec![Column::new("val", ColumnType::Numeric)];
        let dataset = Dataset::new(
            "tda",
            columns,
            vec![
                HashMap::from([("val".to_string(), Value::Number(1.0))]),
                HashMap::from([("val".to_string(), Value::Number(2.0))]),
            ],
        );
        let graph = compute_mapper_graph(&dataset, &["val"], &[1.0, 2.0], 3, 0.3);
        assert!(!graph.nodes.is_empty());
    }

    #[test]
    fn tda_derives_filtration_from_first_feature_when_explicit_values_are_omitted() {
        let columns = vec![Column::new("val", ColumnType::Numeric)];
        let dataset = Dataset::new(
            "tda",
            columns,
            vec![
                HashMap::from([("val".to_string(), Value::Number(1.0))]),
                HashMap::from([("val".to_string(), Value::Number(2.0))]),
            ],
        );
        assert!(!compute_mapper_graph(&dataset, &["val"], &[], 3, 0.3).nodes.is_empty());
        assert!(!compute_persistence_intervals(&dataset, &["val"], &[], 1.0).is_empty());
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
        let value: serde_json::Value = serde_json::from_str(&json).expect("parse");
        let node = &value["nodes"][0];
        assert!(node.get("rowIndices").is_some());
        assert!(node.get("filterCenter").is_some());
        assert!(node.get("row_indices").is_none());
        assert!(node.get("filter_center").is_none());
    }

    #[test]
    fn persistence_death_semantics() {
        let columns = vec![Column::new("val", ColumnType::Numeric)];
        let rows = [0.0, 1.0, 5.0]
            .into_iter()
            .map(|value| HashMap::from([("val".to_string(), Value::Number(value))]))
            .collect();
        let dataset = Dataset::new("tda-persist", columns, rows);
        let intervals = compute_persistence_intervals(&dataset, &["val"], &[0.0, 1.0, 5.0], 2.0);
        assert_eq!(intervals.len(), 3);
        assert_eq!(intervals[0].birth, 0.0);
        assert_eq!(intervals[0].death, None);
        assert_eq!(intervals[1].birth, 1.0);
        assert_eq!(intervals[1].death, Some(1.0));
        assert_eq!(intervals[2].birth, 5.0);
        assert_eq!(intervals[2].death, None);
    }

    #[test]
    fn betti0_monotone_sanity() {
        let columns = vec![Column::new("x", ColumnType::Numeric)];
        let rows = (0..20)
            .map(|index| HashMap::from([("x".to_string(), Value::Number(index as f64))]))
            .collect();
        let curve = compute_betti0_curve(&Dataset::new("tda-betti", columns, rows), &["x"], 10);
        assert!(!curve.is_empty());
        for index in 1..curve.len() {
            assert!(curve[index].betti0 <= curve[index - 1].betti0);
        }
        assert_eq!(curve.last().unwrap().betti0, 1);
    }

    #[test]
    fn betti0_bounding_box_diagonal_path_n_gt_100() {
        let columns = vec![Column::new("x", ColumnType::Numeric)];
        let rows = (0..110)
            .map(|index| HashMap::from([("x".to_string(), Value::Number(index as f64))]))
            .collect();
        let curve = compute_betti0_curve(&Dataset::new("tda-betti-large", columns, rows), &["x"], 20);
        assert!(!curve.is_empty());
        for index in 1..curve.len() {
            assert!(curve[index].betti0 <= curve[index - 1].betti0);
        }
        assert_eq!(curve.last().unwrap().betti0, 1);
    }
}

#[cfg(test)]
mod columnar_tda_tests {
    use super::*;

    fn parity_fixture() -> (Dataset, ColumnarDataset, Vec<&'static str>) {
        let columns = vec![
            Column::new("x", ColumnType::Numeric),
            Column::new("y", ColumnType::Numeric),
        ];
        let dataset = Dataset::new(
            "parity",
            columns,
            vec![
                HashMap::from([
                    ("x".to_string(), Value::Number(0.0)),
                    ("y".to_string(), Value::Number(0.0)),
                ]),
                HashMap::from([
                    ("x".to_string(), Value::Number(1.0)),
                    ("y".to_string(), Value::Number(0.5)),
                ]),
                HashMap::from([("y".to_string(), Value::Number(1.0))]),
                HashMap::from([
                    ("x".to_string(), Value::Number(1.0)),
                    ("y".to_string(), Value::Number(1.0)),
                ]),
            ],
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        (dataset, columnar, vec!["x", "y"])
    }

    fn spaces() -> (FeatureSpace, FeatureSpace) {
        let (dataset, columnar, features) = parity_fixture();
        let row_space = FeatureSpace::from_rows(&dataset, &features);
        let columnar_space = FeatureSpace::from_columnar(&dataset.columns, &columnar, &features)
            .expect("columnar feature space");
        (row_space, columnar_space)
    }

    #[test]
    fn columnar_mapper_parity() {
        let (row_space, columnar_space) = spaces();
        let row_graph = compute_mapper_graph_space(&row_space, &[], 4, 0.3);
        let columnar_graph = compute_mapper_graph_space(&columnar_space, &[], 4, 0.3);
        assert_eq!(row_graph.nodes.len(), columnar_graph.nodes.len());
        assert_eq!(row_graph.edges, columnar_graph.edges);
        for (row_node, columnar_node) in row_graph.nodes.iter().zip(columnar_graph.nodes.iter()) {
            assert_eq!(row_node.id, columnar_node.id);
            assert_eq!(row_node.row_indices, columnar_node.row_indices);
            assert_eq!(row_node.level, columnar_node.level);
            assert_eq!(row_node.center, columnar_node.center);
            assert_eq!(row_node.filter_center, columnar_node.filter_center);
            assert_eq!(row_node.size, columnar_node.size);
        }
    }

    #[test]
    fn columnar_persistence_parity() {
        let (row_space, columnar_space) = spaces();
        assert_eq!(
            compute_persistence_intervals_space(&row_space, &[], 1.0),
            compute_persistence_intervals_space(&columnar_space, &[], 1.0)
        );
    }

    #[test]
    fn columnar_betti0_parity() {
        let (row_space, columnar_space) = spaces();
        assert_eq!(
            compute_betti0_curve_space(&row_space, 8),
            compute_betti0_curve_space(&columnar_space, 8)
        );
    }

    #[test]
    fn columnar_filtration_derivation_parity() {
        let (row_space, columnar_space) = spaces();
        assert_eq!(row_space.first_feature, columnar_space.first_feature);
        assert_eq!(
            compute_mapper_graph_space(&row_space, &[], 4, 0.3).nodes.len(),
            compute_mapper_graph_space(&columnar_space, &[], 4, 0.3).nodes.len()
        );
    }

    #[test]
    fn unsupported_column_kind_fails_closed() {
        let columns = vec![
            Column::new("x", ColumnType::Numeric),
            Column::new("cohort", ColumnType::Categorical),
        ];
        let columnar = ColumnarDataset::from_parts(
            2,
            HashMap::from([(
                0,
                crate::data::columnar::PrimitiveColumn {
                    values: vec![0.0, 1.0],
                    validity: vec![1, 1],
                },
            )]),
            HashMap::from([(
                1,
                crate::data::columnar::CategoricalColumn {
                    dictionary: vec!["A".to_string(), "B".to_string()],
                    codes: vec![0, 1],
                    validity: vec![1, 1],
                },
            )]),
        )
        .expect("valid columnar dataset");
        assert_eq!(
            FeatureSpace::from_columnar(&columns, &columnar, &["cohort"]).unwrap_err(),
            ColumnarTdaError::UnsupportedColumnKind("cohort".into())
        );
        assert_eq!(
            FeatureSpace::from_columnar(&columns, &columnar, &["missing"]).unwrap_err(),
            ColumnarTdaError::UnknownColumn("missing".into())
        );
    }

    #[test]
    fn complete_case_excludes_missing_without_conflating_zero() {
        let (row_space, columnar_space) = spaces();
        assert_eq!(row_space.row_count(), 3);
        assert_eq!(columnar_space.row_count(), 3);
        assert_eq!(row_space.source_row_count(), 4);
        assert_eq!(columnar_space.source_row_count(), 4);
        assert_eq!(row_space.excluded_row_count(), 1);
        assert_eq!(columnar_space.excluded_row_count(), 1);
        assert_eq!(row_space.source_row_indices(), &[0, 1, 3]);
        assert_eq!(columnar_space.source_row_indices(), &[0, 1, 3]);
        assert_eq!(row_space.points(), columnar_space.points());
        assert_eq!(row_space.points()[0][0], 0.0);
        assert_eq!(row_space.missing_data_policy(), TDA_MISSING_DATA_POLICY);
    }

    #[test]
    fn mapper_preserves_original_row_identity() {
        let (row_space, columnar_space) = spaces();
        let full_source_filter = [0.0, 1.0, 999.0, 2.0];
        for graph in [
            compute_mapper_graph_space(&row_space, &full_source_filter, 4, 0.3),
            compute_mapper_graph_space(&columnar_space, &full_source_filter, 4, 0.3),
        ] {
            let rows: Vec<usize> = graph
                .nodes
                .iter()
                .flat_map(|node| node.row_indices.iter().copied())
                .collect();
            assert!(rows.iter().all(|row| *row != 2));
            assert!(rows.iter().all(|row| matches!(*row, 0 | 1 | 3)));
        }
    }

    #[test]
    fn missing_and_numeric_zero_are_not_metric_equivalent() {
        let columns = vec![Column::new("x", ColumnType::Numeric)];
        let missing = Dataset::new(
            "missing",
            columns.clone(),
            vec![
                HashMap::from([("x".to_string(), Value::Number(1.0))]),
                HashMap::from([("x".to_string(), Value::Null)]),
                HashMap::from([("x".to_string(), Value::Number(2.0))]),
            ],
        );
        let zero = Dataset::new(
            "zero",
            columns,
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
