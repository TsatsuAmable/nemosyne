use std::collections::HashMap;
use std::ops::Deref;

use serde::{Deserialize, Serialize};

use crate::data::column::{Column, ColumnType};
use crate::data::columnar::ColumnarDataset;
use crate::data::dataset::Dataset;

pub const POINT_CLOUD_MISSING_DATA_POLICY: &str = "complete_case_selected_features";
pub const MIN_BOUNDED_APPROXIMATION_EDGE_RECALL: f64 = 0.80;
pub const BOUNDED_APPROXIMATION_VALIDATION_ROWS: usize = 128;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PointCloudError {
    EmptyDataset,
    NoFeatureColumns,
    UnsupportedColumnType(String),
    MissingColumn(String),
    InvalidColumnLength(String),
}

impl std::fmt::Display for PointCloudError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyDataset => write!(f, "Dataset is empty"),
            Self::NoFeatureColumns => write!(f, "No feature columns provided"),
            Self::UnsupportedColumnType(col) => write!(f, "Unsupported column type: {}", col),
            Self::MissingColumn(col) => write!(f, "Missing column: {}", col),
            Self::InvalidColumnLength(col) => write!(f, "Invalid value/validity length for column: {}", col),
        }
    }
}

impl std::error::Error for PointCloudError {}

#[derive(Debug, Clone)]
pub struct PointCloud {
    pub columns: Vec<Vec<f64>>,
    pub n: usize,
    pub d: usize,
}

#[derive(Debug, Clone)]
pub struct IndexedPointCloud {
    pub cloud: PointCloud,
    pub source_row_indices: Vec<usize>,
    pub source_row_count: usize,
}

impl Deref for IndexedPointCloud {
    type Target = PointCloud;
    fn deref(&self) -> &Self::Target { &self.cloud }
}

impl IndexedPointCloud {
    pub fn excluded_row_count(&self) -> usize {
        self.source_row_count.saturating_sub(self.cloud.n)
    }
    pub fn missing_data_policy(&self) -> &'static str { POINT_CLOUD_MISSING_DATA_POLICY }
}

impl PointCloud {
    pub fn from_dataset(dataset: &Dataset, feature_columns: &[String]) -> Result<IndexedPointCloud, PointCloudError> {
        let source_row_count = dataset.rows.len();
        if source_row_count == 0 { return Err(PointCloudError::EmptyDataset); }
        if feature_columns.is_empty() { return Err(PointCloudError::NoFeatureColumns); }

        for name in feature_columns {
            let column = dataset.columns.iter().find(|column| column.name == *name)
                .ok_or_else(|| PointCloudError::MissingColumn(name.clone()))?;
            if !matches!(column.ty, ColumnType::Numeric | ColumnType::Temporal) {
                return Err(PointCloudError::UnsupportedColumnType(name.clone()));
            }
        }

        let mut source_row_indices = Vec::with_capacity(source_row_count);
        for (source_row, row) in dataset.rows.iter().enumerate() {
            let eligible = feature_columns.iter().all(|name| {
                row.get(name).and_then(|value| value.as_number()).is_some_and(|value| value.is_finite())
            });
            if eligible { source_row_indices.push(source_row); }
        }

        let mut columns = Vec::with_capacity(feature_columns.len());
        for name in feature_columns {
            let values = source_row_indices.iter().map(|&source_row| {
                dataset.rows[source_row].get(name).and_then(|value| value.as_number())
                    .expect("eligible source row must contain a finite feature")
            }).collect();
            columns.push(values);
        }

        Ok(IndexedPointCloud {
            cloud: PointCloud { columns, n: source_row_indices.len(), d: feature_columns.len() },
            source_row_indices,
            source_row_count,
        })
    }

