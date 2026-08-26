//! Shared analytical resource envelope for scale-sensitive Rust/WASM work.
//!
//! RF-029/RF-030/RF-031: running work in a Worker does not make unbounded
//! memory or computational complexity safe. This module provides a single,
//! deterministic preflight vocabulary for analytical work. These defaults are
//! conservative kernel safety limits, not Quest/device qualification claims;
//! target-device profiles must be measured and governed separately.

use serde::{Deserialize, Serialize};

pub const MIB: u64 = 1024 * 1024;
/// Conservative transient-allocation ceiling inside the 512 MiB WASM maximum.
/// It intentionally leaves headroom for resident columns, allocator overhead,
/// JS/WASM glue and result buffers.
pub const DEFAULT_TRANSIENT_BUDGET_BYTES: u64 = 128 * MIB;
/// Abstract exact-work ceiling. One work unit is approximately one primitive
/// scalar-distance/assignment comparison. It is a refusal guard, not a latency
/// prediction.
pub const DEFAULT_EXACT_WORK_UNITS: u64 = 50_000_000;
/// Exact all-pairs radius search is never selected above this many points by the
/// default kernel envelope, regardless of dimensionality.
pub const DEFAULT_EXACT_PAIR_ROWS: usize = 8_192;
/// Agglomerative clustering's current implementation repeatedly scans cluster
/// pairs and member pairs, so its exact mode is deliberately much smaller.
pub const DEFAULT_HIERARCHICAL_ROWS: usize = 2_048;
/// Current k-means implementation performs exactly this many Lloyd iterations.
pub const KMEANS_ITERATIONS: u64 = 20;

