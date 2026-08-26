//! Shared analytical resource envelope for scale-sensitive Rust/WASM work.
//!
//! RF-029/RF-030/RF-031: running work in a Worker does not make unbounded
//! memory or computational complexity safe. This module provides a single,
//! deterministic preflight vocabulary for exact analytical work. These defaults
//! are conservative kernel safety limits, not Quest/device qualification claims;
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

/// Estimated owned compact point storage: f64 coordinates plus source-row map.
pub fn point_cloud_bytes(rows: usize, dimensions: usize) -> u64 {
    sat_mul(&[rows as u64, dimensions as u64, 8])
        .saturating_add(sat_mul(&[rows as u64, std::mem::size_of::<usize>() as u64]))
}

pub fn exact_neighbourhood_estimate(
    rows: usize,
    dimensions: usize,
    budget: AnalysisBudget,
) -> ResourceEstimate {
    let work = sat_mul(&[rows as u64, rows as u64, dimensions.max(1) as u64]);
    let bytes = point_cloud_bytes(rows, dimensions)
        // CSR offsets only; edge payload is data-dependent and therefore cannot
        // be safely predicted without a degree bound.
        .saturating_add(sat_mul(&[(rows + 1) as u64, 4]));
    let (decision, reason_code) = if rows > budget.max_exact_pair_rows {
        (
            ResourceDecision::ApproximationRequired,
            Some("EXACT_PAIR_ROWS_EXCEEDED".to_string()),
        )
    } else if work > budget.max_exact_work_units {
        (
            ResourceDecision::ApproximationRequired,
            Some("EXACT_WORK_BUDGET_EXCEEDED".to_string()),
        )
    } else if bytes > budget.max_transient_bytes {
        (
            ResourceDecision::ApproximationRequired,
            Some("TRANSIENT_MEMORY_BUDGET_EXCEEDED".to_string()),
        )
    } else {
        (ResourceDecision::ExactAllowed, None)
    };
    ResourceEstimate {
        operation: "exact_radius_neighbourhood".to_string(),
        rows,
        dimensions,
        complexity: AnalysisComplexity::Quadratic,
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
    let bytes = point_cloud_bytes(rows, dimensions)
        .saturating_add(sat_mul(&[rows as u64, rows as u64, 8]));
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
                "UNSUPPORTED_AT_SCALE:{}:rows={}:dimensions={}:work={}:transientBytes={}",
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
    fn point_cloud_memory_estimate_saturates_without_overflow() {
        assert_eq!(point_cloud_bytes(10, 3), 320);
        assert_eq!(point_cloud_bytes(usize::MAX, usize::MAX), u64::MAX);
    }

    #[test]
    fn exact_neighbourhood_refuses_large_pair_search() {
        let estimate = exact_neighbourhood_estimate(20_000, 8, AnalysisBudget::default());
        assert_eq!(estimate.decision, ResourceDecision::ApproximationRequired);
        assert_eq!(estimate.reason_code.as_deref(), Some("EXACT_PAIR_ROWS_EXCEEDED"));
        assert!(require_exact(&estimate).unwrap_err().starts_with("UNSUPPORTED_AT_SCALE:"));
    }

    #[test]
    fn exact_neighbourhood_allows_small_fixture() {
        let estimate = exact_neighbourhood_estimate(100, 3, AnalysisBudget::default());
        assert_eq!(estimate.decision, ResourceDecision::ExactAllowed);
        assert!(require_exact(&estimate).is_ok());
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
    }
}