    pub fn from_columnar(
        columns: &[Column],
        dataset: &ColumnarDataset,
        feature_columns: &[String],
    ) -> Result<IndexedPointCloud, PointCloudError> {
        let source_row_count = dataset.row_count();
        if source_row_count == 0 { return Err(PointCloudError::EmptyDataset); }
        if feature_columns.is_empty() { return Err(PointCloudError::NoFeatureColumns); }

        let refs: Vec<&str> = feature_columns.iter().map(String::as_str).collect();
        let borrowed = crate::data::point_access::borrowed_feature_columns(columns, dataset, &refs)
            .map_err(|err| match err {
                crate::data::point_access::PointAccessError::MissingColumn(name) => PointCloudError::MissingColumn(name),
                crate::data::point_access::PointAccessError::UnsupportedColumnKind(name) => PointCloudError::UnsupportedColumnType(name),
                crate::data::point_access::PointAccessError::InvalidColumnLength(name) => PointCloudError::InvalidColumnLength(name),
            })?;
        let source_row_indices = crate::data::point_access::complete_case_row_indices(&borrowed, source_row_count);
        let column_vecs = borrowed.iter().map(|column| {
            source_row_indices.iter().map(|&source_row| column.values[source_row]).collect()
        }).collect();

        Ok(IndexedPointCloud {
            cloud: PointCloud { d: feature_columns.len(), columns: column_vecs, n: source_row_indices.len() },
            source_row_indices,
            source_row_count,
        })
    }

    pub fn bounding_box_diagonal(&self) -> f64 {
        if self.n <= 1 || self.d == 0 { return 0.0; }
        let mut sum_sq = 0.0;
        for col in &self.columns {
            let mut min_val = f64::INFINITY;
            let mut max_val = f64::NEG_INFINITY;
            for &val in col {
                if val < min_val { min_val = val; }
                if val > max_val { max_val = val; }
            }
            if min_val.is_finite() && max_val.is_finite() && max_val >= min_val {
                let span = max_val - min_val;
                sum_sq += span * span;
            }
        }
        sum_sq.sqrt()
    }

    #[inline(always)]
    pub fn dist_sq(&self, i: usize, j: usize) -> f64 {
        if i == j { return 0.0; }
        let mut sum = 0.0;
        for col in &self.columns {
            let diff = col[i] - col[j];
            sum += diff * diff;
        }
        sum
    }

