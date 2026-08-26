use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::data::column::Column;
use crate::data::columnar::ColumnarDataset;
use crate::data::dataset::Dataset;

/// Error type when constructing PointCloud from columnar or row inputs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PointCloudError {
    EmptyDataset,
    NoFeatureColumns,
    UnsupportedColumnType(String),
    MissingColumn(String),
}

impl std::fmt::Display for PointCloudError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyDataset => write!(f, "Dataset is empty"),
            Self::NoFeatureColumns => write!(f, "No feature columns provided"),
            Self::UnsupportedColumnType(col) => write!(f, "Unsupported column type: {}", col),
            Self::MissingColumn(col) => write!(f, "Missing column: {}", col),
        }
    }
}

impl std::error::Error for PointCloudError {}

/// Unified point view for numerical columns.
/// Stores columns as contiguous Vec<f64> arrays (column-major in memory, dimension-strided).
#[derive(Debug, Clone)]
pub struct PointCloud {
    pub columns: Vec<Vec<f64>>,
    pub n: usize,
    pub d: usize,
}

impl PointCloud {
    /// Construct point cloud from row-oriented Dataset.
    pub fn from_dataset(dataset: &Dataset, feature_columns: &[String]) -> Result<Self, PointCloudError> {
        let n = dataset.rows.len();
        if n == 0 {
            return Err(PointCloudError::EmptyDataset);
        }
        if feature_columns.is_empty() {
            return Err(PointCloudError::NoFeatureColumns);
        }

        let d = feature_columns.len();
        let mut columns = Vec::with_capacity(d);

        for col_name in feature_columns {
            let mut col_values = Vec::with_capacity(n);
            for row in &dataset.rows {
                let v = row.get(col_name).and_then(|val| val.as_number()).unwrap_or(0.0);
                col_values.push(v);
            }
            columns.push(col_values);
        }

        Ok(Self { columns, n, d })
    }

    /// Construct point cloud from ColumnarDataset without materialising row objects.
    ///
    /// RF-007: lookup + validity semantics are delegated to the shared
    /// `point_access` substrate, which borrows the primitive buffers and trusts
    /// the columnar primitive invariant (validity 0 ⇒ stored 0.0, all finite).
    /// The previous path cloned each buffer and re-normalized per element; this
    /// path clones once from the borrowed slice and drops the redundant
    /// normalize. Output is byte-identical for any dataset that honours the
    /// invariant (all public `ColumnarDataset` constructors do).
    pub fn from_columnar(
        columns: &[Column],
        dataset: &ColumnarDataset,
        feature_columns: &[String],
    ) -> Result<Self, PointCloudError> {
        let n = dataset.row_count();
        if n == 0 {
            return Err(PointCloudError::EmptyDataset);
        }
        if feature_columns.is_empty() {
            return Err(PointCloudError::NoFeatureColumns);
        }

        let refs: Vec<&str> = feature_columns.iter().map(|s| s.as_str()).collect();
        let column_vecs = crate::data::point_access::owned_feature_columns(columns, dataset, &refs)
            .map_err(|err| match err {
                crate::data::point_access::PointAccessError::MissingColumn(name) => {
                    PointCloudError::MissingColumn(name)
                }
                crate::data::point_access::PointAccessError::UnsupportedColumnKind(name) => {
                    PointCloudError::UnsupportedColumnType(name)
                }
            })?;

        Ok(Self {
            d: feature_columns.len(),
            columns: column_vecs,
            n,
        })
    }

    /// Compute the Euclidean diagonal of the axis-aligned bounding box covering all points.
    /// Runs in O(n · d) time and provides a tight upper bound for maximum pairwise distance.
    pub fn bounding_box_diagonal(&self) -> f64 {
        if self.n <= 1 || self.d == 0 {
            return 0.0;
        }
        let mut sum_sq = 0.0;
        for col in &self.columns {
            let mut min_val = f64::INFINITY;
            let mut max_val = f64::NEG_INFINITY;
            for &val in col {
                if val < min_val {
                    min_val = val;
                }
                if val > max_val {
                    max_val = val;
                }
            }
            if min_val.is_finite() && max_val.is_finite() && max_val >= min_val {
                let span = max_val - min_val;
                sum_sq += span * span;
            }
        }
        sum_sq.sqrt()
    }

