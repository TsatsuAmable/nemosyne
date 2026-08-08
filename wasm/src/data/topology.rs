use std::collections::{HashMap, HashSet};
use crate::data::column::ColumnType;
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

/// Infer simple topology from column names and types.
pub fn infer(dataset: &Dataset) -> Topology {
    if dataset.has_temporal() {
        return Topology::TimeSeries;
    }
    if dataset
        .columns
        .iter()
        .any(|c| c.name.eq_ignore_ascii_case("parent") && c.ty == ColumnType::Categorical)
    {
        return Topology::Hierarchy;
    }
    if dataset
        .columns
        .iter()
        .any(|c| c.name.eq_ignore_ascii_case("source") && c.ty == ColumnType::Categorical)
    {
        return Topology::Graph;
    }
    Topology::Tabular
}

// ---------------------------------------------------------------------------
// Topological Data Analysis (TDA) Mapper & Persistence Engine
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct TdaMapperNode {
    pub id: usize,
    pub row_indices: Vec<usize>,
    pub level: usize,
    pub center: Vec<f64>,
    pub filter_center: f64,
    pub size: usize,
}

#[derive(Debug, Clone)]
pub struct TdaMapperGraph {
    pub nodes: Vec<TdaMapperNode>,
    pub edges: Vec<(usize, usize)>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PersistenceInterval {
    pub birth: f64,
    pub death: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BettiPoint {
    pub radius: f64,
    pub betti0: usize,
}

fn euclidean_dist(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b.iter()).map(|(x, y)| (x - y) * (x - y)).sum::<f64>().sqrt()
}

/// Compute TDA Mapper graph over dataset numeric feature columns.
pub fn compute_mapper_graph(
    dataset: &Dataset,
    feature_columns: &[&str],
    filter_values: &[f64],
    bins: usize,
    overlap: f64,
) -> TdaMapperGraph {
    if dataset.row_count() == 0 || filter_values.len() != dataset.row_count() {
        return TdaMapperGraph {
            nodes: Vec::new(),
            edges: Vec::new(),
        };
    }

    let values: Vec<Vec<f64>> = dataset
        .rows
        .iter()
        .map(|r| {
            feature_columns
                .iter()
                .map(|col| r.get(*col).and_then(|v| v.as_number()).unwrap_or(0.0))
                .collect()
        })
        .collect();

    let f_min = filter_values.iter().copied().fold(f64::INFINITY, f64::min);
    let f_max = filter_values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let span = (f_max - f_min).max(1e-6);
    let step = span / (bins as f64 - overlap * 2.0).max(1.0);

    let mut nodes: Vec<TdaMapperNode> = Vec::new();

    for i in 0..bins {
        let lo = f_min + i as f64 * step - overlap * step;
        let hi = lo + step + 2.0 * overlap * step;

        let bucket: Vec<usize> = (0..dataset.row_count())
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
pub fn compute_persistence_intervals(
    dataset: &Dataset,
    feature_columns: &[&str],
    filter_values: &[f64],
    max_distance: f64,
) -> Vec<PersistenceInterval> {
    let n = dataset.row_count();
    if n == 0 || filter_values.len() != n {
        return Vec::new();
    }

    let values: Vec<Vec<f64>> = dataset
        .rows
        .iter()
        .map(|r| {
            feature_columns
                .iter()
                .map(|col| r.get(*col).and_then(|v| v.as_number()).unwrap_or(0.0))
                .collect()
        })
        .collect();

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

    intervals
}

/// Compute Betti-0 curve over distance radius steps.
pub fn compute_betti0_curve(
    dataset: &Dataset,
    feature_columns: &[&str],
    steps: usize,
) -> Vec<BettiPoint> {
    let n = dataset.row_count();
    if n == 0 {
        return Vec::new();
    }

    let values: Vec<Vec<f64>> = dataset
        .rows
        .iter()
        .map(|r| {
            feature_columns
                .iter()
                .map(|col| r.get(*col).and_then(|v| v.as_number()).unwrap_or(0.0))
                .collect()
        })
        .collect();

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
    use crate::data::column::Column;

    #[test]
    fn infers_topology_types() {
        let cols = vec![Column::new("parent", ColumnType::Categorical)];
        let ds = Dataset::new("hier", cols, vec![]);
        assert_eq!(infer(&ds), Topology::Hierarchy);
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
}