    #[inline(always)]
    pub fn dist(&self, i: usize, j: usize) -> f64 { self.dist_sq(i, j).sqrt() }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RaggedNeighbourhood {
    pub offsets: Vec<u32>,
    pub indices: Vec<u32>,
    pub dists: Vec<f32>,
}

impl RaggedNeighbourhood {
    pub fn new(offsets: Vec<u32>, indices: Vec<u32>, dists: Vec<f32>) -> Self { Self { offsets, indices, dists } }
    pub fn node_count(&self) -> usize { if self.offsets.is_empty() { 0 } else { self.offsets.len() - 1 } }
    pub fn edge_count(&self) -> usize { self.indices.len() }
    pub fn neighbors(&self, i: usize) -> impl Iterator<Item = (usize, f32)> + '_ {
        let start = self.offsets[i] as usize;
        let end = self.offsets[i + 1] as usize;
        (start..end).map(move |idx| (self.indices[idx] as usize, self.dists[idx]))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NeighbourhoodMode {
    Exact,
    Sparse { #[serde(rename = "gridCell")] grid_cell: f64 },
    Landmark { seed: u32, count: usize },
    BoundedLandmark { seed: u32, count: usize, #[serde(rename = "maxNeighbors")] max_neighbors: usize },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NeighbourhoodMeta {
    pub mode: NeighbourhoodMode,
    pub n: usize,
    pub d: usize,
    pub radius: f64,
    pub build_digest: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApproximationQualityEvidence {
    pub validation_sample_rows: usize,
    pub exact_undirected_edges: usize,
    pub approximate_undirected_edges: usize,
    pub matched_undirected_edges: usize,
    pub edge_recall: f64,
    pub false_positive_edges: usize,
    pub exact_components: usize,
    pub approximate_components: usize,
    pub minimum_required_edge_recall: f64,
    pub passed: bool,
}

pub trait NeighbourIndex {
    fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta);
}

pub struct ExactIndex;
impl ExactIndex {
    pub fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) {
        let n = cloud.n;
        let d = cloud.d;
        let eps_sq = eps * eps;
        let mut offsets = Vec::with_capacity(n + 1);
        let mut indices = Vec::new();
        let mut dists = Vec::new();
        offsets.push(0);
        for i in 0..n {
            for j in 0..n {
                if i == j { continue; }
                let d_sq = cloud.dist_sq(i, j);
                if d_sq <= eps_sq {
                    indices.push(j as u32);
                    dists.push(d_sq.sqrt() as f32);
                }
            }
            offsets.push(indices.len() as u32);
        }
        let meta = NeighbourhoodMeta {
            mode: NeighbourhoodMode::Exact,
            n, d, radius: eps,
            build_digest: compute_build_digest("exact", n, d, eps, 0),
        };
        (RaggedNeighbourhood::new(offsets, indices, dists), meta)
    }
}
impl NeighbourIndex for ExactIndex {
    fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) { self.radius_neighbourhood(cloud, eps) }
}

pub struct GridSparseIndex { pub cell_size: f64 }
impl GridSparseIndex {
    pub fn new(cell_size: f64) -> Self { Self { cell_size } }
    pub fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) {
        let n = cloud.n;
        let d = cloud.d;
        if d > 6 { return ExactIndex.radius_neighbourhood(cloud, eps); }
        let eps_sq = eps * eps;
        let cell = if self.cell_size > 0.0 { self.cell_size } else { eps.max(0.0001) };
        let mut grid: HashMap<Vec<i64>, Vec<usize>> = HashMap::new();
        let mut point_cells = Vec::with_capacity(n);
        for i in 0..n {
            let mut cell_coords = Vec::with_capacity(d);
            for col in &cloud.columns { cell_coords.push((col[i] / cell).floor() as i64); }
            grid.entry(cell_coords.clone()).or_default().push(i);
            point_cells.push(cell_coords);
        }
        let mut offsets = Vec::with_capacity(n + 1);
        let mut indices = Vec::new();
        let mut dists = Vec::new();
        offsets.push(0);
        let neighbor_offsets = generate_neighbor_offsets(d);
        for i in 0..n {
            let center_cell = &point_cells[i];
            let mut point_neighbors = Vec::new();
            for delta in &neighbor_offsets {
                let mut neighbor_cell = Vec::with_capacity(d);
                for dim in 0..d { neighbor_cell.push(center_cell[dim] + delta[dim]); }
                if let Some(bucket) = grid.get(&neighbor_cell) {
                    for &j in bucket {
                        if i == j { continue; }
                        let d_sq = cloud.dist_sq(i, j);
                        if d_sq <= eps_sq { point_neighbors.push((j as u32, d_sq.sqrt() as f32)); }
                    }
                }
            }
            point_neighbors.sort_by_key(|&(j, _)| j);
            point_neighbors.dedup_by_key(|&mut (j, _)| j);
            for (j, dist) in point_neighbors { indices.push(j); dists.push(dist); }
            offsets.push(indices.len() as u32);
        }
        let meta = NeighbourhoodMeta {
            mode: NeighbourhoodMode::Sparse { grid_cell: cell },
            n, d, radius: eps,
            build_digest: compute_build_digest("sparse", n, d, eps, (cell * 1000.0) as u64),
        };
        (RaggedNeighbourhood::new(offsets, indices, dists), meta)
    }
}
impl NeighbourIndex for GridSparseIndex {
    fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) { self.radius_neighbourhood(cloud, eps) }
}

fn select_landmarks(cloud: &PointCloud, seed: u32, count: usize) -> Vec<usize> {
    let n = cloud.n;
    if n == 0 { return Vec::new(); }
    let k = count.min(n).max(1);
    if k == n { return (0..n).collect(); }
    let lcg_start = (seed as u64).wrapping_mul(6364136223846793005).wrapping_add(1);
    let first = (lcg_start as usize) % n;
    let mut landmarks = vec![first];
    let mut dist_to_set: Vec<f64> = (0..n).map(|i| cloud.dist_sq(i, first)).collect();
    while landmarks.len() < k {
        let next = dist_to_set.iter().enumerate()
            .filter(|(i, _)| !landmarks.contains(i))
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i).unwrap_or(0);
        landmarks.push(next);
        for (i, min_distance) in dist_to_set.iter_mut().enumerate() {
            let d_sq = cloud.dist_sq(i, next);
            if d_sq < *min_distance { *min_distance = d_sq; }
        }
    }
    landmarks
}