    /// Squared Euclidean distance between points i and j.
    #[inline(always)]
    pub fn dist_sq(&self, i: usize, j: usize) -> f64 {
        if i == j {
            return 0.0;
        }
        let mut sum = 0.0;
        for col in &self.columns {
            let diff = col[i] - col[j];
            sum += diff * diff;
        }
        sum
    }

    /// Euclidean distance between points i and j.
    #[inline(always)]
    pub fn dist(&self, i: usize, j: usize) -> f64 {
        self.dist_sq(i, j).sqrt()
    }
}

/// Compressed Sparse Row (CSR) neighbourhood graph.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RaggedNeighbourhood {
    pub offsets: Vec<u32>,
    pub indices: Vec<u32>,
    pub dists: Vec<f32>,
}

impl RaggedNeighbourhood {
    pub fn new(offsets: Vec<u32>, indices: Vec<u32>, dists: Vec<f32>) -> Self {
        Self { offsets, indices, dists }
    }

    pub fn node_count(&self) -> usize {
        if self.offsets.is_empty() { 0 } else { self.offsets.len() - 1 }
    }

    pub fn edge_count(&self) -> usize {
        self.indices.len()
    }

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
    Sparse {
        #[serde(rename = "gridCell")]
        grid_cell: f64,
    },
    Landmark {
        seed: u32,
        count: usize,
    },
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

pub trait NeighbourIndex {
    fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta);
}

/// Exact brute-force all-pairs index.
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
                if i == j {
                    continue;
                }
                let d_sq = cloud.dist_sq(i, j);
                if d_sq <= eps_sq {
                    indices.push(j as u32);
                    dists.push(d_sq.sqrt() as f32);
                }
            }
            offsets.push(indices.len() as u32);
        }

        let build_digest = compute_build_digest("exact", n, d, eps, 0);
        let meta = NeighbourhoodMeta {
            mode: NeighbourhoodMode::Exact,
            n,
            d,
            radius: eps,
            build_digest,
        };

        (RaggedNeighbourhood::new(offsets, indices, dists), meta)
    }
}

impl NeighbourIndex for ExactIndex {
    fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) {
        self.radius_neighbourhood(cloud, eps)
    }
}

/// Grid-sparse spatial index with deterministic cell hashing.
pub struct GridSparseIndex {
    pub cell_size: f64,
}

impl GridSparseIndex {
    pub fn new(cell_size: f64) -> Self {
        Self { cell_size }
    }