// Stable conservative structural estimates. These intentionally do not use
// `size_of::<usize>()` or `size_of::<Vec<_>>()`: resource decisions and error
// metadata must not change merely because the same kernel is tested natively
// and then built for wasm32.
const SOURCE_INDEX_BYTES: u64 = 8;
const VEC_METADATA_BYTES: u64 = 24;
const CSR_OFFSET_BYTES: u64 = 4;
const CSR_EDGE_BYTES: u64 = 8; // u32 neighbour index + f32 distance

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisComplexity {
    Linear,
    NLogN,
    Quadratic,
    Cubic,
    Exponential,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceDecision {
    ExactAllowed,
    ApproximationRequired,
    UnsupportedAtScale,
}

impl ResourceDecision {
    fn as_str(self) -> &'static str {
        match self {
            Self::ExactAllowed => "exact_allowed",
            Self::ApproximationRequired => "approximation_required",
            Self::UnsupportedAtScale => "unsupported_at_scale",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceEstimate {
    pub operation: String,
    pub rows: usize,
    pub dimensions: usize,
    pub complexity: AnalysisComplexity,
    pub estimated_work_units: u64,
    pub estimated_transient_bytes: u64,
    pub decision: ResourceDecision,
    pub reason_code: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AnalysisBudget {
    pub max_exact_work_units: u64,
    pub max_transient_bytes: u64,
    pub max_exact_pair_rows: usize,
    pub max_hierarchical_rows: usize,
}

impl Default for AnalysisBudget {
    fn default() -> Self {
        Self {
            max_exact_work_units: DEFAULT_EXACT_WORK_UNITS,
            max_transient_bytes: DEFAULT_TRANSIENT_BUDGET_BYTES,
            max_exact_pair_rows: DEFAULT_EXACT_PAIR_ROWS,
            max_hierarchical_rows: DEFAULT_HIERARCHICAL_ROWS,
        }
    }
}

fn sat_mul(values: &[u64]) -> u64 {
    values
        .iter()
        .copied()
        .fold(1u64, |acc, value| acc.saturating_mul(value))
}

/// Estimated owned compact column-major point storage: f64 coordinates,
/// per-dimension Vec metadata and the source-row map.
pub fn point_cloud_bytes(rows: usize, dimensions: usize) -> u64 {
    sat_mul(&[rows as u64, dimensions as u64, 8])
        .saturating_add(sat_mul(&[rows as u64, SOURCE_INDEX_BYTES]))
        .saturating_add(sat_mul(&[dimensions as u64, VEC_METADATA_BYTES]))
}

/// Estimated row-major `Vec<Vec<f64>>` complete-case matrix plus source map.
pub fn row_matrix_bytes(rows: usize, dimensions: usize) -> u64 {
    sat_mul(&[rows as u64, dimensions as u64, 8])
        .saturating_add(sat_mul(&[rows as u64, SOURCE_INDEX_BYTES]))
        .saturating_add(sat_mul(&[rows as u64, VEC_METADATA_BYTES]))
}

/// Worst-case CSR storage for a radius graph. A radius can span the entire
/// dataset, so a safety preflight must account for n*(n-1) directed edges even
/// when a grid index usually produces much sparser output.
pub fn csr_worst_case_bytes(rows: usize) -> u64 {
    let rows_u64 = rows as u64;
    let offsets = rows_u64
        .saturating_add(1)
        .saturating_mul(CSR_OFFSET_BYTES);
    let directed_edges = rows_u64.saturating_mul(rows_u64.saturating_sub(1));
    offsets.saturating_add(directed_edges.saturating_mul(CSR_EDGE_BYTES))
}

pub fn exact_neighbourhood_estimate(
    rows: usize,
    dimensions: usize,
    budget: AnalysisBudget,
) -> ResourceEstimate {
    let work = sat_mul(&[rows as u64, rows as u64, dimensions.max(1) as u64]);
    let bytes = point_cloud_bytes(rows, dimensions).saturating_add(csr_worst_case_bytes(rows));
    let (decision, reason_code) = if bytes > budget.max_transient_bytes {
        (
            ResourceDecision::ApproximationRequired,
            Some("TRANSIENT_MEMORY_BUDGET_EXCEEDED".to_string()),
        )
    } else if rows > budget.max_exact_pair_rows {
        (
            ResourceDecision::ApproximationRequired,
            Some("EXACT_PAIR_ROWS_EXCEEDED".to_string()),
        )
    } else if work > budget.max_exact_work_units {
        (
            ResourceDecision::ApproximationRequired,
            Some("EXACT_WORK_BUDGET_EXCEEDED".to_string()),
        )
    } else {
        (ResourceDecision::ExactAllowed, None)
    };
    ResourceEstimate {
        operation: "radius_neighbourhood".to_string(),
        rows,
        dimensions,
        complexity: AnalysisComplexity::Quadratic,
        estimated_work_units: work,
        estimated_transient_bytes: bytes,
        decision,
        reason_code,
    }
}

pub fn kmeans_estimate(
    rows: usize,
    dimensions: usize,
    k: usize,
    budget: AnalysisBudget,
) -> ResourceEstimate {
    let effective_k = k.max(1).min(rows.max(1));
    // k-means++ contributes another O(n*k*d) pass before the fixed Lloyd loop.
    let work = sat_mul(&[
        rows as u64,
        dimensions.max(1) as u64,
        effective_k as u64,
        KMEANS_ITERATIONS.saturating_add(1),
    ]);
    let bytes = row_matrix_bytes(rows, dimensions)
        .saturating_add(sat_mul(&[rows as u64, 8])) // assignments
        .saturating_add(sat_mul(&[effective_k as u64, dimensions as u64, 16])); // old + new centroids
    let (decision, reason_code) = if bytes > budget.max_transient_bytes {
        (
            ResourceDecision::UnsupportedAtScale,
            Some("TRANSIENT_MEMORY_BUDGET_EXCEEDED".to_string()),
        )
    } else if work > budget.max_exact_work_units {
        (
            ResourceDecision::UnsupportedAtScale,
            Some("EXACT_WORK_BUDGET_EXCEEDED".to_string()),
        )
    } else {
        (ResourceDecision::ExactAllowed, None)
    };
    ResourceEstimate {
        operation: "k_means".to_string(),
        rows,
        dimensions,
        complexity: AnalysisComplexity::Linear,
        estimated_work_units: work,
        estimated_transient_bytes: bytes,
        decision,
        reason_code,
    }
}

pub fn hierarchical_estimate(
    rows: usize,
    dimensions: usize,
    budget: AnalysisBudget,
) -> ResourceEstimate {
    // The present implementation repeatedly evaluates inter-cluster member
    // pairs while scanning candidate cluster pairs. n^3*d is a conservative
    // envelope that intentionally refuses before pathological work begins.
    let work = sat_mul(&[
        rows as u64,
        rows as u64,
        rows as u64,
        dimensions.max(1) as u64,
    ]);
    // The implementation computes distances on demand rather than allocating
    // an n*n distance matrix. Account for the complete-case matrix, duplicated
    // centroids/member storage and linear clustering/history metadata instead.
    let bytes = row_matrix_bytes(rows, dimensions)
        .saturating_add(point_cloud_bytes(rows, dimensions))
        .saturating_add(sat_mul(&[rows as u64, 128]));
    let (decision, reason_code) = if rows > budget.max_hierarchical_rows {
        (
            ResourceDecision::UnsupportedAtScale,
            Some("HIERARCHICAL_ROW_BUDGET_EXCEEDED".to_string()),
        )
    } else if work > budget.max_exact_work_units {
        (
            ResourceDecision::UnsupportedAtScale,
            Some("EXACT_WORK_BUDGET_EXCEEDED".to_string()),
        )
    } else if bytes > budget.max_transient_bytes {
        (
            ResourceDecision::UnsupportedAtScale,
            Some("TRANSIENT_MEMORY_BUDGET_EXCEEDED".to_string()),
        )
    } else {
        (ResourceDecision::ExactAllowed, None)
    };
    ResourceEstimate {
        operation: "hierarchical_clustering".to_string(),
        rows,
        dimensions,
        complexity: AnalysisComplexity::Cubic,
        estimated_work_units: work,
        estimated_transient_bytes: bytes,
        decision,
        reason_code,
    }
}

pub fn require_exact(estimate: &ResourceEstimate) -> Result<(), String> {
    match estimate.decision {
        ResourceDecision::ExactAllowed => Ok(()),
        ResourceDecision::ApproximationRequired | ResourceDecision::UnsupportedAtScale => Err(
            format!(
                "UNSUPPORTED_AT_SCALE:operation={};decision={};reason={};rows={};dimensions={};work={};transientBytes={}",
                estimate.operation,
                estimate.decision.as_str(),
                estimate.reason_code.as_deref().unwrap_or("RESOURCE_BUDGET_EXCEEDED"),
                estimate.rows,
                estimate.dimensions,
                estimate.estimated_work_units,
                estimate.estimated_transient_bytes,
            ),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_estimates_are_stable_and_saturating() {
        assert_eq!(point_cloud_bytes(10, 3), 392);
        assert_eq!(row_matrix_bytes(10, 3), 560);
        assert_eq!(point_cloud_bytes(usize::MAX, usize::MAX), u64::MAX);
        assert_eq!(row_matrix_bytes(usize::MAX, usize::MAX), u64::MAX);
    }

    #[test]
    fn csr_estimate_accounts_for_dense_radius_graph() {
        assert_eq!(csr_worst_case_bytes(100), 79_604);
        assert_eq!(csr_worst_case_bytes(usize::MAX), u64::MAX);
    }

    #[test]
    fn exact_neighbourhood_refuses_dense_memory_hazard() {
        let estimate = exact_neighbourhood_estimate(8_192, 3, AnalysisBudget::default());
        assert_eq!(estimate.decision, ResourceDecision::ApproximationRequired);
        assert_eq!(
            estimate.reason_code.as_deref(),
            Some("TRANSIENT_MEMORY_BUDGET_EXCEEDED")
        );
        let error = require_exact(&estimate).unwrap_err();
        assert!(error.starts_with("UNSUPPORTED_AT_SCALE:"));
        assert!(error.contains("operation=radius_neighbourhood"));
        assert!(error.contains("decision=approximation_required"));
    }

    #[test]
    fn exact_neighbourhood_allows_small_fixture() {
        let estimate = exact_neighbourhood_estimate(100, 3, AnalysisBudget::default());
        assert_eq!(estimate.decision, ResourceDecision::ExactAllowed);
        assert!(require_exact(&estimate).is_ok());
    }

    #[test]
    fn kmeans_budget_accounts_for_matrix_and_fixed_iterations() {
        let small = kmeans_estimate(10_000, 4, 4, AnalysisBudget::default());
        assert_eq!(small.decision, ResourceDecision::ExactAllowed);

        let large = kmeans_estimate(100_000, 8, 8, AnalysisBudget::default());
        assert_eq!(large.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(large.reason_code.as_deref(), Some("EXACT_WORK_BUDGET_EXCEEDED"));
    }

    #[test]
    fn hierarchical_refuses_pathological_exact_work() {
        let estimate = hierarchical_estimate(2_000, 8, AnalysisBudget::default());
        assert_eq!(estimate.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(estimate.reason_code.as_deref(), Some("EXACT_WORK_BUDGET_EXCEEDED"));
    }

    #[test]
    fn budget_is_kernel_safety_not_ten_million_row_qualification() {
        let estimate = exact_neighbourhood_estimate(10_000_000, 2, AnalysisBudget::default());
        assert_ne!(estimate.decision, ResourceDecision::ExactAllowed);

        let kmeans = kmeans_estimate(10_000_000, 2, 8, AnalysisBudget::default());
        assert_ne!(kmeans.decision, ResourceDecision::ExactAllowed);
    }
}