pub struct LandmarkIndex { pub seed: u32, pub count: usize }
impl LandmarkIndex {
    pub fn new(seed: u32, count: usize) -> Self { Self { seed, count } }
    pub fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) {
        let n = cloud.n;
        let d = cloud.d;
        let eps_sq = eps * eps;
        let landmarks = select_landmarks(cloud, self.seed, self.count);
        let k = landmarks.len();
        let mut landmark_buckets: Vec<Vec<usize>> = vec![Vec::new(); k];
        for (l_idx, &landmark_pt) in landmarks.iter().enumerate() {
            for i in 0..n {
                if cloud.dist_sq(i, landmark_pt) <= eps_sq { landmark_buckets[l_idx].push(i); }
            }
        }
        let mut point_to_landmarks: Vec<Vec<usize>> = vec![Vec::new(); n];
        for (l_idx, bucket) in landmark_buckets.iter().enumerate() {
            for &pt in bucket { point_to_landmarks[pt].push(l_idx); }
        }
        let mut offsets = Vec::with_capacity(n + 1);
        let mut indices = Vec::new();
        let mut dists = Vec::new();
        offsets.push(0);
        for i in 0..n {
            let mut seen = std::collections::HashSet::new();
            let mut neighbors = Vec::new();
            for &l_idx in &point_to_landmarks[i] {
                for &j in &landmark_buckets[l_idx] {
                    if j == i || !seen.insert(j) { continue; }
                    let d_sq = cloud.dist_sq(i, j);
                    if d_sq <= eps_sq { neighbors.push((j as u32, d_sq.sqrt() as f32)); }
                }
            }
            neighbors.sort_by_key(|&(j, _)| j);
            for (j, dist) in neighbors { indices.push(j); dists.push(dist); }
            offsets.push(indices.len() as u32);
        }
        let meta = NeighbourhoodMeta {
            mode: NeighbourhoodMode::Landmark { seed: self.seed, count: k },
            n, d, radius: eps,
            build_digest: compute_build_digest("landmark", n, d, eps, (self.seed as u64) ^ ((k as u64) << 32)),
        };
        (RaggedNeighbourhood::new(offsets, indices, dists), meta)
    }
}
impl NeighbourIndex for LandmarkIndex {
    fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) { self.radius_neighbourhood(cloud, eps) }
}

/// A truly bounded approximate radius graph. Points are assigned to their
/// nearest deterministic landmark, then each point compares with a bounded,
/// evenly-spread candidate set from that bucket. At most `max_neighbors`
/// nearest radius-valid neighbours are retained before symmetric closure.
/// Work is O(N*(K+C)*D), with C bounded by 4*max_neighbors; emitted edges are
/// always true radius edges, so approximation can lose recall but cannot invent
/// a distance-valid relationship.
pub struct BoundedLandmarkIndex {
    pub seed: u32,
    pub count: usize,
    pub max_neighbors: usize,
}

impl BoundedLandmarkIndex {
    pub fn new(seed: u32, count: usize, max_neighbors: usize) -> Self {
        Self { seed, count: count.max(1), max_neighbors: max_neighbors.max(1) }
    }