    pub fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) {
        let n = cloud.n;
        let d = cloud.d;

        // When d > 6, 3^d grid cell enumeration becomes exponential (3^7 = 2187)
        // and omitting diagonal cells drops valid edges (RF-018 blocker).
        // To guarantee mathematical soundness across all dimensions, d > 6 falls back
        // to exact neighbor search.
        if d > 6 {
            return ExactIndex.radius_neighbourhood(cloud, eps);
        }

        let eps_sq = eps * eps;
        let cell = if self.cell_size > 0.0 { self.cell_size } else { eps.max(0.0001) };

        // Bucket points into grid cells: cell coordinates (i64, ..., i64)
        let mut grid: HashMap<Vec<i64>, Vec<usize>> = HashMap::new();
        let mut point_cells = Vec::with_capacity(n);

        for i in 0..n {
            let mut cell_coords = Vec::with_capacity(d);
            for col in &cloud.columns {
                let coord = (col[i] / cell).floor() as i64;
                cell_coords.push(coord);
            }
            grid.entry(cell_coords.clone()).or_default().push(i);
            point_cells.push(cell_coords);
        }

        let mut offsets = Vec::with_capacity(n + 1);
        let mut indices = Vec::new();
        let mut dists = Vec::new();

        offsets.push(0);

        // Precompute full neighbor cell offsets for dimension d
        let neighbor_offsets = generate_neighbor_offsets(d);

        for i in 0..n {
            let center_cell = &point_cells[i];
            let mut point_neighbors = Vec::new();

            for delta in &neighbor_offsets {
                let mut neighbor_cell = Vec::with_capacity(d);
                for dim in 0..d {
                    neighbor_cell.push(center_cell[dim] + delta[dim]);
                }
                if let Some(bucket) = grid.get(&neighbor_cell) {
                    for &j in bucket {
                        if i == j {
                            continue;
                        }
                        let d_sq = cloud.dist_sq(i, j);
                        if d_sq <= eps_sq {
                            point_neighbors.push((j as u32, d_sq.sqrt() as f32));
                        }
                    }
                }
            }

            // Sort neighbors deterministically by index
            point_neighbors.sort_by_key(|&(j, _)| j);
            point_neighbors.dedup_by_key(|&mut (j, _)| j);

            for (j, dist) in point_neighbors {
                indices.push(j);
                dists.push(dist);
            }
            offsets.push(indices.len() as u32);
        }

        let build_digest = compute_build_digest("sparse", n, d, eps, (cell * 1000.0) as u64);
        let meta = NeighbourhoodMeta {
            mode: NeighbourhoodMode::Sparse { grid_cell: cell },
            n,
            d,
            radius: eps,
            build_digest,
        };

        (RaggedNeighbourhood::new(offsets, indices, dists), meta)
    }
}

impl NeighbourIndex for GridSparseIndex {
    fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) {
        self.radius_neighbourhood(cloud, eps)
    }
}

/// Deterministic landmark-based approximate neighbourhood index.
///
/// **Approximate**: uses farthest-point sampling to place K landmarks across the
/// point cloud, then connects points sharing at least one landmark within radius
/// `eps`. Edges between points that do not share any landmark are not reported
/// even if the two points are within `eps`. This is by design — landmark mode
/// trades recall for O(K·N) build time vs O(N²) for exact search.
/// The `seed` controls the initial point (LCG); subsequent landmarks are chosen
/// by greedy farthest-point sampling for maximal coverage spread.
pub struct LandmarkIndex {
    pub seed: u32,
    pub count: usize,
}

impl LandmarkIndex {
    pub fn new(seed: u32, count: usize) -> Self {
        Self { seed, count }
    }

