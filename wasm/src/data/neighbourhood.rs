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

        let d = feature_columns.len();
        let mut column_vecs = Vec::with_capacity(d);

        for col_name in feature_columns {
            let index = columns
                .iter()
                .position(|c| &c.name == col_name)
                .ok_or_else(|| PointCloudError::MissingColumn(col_name.clone()))?;

            match dataset.primitive_column(index) {
                Some(prim) => column_vecs.push(prim.values.clone()),
                None => return Err(PointCloudError::UnsupportedColumnType(col_name.clone())),
            }
        }

        Ok(Self {
            columns: column_vecs,
            n,
            d,
        })
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

        // Precompute neighbor cell offsets for dimension d
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

fn generate_neighbor_offsets(d: usize) -> Vec<Vec<i64>> {
    if d == 0 {
        return vec![vec![]];
    }
    if d > 6 {
        // For higher dimensions, cap neighbor search to immediate axis-aligned and center
        let mut res = vec![vec![0; d]];
        for dim in 0..d {
            let mut plus = vec![0; d];
            plus[dim] = 1;
            res.push(plus);
            let mut minus = vec![0; d];
            minus[dim] = -1;
            res.push(minus);
        }
        return res;
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
}