    pub fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) {
        let n = cloud.n;
        let d = cloud.d;
        if n == 0 {
            return (
                RaggedNeighbourhood::new(vec![0], Vec::new(), Vec::new()),
                NeighbourhoodMeta {
                    mode: NeighbourhoodMode::BoundedLandmark { seed: self.seed, count: 0, max_neighbors: self.max_neighbors },
                    n, d, radius: eps,
                    build_digest: compute_build_digest("bounded-landmark", n, d, eps, self.seed as u64),
                },
            );
        }
        let landmarks = select_landmarks(cloud, self.seed, self.count);
        let k = landmarks.len();
        let mut assignments = vec![0usize; n];
        let mut buckets: Vec<Vec<usize>> = vec![Vec::new(); k];
        for i in 0..n {
            let mut best = 0usize;
            let mut best_dist = f64::INFINITY;
            for (landmark_index, &landmark) in landmarks.iter().enumerate() {
                let distance = cloud.dist_sq(i, landmark);
                if distance < best_dist || (distance == best_dist && landmark_index < best) {
                    best = landmark_index;
                    best_dist = distance;
                }
            }
            assignments[i] = best;
            buckets[best].push(i);
        }

        let candidate_cap = self.max_neighbors.saturating_mul(4).max(self.max_neighbors);
        let eps_sq = eps * eps;
        let mut directed: Vec<Vec<(usize, f32)>> = vec![Vec::new(); n];
        for i in 0..n {
            let bucket = &buckets[assignments[i]];
            let candidates = spread_indices(bucket, candidate_cap);
            let mut nearby: Vec<(usize, f32)> = candidates.into_iter().filter_map(|j| {
                if i == j { return None; }
                let d_sq = cloud.dist_sq(i, j);
                (d_sq <= eps_sq).then_some((j, d_sq.sqrt() as f32))
            }).collect();
            nearby.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal).then_with(|| a.0.cmp(&b.0)));
            nearby.truncate(self.max_neighbors);
            directed[i] = nearby;
        }

        // Symmetric closure preserves undirected clustering semantics. The
        // post-closure degree can be at most 2*max_neighbors in the resource
        // estimate because every retained directed edge contributes at most one
        // reverse edge.
        let snapshot = directed.clone();
        for (i, neighbors) in snapshot.iter().enumerate() {
            for &(j, dist) in neighbors {
                if !directed[j].iter().any(|(candidate, _)| *candidate == i) {
                    directed[j].push((i, dist));
                }
            }
        }
        let mut offsets = Vec::with_capacity(n + 1);
        let mut indices = Vec::new();
        let mut dists = Vec::new();
        offsets.push(0);
        for neighbors in &mut directed {
            neighbors.sort_by_key(|(j, _)| *j);
            neighbors.dedup_by_key(|(j, _)| *j);
            for &(j, dist) in neighbors.iter() { indices.push(j as u32); dists.push(dist); }
            offsets.push(indices.len() as u32);
        }
        let meta = NeighbourhoodMeta {
            mode: NeighbourhoodMode::BoundedLandmark { seed: self.seed, count: k, max_neighbors: self.max_neighbors },
            n, d, radius: eps,
            build_digest: compute_build_digest(
                "bounded-landmark", n, d, eps,
                (self.seed as u64) ^ ((k as u64) << 32) ^ self.max_neighbors as u64,
            ),
        };
        (RaggedNeighbourhood::new(offsets, indices, dists), meta)
    }
}

impl NeighbourIndex for BoundedLandmarkIndex {
    fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) { self.radius_neighbourhood(cloud, eps) }
}

fn spread_indices(values: &[usize], cap: usize) -> Vec<usize> {
    if values.len() <= cap { return values.to_vec(); }
    if cap <= 1 { return vec![values[0]]; }
    (0..cap).map(|slot| {
        let index = slot.saturating_mul(values.len().saturating_sub(1)) / cap.saturating_sub(1);
        values[index]
    }).collect()
}

fn sample_cloud(cloud: &PointCloud, limit: usize) -> PointCloud {
    let count = cloud.n.min(limit);
    if count == cloud.n { return cloud.clone(); }
    let indices: Vec<usize> = (0..count).map(|slot| {
        slot.saturating_mul(cloud.n.saturating_sub(1)) / count.saturating_sub(1).max(1)
    }).collect();
    let columns = cloud.columns.iter().map(|column| indices.iter().map(|&i| column[i]).collect()).collect();
    PointCloud { columns, n: count, d: cloud.d }
}

fn undirected_edges(csr: &RaggedNeighbourhood) -> std::collections::HashSet<(usize, usize)> {
    let mut edges = std::collections::HashSet::new();
    for source in 0..csr.node_count() {
        for (target, _) in csr.neighbors(source) {
            if source != target { edges.insert((source.min(target), source.max(target))); }
        }
    }
    edges
}