    pub fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) {
        let n = cloud.n;
        let d = cloud.d;
        let eps_sq = eps * eps;
        let k = self.count.min(n).max(1);

        // Select K landmarks using greedy farthest-point sampling for coverage.
        // Seed controls the deterministic initial point via a single LCG step.
        let mut landmarks: Vec<usize> = Vec::with_capacity(k);

        if k == n {
            landmarks.extend(0..n);
        } else {
            let lcg_start = (self.seed as u64).wrapping_mul(6364136223846793005).wrapping_add(1);
            let first = (lcg_start as usize) % n;
            landmarks.push(first);

            // dist_to_set[i] = min squared distance from point i to any chosen landmark.
            let mut dist_to_set: Vec<f64> = (0..n).map(|i| cloud.dist_sq(i, first)).collect();

            while landmarks.len() < k {
                // Pick the point with the maximum distance to the current landmark set.
                let next = dist_to_set
                    .iter()
                    .enumerate()
                    .filter(|&(i, _)| !landmarks.contains(&i))
                    .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
                    .map(|(i, _)| i)
                    .unwrap_or(0);
                landmarks.push(next);

                // Update min distances with the newly added landmark.
                for i in 0..n {
                    let d_sq = cloud.dist_sq(i, next);
                    if d_sq < dist_to_set[i] {
                        dist_to_set[i] = d_sq;
                    }
                }
            }
        }

        // For each point, record which landmarks are within radius eps.
        // Build per-landmark buckets to avoid O(N × k × N) inner scan.
        let mut landmark_buckets: Vec<Vec<usize>> = vec![Vec::new(); k];
        for (l_idx, &landmark_pt) in landmarks.iter().enumerate() {
            for i in 0..n {
                if cloud.dist_sq(i, landmark_pt) <= eps_sq {
                    landmark_buckets[l_idx].push(i);
                }
            }
        }

        // Build inverse: point → landmark indices it belongs to
        let mut point_to_landmarks: Vec<Vec<usize>> = vec![Vec::new(); n];
        for (l_idx, bucket) in landmark_buckets.iter().enumerate() {
            for &pt in bucket {
                point_to_landmarks[pt].push(l_idx);
            }
        }

        // Connect points sharing at least one landmark, subject to eps distance check.
        let mut offsets = Vec::with_capacity(n + 1);
        let mut indices = Vec::new();
        let mut dists = Vec::new();
        offsets.push(0);

        for i in 0..n {
            let mut seen = std::collections::HashSet::new();
            let mut neighbors: Vec<(u32, f32)> = Vec::new();

            for &l_idx in &point_to_landmarks[i] {
                for &j in &landmark_buckets[l_idx] {
                    if j == i || !seen.insert(j) {
                        continue;
                    }
                    let d_sq = cloud.dist_sq(i, j);
                    if d_sq <= eps_sq {
                        neighbors.push((j as u32, d_sq.sqrt() as f32));
                    }
                }
            }

            neighbors.sort_by_key(|&(j, _)| j);

            for (j, dist) in neighbors {
                indices.push(j);
                dists.push(dist);
            }
            offsets.push(indices.len() as u32);
        }

        let build_digest = compute_build_digest("landmark", n, d, eps, (self.seed as u64) ^ ((k as u64) << 32));
        let meta = NeighbourhoodMeta {
            mode: NeighbourhoodMode::Landmark {
                seed: self.seed,
                count: k,
            },
            n,
            d,
            radius: eps,
            build_digest,
        };

        (RaggedNeighbourhood::new(offsets, indices, dists), meta)
    }
}

impl NeighbourIndex for LandmarkIndex {
    fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta) {
        self.radius_neighbourhood(cloud, eps)
    }
}

fn generate_neighbor_offsets(d: usize) -> Vec<Vec<i64>> {
    if d == 0 {
        return vec![vec![]];
    }
    let mut result = vec![vec![]];
    for _ in 0..d {
        let mut next = Vec::new();
        for prev in result {
            for step in -1..=1 {
                let mut v = prev.clone();
                v.push(step);
                next.push(v);
            }
        }
        result = next;
    }
    result
}