fn component_count(csr: &RaggedNeighbourhood) -> usize {
    let n = csr.node_count();
    let mut parent: Vec<usize> = (0..n).collect();
    fn find(parent: &mut [usize], mut i: usize) -> usize {
        while parent[i] != i { parent[i] = parent[parent[i]]; i = parent[i]; }
        i
    }
    for source in 0..n {
        for (target, _) in csr.neighbors(source) {
            let a = find(&mut parent, source);
            let b = find(&mut parent, target);
            if a != b { parent[a] = b; }
        }
    }
    (0..n).filter(|&i| find(&mut parent, i) == i).count()
}

pub fn validate_bounded_landmark_quality(
    cloud: &PointCloud,
    eps: f64,
    seed: u32,
    count: usize,
    max_neighbors: usize,
) -> ApproximationQualityEvidence {
    let sample = sample_cloud(cloud, BOUNDED_APPROXIMATION_VALIDATION_ROWS);
    let (exact, _) = ExactIndex.radius_neighbourhood(&sample, eps);
    let sample_landmarks = count.min(sample.n.max(1));
    let (approximate, _) = BoundedLandmarkIndex::new(seed, sample_landmarks, max_neighbors)
        .radius_neighbourhood(&sample, eps);
    let exact_edges = undirected_edges(&exact);
    let approximate_edges = undirected_edges(&approximate);
    let matched = approximate_edges.intersection(&exact_edges).count();
    let false_positive_edges = approximate_edges.difference(&exact_edges).count();
    let edge_recall = if exact_edges.is_empty() { 1.0 } else { matched as f64 / exact_edges.len() as f64 };
    let exact_components = component_count(&exact);
    let approximate_components = component_count(&approximate);
    let passed = false_positive_edges == 0
        && edge_recall >= MIN_BOUNDED_APPROXIMATION_EDGE_RECALL
        && exact_components == approximate_components;
    ApproximationQualityEvidence {
        validation_sample_rows: sample.n,
        exact_undirected_edges: exact_edges.len(),
        approximate_undirected_edges: approximate_edges.len(),
        matched_undirected_edges: matched,
        edge_recall,
        false_positive_edges,
        exact_components,
        approximate_components,
        minimum_required_edge_recall: MIN_BOUNDED_APPROXIMATION_EDGE_RECALL,
        passed,
    }
}

fn generate_neighbor_offsets(d: usize) -> Vec<Vec<i64>> {
    if d == 0 { return vec![vec![]]; }
    let mut result = vec![vec![]];
    for _ in 0..d {
        let mut next = Vec::new();
        for prev in result {
            for step in -1..=1 {
                let mut v = prev.clone(); v.push(step); next.push(v);
            }
        }
        result = next;
    }
    result
}

fn compute_build_digest(mode: &str, n: usize, d: usize, eps: f64, extra: u64) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in mode.as_bytes() { hash ^= *b as u64; hash = hash.wrapping_mul(0x100000001b3); }
    hash ^= n as u64; hash = hash.wrapping_mul(0x100000001b3);
    hash ^= d as u64; hash = hash.wrapping_mul(0x100000001b3);
    hash ^= eps.to_bits(); hash = hash.wrapping_mul(0x100000001b3);
    hash ^= extra; hash = hash.wrapping_mul(0x100000001b3);
    format!("{:016x}", hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn c1_csr_correctness_and_determinism() {
        let mut col1 = Vec::new(); let mut col2 = Vec::new();
        for i in 0..50 { col1.push(i as f64 * 0.5); col2.push((50 - i) as f64 * 0.3); }
        let cloud = PointCloud { columns: vec![col1, col2], n: 50, d: 2 };
        let (csr_exact, meta_exact) = ExactIndex.radius_neighbourhood(&cloud, 2.0);
        let (csr_sparse, meta_sparse) = GridSparseIndex::new(2.0).radius_neighbourhood(&cloud, 2.0);
        assert_eq!(csr_exact.offsets, csr_sparse.offsets);
        assert_eq!(csr_exact.indices, csr_sparse.indices);
        assert_eq!(csr_exact.dists, csr_sparse.dists);
        assert!(!meta_exact.build_digest.is_empty()); assert!(!meta_sparse.build_digest.is_empty());
    }

    #[test]
    fn c2_high_dimensional_diagonal_parity_rf018() {
        let d = 7; let pt_a = vec![0.7; d]; let pt_b = vec![1.1; d]; let mut columns = vec![Vec::new(); d];
        for dim in 0..d { columns[dim].push(pt_a[dim]); columns[dim].push(pt_b[dim]); }
        let cloud = PointCloud { columns, n: 2, d };
        let (csr_exact, _) = ExactIndex.radius_neighbourhood(&cloud, 1.2);
        let (csr_sparse, _) = GridSparseIndex::new(1.0).radius_neighbourhood(&cloud, 1.2);
        assert_eq!(csr_exact.offsets, csr_sparse.offsets); assert_eq!(csr_exact.indices, csr_sparse.indices);
    }

    #[test]
    fn c3_grid_sparse_soundness() {
        let col: Vec<f64> = (0..100).map(|i| i as f64 * 0.1).collect();
        let cloud = PointCloud { columns: vec![col], n: 100, d: 1 };
        let (exact, _) = ExactIndex.radius_neighbourhood(&cloud, 0.25);
        let (sparse, _) = GridSparseIndex::new(0.25).radius_neighbourhood(&cloud, 0.25);
        assert_eq!(exact, sparse);
    }

    #[test]
    fn c4_determinism_across_runs() {
        let cloud = PointCloud { columns: vec![vec![1.0, 2.5, 3.2, 4.8, 5.1]], n: 5, d: 1 };
        let idx = GridSparseIndex::new(1.5);
        let (csr1, meta1) = idx.radius_neighbourhood(&cloud, 1.5);
        let (csr2, meta2) = idx.radius_neighbourhood(&cloud, 1.5);
        assert_eq!(csr1, csr2); assert_eq!(meta1.build_digest, meta2.build_digest);
    }

    #[test]
    fn c5_landmark_mode_determinism() {
        let col: Vec<f64> = (0..30).map(|i| i as f64 * 0.2).collect();
        let cloud = PointCloud { columns: vec![col], n: 30, d: 1 };
        let lm = LandmarkIndex::new(42, 5);
        let (csr1, meta1) = lm.radius_neighbourhood(&cloud, 1.0);
        let (csr2, meta2) = lm.radius_neighbourhood(&cloud, 1.0);
        assert_eq!(csr1, csr2); assert_eq!(meta1.build_digest, meta2.build_digest);
    }

    #[test]
    fn bounded_mode_is_deterministic_and_hard_bounded() {
        let col: Vec<f64> = (0..200).map(|i| i as f64 * 0.25).collect();
        let cloud = PointCloud { columns: vec![col], n: 200, d: 1 };
        let idx = BoundedLandmarkIndex::new(17, 16, 4);
        let (a, meta_a) = idx.radius_neighbourhood(&cloud, 0.6);
        let (b, meta_b) = idx.radius_neighbourhood(&cloud, 0.6);
        assert_eq!(a, b); assert_eq!(meta_a.build_digest, meta_b.build_digest);
        assert!(a.edge_count() <= cloud.n * 4 * 2, "symmetric closure is bounded by 2*N*maxNeighbors");
    }

    #[test]
    fn bounded_mode_never_invents_radius_edges() {
        let col: Vec<f64> = (0..80).map(|i| i as f64 * 0.3).collect();
        let cloud = PointCloud { columns: vec![col], n: 80, d: 1 };
        let (exact, _) = ExactIndex.radius_neighbourhood(&cloud, 0.7);
        let (approx, _) = BoundedLandmarkIndex::new(2, 12, 6).radius_neighbourhood(&cloud, 0.7);
        let exact_edges = undirected_edges(&exact);
        for edge in undirected_edges(&approx) { assert!(exact_edges.contains(&edge)); }
    }

    #[test]
    fn bounded_quality_gate_passes_on_sparse_chain_fixture() {
        let col: Vec<f64> = (0..100).map(|i| i as f64).collect();
        let cloud = PointCloud { columns: vec![col], n: 100, d: 1 };
        let evidence = validate_bounded_landmark_quality(&cloud, 1.1, 50, 50, 4);
        assert_eq!(evidence.false_positive_edges, 0);
        assert_eq!(evidence.exact_components, evidence.approximate_components);
        assert!(evidence.passed, "quality evidence: {evidence:?}");
    }

    #[test]
    fn c6_bounding_box_diagonal_property() {
        let cloud = PointCloud { columns: vec![vec![0.0, 3.0], vec![0.0, 4.0]], n: 2, d: 2 };
        assert!((cloud.bounding_box_diagonal() - 5.0).abs() < 1e-6);
    }

    #[test]
    fn c7_rf007_shared_substrate_complete_case_parity() {
        use crate::data::column::{Column as DataColumn, ColumnType};
        use crate::data::columnar::ColumnarDataset;
        use crate::data::topology::FeatureSpace;
        use crate::data::value::Value;
        let cols = vec![DataColumn::new("x", ColumnType::Numeric), DataColumn::new("y", ColumnType::Numeric)];
        let rows = vec![
            HashMap::from([("x".to_string(), Value::Number(0.0)), ("y".to_string(), Value::Number(0.0))]),
            HashMap::from([("x".to_string(), Value::Null), ("y".to_string(), Value::Number(1.0))]),
            HashMap::from([("x".to_string(), Value::Number(2.0)), ("y".to_string(), Value::Number(2.0))]),
        ];
        let ds = Dataset::new("parity", cols, rows); let columnar = ColumnarDataset::from_dataset(&ds);
        let cloud = PointCloud::from_columnar(&ds.columns, &columnar, &["x".to_string(), "y".to_string()]).unwrap();
        let space = FeatureSpace::from_columnar(&ds.columns, &columnar, &["x", "y"]).unwrap();
        assert_eq!(cloud.n, 2); assert_eq!(space.row_count(), 2); assert_eq!(cloud.source_row_indices, vec![0, 2]);
        assert_eq!(cloud.excluded_row_count(), 1); assert_eq!(cloud.missing_data_policy(), POINT_CLOUD_MISSING_DATA_POLICY);
        for local in 0..cloud.n { for dimension in 0..cloud.d { assert_eq!(cloud.columns[dimension][local], space.points()[local][dimension]); } }
        assert_eq!(cloud.columns[0][0], 0.0);
    }

    #[test]
    fn c8_rf007_row_and_columnar_pointcloud_preserve_same_source_map() {
        use crate::data::column::{Column as DataColumn, ColumnType}; use crate::data::columnar::ColumnarDataset; use crate::data::value::Value;
        let cols = vec![DataColumn::new("x", ColumnType::Numeric)];
        let rows = vec![HashMap::from([("x".to_string(), Value::Number(0.0))]), HashMap::from([("x".to_string(), Value::Null)]), HashMap::from([("x".to_string(), Value::Number(3.0))])];
        let ds = Dataset::new("parity", cols, rows); let columnar = ColumnarDataset::from_dataset(&ds);
        let row_cloud = PointCloud::from_dataset(&ds, &["x".to_string()]).unwrap();
        let col_cloud = PointCloud::from_columnar(&ds.columns, &columnar, &["x".to_string()]).unwrap();
        assert_eq!(row_cloud.source_row_indices, vec![0, 2]); assert_eq!(col_cloud.source_row_indices, vec![0, 2]); assert_eq!(row_cloud.columns, col_cloud.columns);
    }

    #[test]
    fn c9_rf007_from_parts_nonfinite_is_excluded_not_zero_imputed() {
        use crate::data::column::{Column as DataColumn, ColumnType}; use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};
        let cols = vec![DataColumn::new("x", ColumnType::Numeric)];
        let columnar = ColumnarDataset::from_parts(2, std::collections::HashMap::from([(0, PrimitiveColumn { values: vec![1.0, f64::NAN], validity: vec![1, 1] })]), std::collections::HashMap::new()).unwrap();
        let cloud = PointCloud::from_columnar(&cols, &columnar, &["x".to_string()]).unwrap();
        assert_eq!(cloud.source_row_indices, vec![0]); assert_eq!(cloud.columns[0], &[1.0]); assert_eq!(cloud.excluded_row_count(), 1);
    }
}