fn compute_build_digest(mode: &str, n: usize, d: usize, eps: f64, extra: u64) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in mode.as_bytes() {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash ^= n as u64;
    hash = hash.wrapping_mul(0x100000001b3);
    hash ^= d as u64;
    hash = hash.wrapping_mul(0x100000001b3);
    hash ^= eps.to_bits();
    hash = hash.wrapping_mul(0x100000001b3);
    hash ^= extra;
    hash = hash.wrapping_mul(0x100000001b3);
    format!("{:016x}", hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn c1_csr_correctness_and_determinism() {
        let mut col1 = Vec::new();
        let mut col2 = Vec::new();
        for i in 0..50 {
            col1.push(i as f64 * 0.5);
            col2.push((50 - i) as f64 * 0.3);
        }
        let cloud = PointCloud {
            columns: vec![col1, col2],
            n: 50,
            d: 2,
        };

        let exact_idx = ExactIndex;
        let (csr_exact, meta_exact) = exact_idx.radius_neighbourhood(&cloud, 2.0);

        let sparse_idx = GridSparseIndex::new(2.0);
        let (csr_sparse, meta_sparse) = sparse_idx.radius_neighbourhood(&cloud, 2.0);

        assert_eq!(csr_exact.offsets, csr_sparse.offsets);
        assert_eq!(csr_exact.indices, csr_sparse.indices);
        assert_eq!(csr_exact.dists, csr_sparse.dists);
        assert!(!meta_exact.build_digest.is_empty());
        assert!(!meta_sparse.build_digest.is_empty());
    }

    #[test]
    fn c2_high_dimensional_diagonal_parity_rf018() {
        // Test in 7D where points are diagonal neighbours
        let d = 7;
        let mut pt_a = vec![0.7; d];
        let mut pt_b = vec![1.1; d];
        let mut columns = vec![Vec::new(); d];
        for dim in 0..d {
            columns[dim].push(pt_a[dim]);
            columns[dim].push(pt_b[dim]);
        }
        let cloud = PointCloud {
            columns,
            n: 2,
            d,
        };

        let exact_idx = ExactIndex;
        let (csr_exact, _) = exact_idx.radius_neighbourhood(&cloud, 1.2);

        let sparse_idx = GridSparseIndex::new(1.0);
        let (csr_sparse, _) = sparse_idx.radius_neighbourhood(&cloud, 1.2);

        assert_eq!(csr_exact.offsets, csr_sparse.offsets);
        assert_eq!(csr_exact.indices, csr_sparse.indices);
    }

    #[test]
    fn c3_grid_sparse_soundness() {
        let mut col = Vec::new();
        for i in 0..100 {
            col.push(i as f64 * 0.1);
        }
        let cloud = PointCloud {
            columns: vec![col],
            n: 100,
            d: 1,
        };

        let exact_idx = ExactIndex;
        let (csr_exact, _) = exact_idx.radius_neighbourhood(&cloud, 0.25);

        let sparse_idx = GridSparseIndex::new(0.25);
        let (csr_sparse, _) = sparse_idx.radius_neighbourhood(&cloud, 0.25);

        assert_eq!(csr_exact, csr_sparse);
    }

    #[test]
    fn c4_determinism_across_runs() {
        let col = vec![1.0, 2.5, 3.2, 4.8, 5.1];
        let cloud = PointCloud {
            columns: vec![col],
            n: 5,
            d: 1,
        };

        let idx = GridSparseIndex::new(1.5);
        let (csr1, meta1) = idx.radius_neighbourhood(&cloud, 1.5);
        let (csr2, meta2) = idx.radius_neighbourhood(&cloud, 1.5);

        assert_eq!(csr1, csr2);
        assert_eq!(meta1.build_digest, meta2.build_digest);
    }

    #[test]
    fn c5_landmark_mode_determinism() {
        let mut col1 = Vec::new();
        let mut col2 = Vec::new();
        for i in 0..30 {
            col1.push(i as f64 * 0.2);
            col2.push((30 - i) as f64 * 0.2);
        }
        let cloud = PointCloud {
            columns: vec![col1, col2],
            n: 30,
            d: 2,
        };

        let lm = LandmarkIndex::new(42, 5);
        let (csr1, meta1) = lm.radius_neighbourhood(&cloud, 1.0);
        let (csr2, meta2) = lm.radius_neighbourhood(&cloud, 1.0);

        assert_eq!(csr1, csr2);
        assert_eq!(meta1.build_digest, meta2.build_digest);
        assert_eq!(meta1.mode, NeighbourhoodMode::Landmark { seed: 42, count: 5 });
    }

    #[test]
    fn c5b_landmark_farthest_sampling_spreads_landmarks() {
        // Two tight clusters far apart. With k=2, farthest-point sampling must
        // pick one landmark in each cluster; random selection might not.
        let mut col = Vec::new();
        for i in 0..10 {
            col.push(i as f64 * 0.05); // cluster A: [0, 0.45]
        }
        for i in 0..10 {
            col.push(100.0 + i as f64 * 0.05); // cluster B: [100, 100.45]
        }
        let cloud = PointCloud { columns: vec![col], n: 20, d: 1 };

        let lm = LandmarkIndex::new(0, 2);
        let (csr, _) = lm.radius_neighbourhood(&cloud, 0.2);

        // Points in cluster A must see neighbours within cluster A.
        let a_neighbors: usize = (0..10).map(|i| csr.neighbors(i).count()).sum();
        assert!(a_neighbors > 0, "cluster A points should have neighbours");

        // Points in cluster B must see neighbours within cluster B.
        let b_neighbors: usize = (10..20).map(|i| csr.neighbors(i).count()).sum();
        assert!(b_neighbors > 0, "cluster B points should have neighbours");
    }

    #[test]
    fn c6_bounding_box_diagonal_property() {
        let cloud = PointCloud {
            columns: vec![vec![0.0, 3.0], vec![0.0, 4.0]],
            n: 2,
            d: 2,
        };
        let diag = cloud.bounding_box_diagonal();
        assert!((diag - 5.0).abs() < 1e-6);
    }

    /// RF-007: PointCloud and FeatureSpace share the same point-access
    /// substrate, so a columnar dataset with a missing value must yield the
    /// identical normalized column in both substrates (invalid ⇒ 0.0).
    #[test]
    fn c7_rf007_shared_substrate_columnar_validity_parity() {
        use crate::data::column::{Column as DataColumn, ColumnType};
        use crate::data::columnar::ColumnarDataset;
        use crate::data::dataset::Dataset;
        use crate::data::topology::FeatureSpace;
        use crate::data::value::Value;

        let cols = vec![
            DataColumn::new("x", ColumnType::Numeric),
            DataColumn::new("y", ColumnType::Numeric),
        ];
        let rows = vec![
            HashMap::from([
                ("x".to_string(), Value::Number(0.0)),
                ("y".to_string(), Value::Number(0.0)),
            ]),
            HashMap::from([
                ("x".to_string(), Value::Null),
                ("y".to_string(), Value::Number(1.0)),
            ]),
            HashMap::from([
                ("x".to_string(), Value::Number(2.0)),
                ("y".to_string(), Value::Number(2.0)),
            ]),
        ];
        let ds = Dataset::new("parity", cols, rows);
        let columnar = ColumnarDataset::from_dataset(&ds);

        let cloud =
            PointCloud::from_columnar(&ds.columns, &columnar, &["x".to_string(), "y".to_string()])
                .expect("point cloud");
        let space =
            FeatureSpace::from_columnar(&ds.columns, &columnar, &["x", "y"]).expect("feature space");

        // PointCloud is column-major; FeatureSpace is row-major. Both must
        // agree element-for-element on the normalized values, including the
        // missing-x row (1) which the invariant forces to 0.0.
        assert_eq!(cloud.n, space.row_count());
        for i in 0..cloud.n {
            for j in 0..cloud.d {
                assert_eq!(cloud.columns[j][i], space.points()[i][j]);
            }
        }
        // The missing-x row is normalized to 0.0 in both substrates.
        assert_eq!(cloud.columns[0][1], 0.0);
        assert_eq!(space.points()[1][0], 0.0);
    }

    /// RF-007: PointCloud::from_columnar trusts the columnar primitive
    /// invariant rather than re-normalizing; a non-finite input that survived
    /// ingest must still be normalized to 0.0 via the invariant (from_parts
    /// enforces it).
    #[test]
    fn c8_rf007_from_parts_invariant_normalizes_nonfinite() {
        use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};
        use crate::data::column::{Column as DataColumn, ColumnType};
        let cols = vec![DataColumn::new("x", ColumnType::Numeric)];
        // from_parts must normalize the NaN to 0.0 with validity 0.
        let columnar = ColumnarDataset::from_parts(
            2,
            std::collections::HashMap::from([(
                0,
                PrimitiveColumn {
                    values: vec![1.0, f64::NAN],
                    validity: vec![1, 1],
                },
            )]),
            std::collections::HashMap::new(),
        )
        .expect("from_parts");
        let prim = columnar.primitive_column(0).unwrap();
        assert!(prim.values.iter().all(|v| v.is_finite()));
        assert_eq!(prim.values[1], 0.0);
        assert_eq!(prim.validity[1], 0);

        let cloud = PointCloud::from_columnar(&cols, &columnar, &["x".to_string()]).unwrap();
        assert_eq!(cloud.columns[0], &[1.0, 0.0]);
    }
}
