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
const PERSISTENCE_EDGE_BYTES: u64 = 24;
const BETTI_EDGE_BYTES: u64 = 16;
const MAPPER_NODE_BASE_BYTES: u64 = 72;
const MAPPER_EDGE_BYTES: u64 = 32;
const SORT_COMPARISON_UPPER_BOUND: u64 = 64;

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

impl ResourceEstimate {
    pub fn with_operation(mut self, operation: impl Into<String>) -> Self {
        self.operation = operation.into();
        self
    }
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TdaOperation {
    Mapper,
    Persistence,
    Betti0,
}

impl TdaOperation {
    fn from_code(code: u32) -> Option<Self> {
        match code {
            0 => Some(Self::Mapper),
            1 => Some(Self::Persistence),
            2 => Some(Self::Betti0),
            _ => None,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::Mapper => "compute_mapper_graph",
            Self::Persistence => "compute_persistence_intervals",
            Self::Betti0 => "compute_betti0_curve",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TdaResourcePreflight {
    pub source_rows: usize,
    pub eligible_rows: usize,
    pub excluded_rows: usize,
    pub dimensions: usize,
    pub missing_data_policy: String,
    pub eligibility_mode: String,
    pub estimate: ResourceEstimate,
    pub refusal: Option<String>,
}

fn sat_mul(values: &[u64]) -> u64 {
    values
        .iter()
        .copied()
        .fold(1u64, |acc, value| acc.saturating_mul(value))
}

fn undirected_pair_count(rows: usize) -> u64 {
    let n = rows as u64;
    n.saturating_mul(n.saturating_sub(1)).saturating_div(2)
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
    let rows_u64 = rows as u64;
    let dimensions_u64 = dimensions.max(1) as u64;
    let k_u64 = effective_k as u64;

    // The current k-means++ implementation recomputes each point's distance to
    // every already-selected centroid on every seeding round. The number of
    // centroid-distance comparisons is therefore 1 + ... + (k-1), i.e.
    // k*(k-1)/2 per point, rather than O(k). Lloyd assignment then performs
    // n*k comparisons for each fixed iteration. With user-controlled k up to n,
    // this implementation has a cubic worst case and must be budgeted as such.
    let seed_comparisons = k_u64
        .saturating_mul(k_u64.saturating_sub(1))
        .saturating_div(2);
    let seed_work = sat_mul(&[rows_u64, dimensions_u64, seed_comparisons]);
    let lloyd_work = sat_mul(&[
        rows_u64,
        dimensions_u64,
        k_u64,
        KMEANS_ITERATIONS,
    ]);
    let work = seed_work.saturating_add(lloyd_work);

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
        complexity: AnalysisComplexity::Cubic,
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

fn tda_estimate(
    operation: TdaOperation,
    rows: usize,
    dimensions: usize,
    mapper_bins: usize,
    betti_steps: usize,
    budget: AnalysisBudget,
) -> ResourceEstimate {
    let rows_u64 = rows as u64;
    let dimensions_u64 = dimensions.max(1) as u64;
    let pair_count = undirected_pair_count(rows);
    let neighbourhood_work = sat_mul(&[rows_u64, rows_u64, dimensions_u64]);
    let feature_space_bytes = row_matrix_bytes(rows, dimensions)
        .saturating_add(rows_u64.saturating_mul(8)); // first-feature/filter working vector
    let neighbourhood_bytes = point_cloud_bytes(rows, dimensions)
        .saturating_add(csr_worst_case_bytes(rows));

    let (work, bytes, complexity) = match operation {
        TdaOperation::Mapper => {
            let bins = mapper_bins.max(1) as u64;
            let per_row_node_memberships = rows_u64.saturating_mul(bins);
            let possible_row_node_pairs = rows_u64
                .saturating_mul(bins.saturating_mul(bins.saturating_sub(1)).saturating_div(2));
            let edge_sort_work = possible_row_node_pairs
                .saturating_mul(SORT_COMPARISON_UPPER_BOUND);
            let work = neighbourhood_work
                .saturating_mul(bins)
                .saturating_add(edge_sort_work);
            let node_bytes = per_row_node_memberships.saturating_mul(
                MAPPER_NODE_BASE_BYTES.saturating_add(dimensions_u64.saturating_mul(8)),
            );
            let row_to_node_bytes = per_row_node_memberships.saturating_mul(16);
            let edge_bytes = possible_row_node_pairs.saturating_mul(MAPPER_EDGE_BYTES);
            let bytes = feature_space_bytes
                .saturating_add(neighbourhood_bytes)
                .saturating_add(node_bytes)
                .saturating_add(row_to_node_bytes)
                .saturating_add(edge_bytes);
            (work, bytes, AnalysisComplexity::Cubic)
        }
        TdaOperation::Persistence => {
            let sort_work = pair_count.saturating_mul(SORT_COMPARISON_UPPER_BOUND);
            let work = neighbourhood_work.saturating_add(sort_work);
            let bytes = feature_space_bytes
                .saturating_add(neighbourhood_bytes)
                .saturating_add(pair_count.saturating_mul(PERSISTENCE_EDGE_BYTES))
                .saturating_add(rows_u64.saturating_mul(64));
            (work, bytes, AnalysisComplexity::Quadratic)
        }
        TdaOperation::Betti0 => {
            let sort_work = pair_count.saturating_mul(SORT_COMPARISON_UPPER_BOUND);
            let work = neighbourhood_work
                .saturating_add(sort_work)
                .saturating_add(betti_steps as u64);
            let bytes = feature_space_bytes
                .saturating_add(neighbourhood_bytes)
                .saturating_add(pair_count.saturating_mul(BETTI_EDGE_BYTES))
                .saturating_add((betti_steps as u64).saturating_add(1).saturating_mul(16))
                .saturating_add(rows_u64.saturating_mul(32));
            (work, bytes, AnalysisComplexity::Quadratic)
        }
    };

    let high_dimensional_exact_fallback = rows > budget.max_exact_pair_rows && dimensions > 6;
    let (decision, reason_code) = if high_dimensional_exact_fallback
        && (bytes > budget.max_transient_bytes || work > budget.max_exact_work_units)
    {
        (
            ResourceDecision::UnsupportedAtScale,
            Some("HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET".to_string()),
        )
    } else if bytes > budget.max_transient_bytes {
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
        operation: operation.name().to_string(),
        rows,
        dimensions,
        complexity,
        estimated_work_units: work,
        estimated_transient_bytes: bytes,
        decision,
        reason_code,
    }
}

fn build_tda_preflight(
    columns: &[crate::data::column::Column],
    columnar: &crate::data::columnar::ColumnarDataset,
    params: &serde_json::Value,
    operation: TdaOperation,
    budget: AnalysisBudget,
) -> TdaResourcePreflight {
    let feature_names: Vec<&str> = params
        .get("featureColumns")
        .and_then(|value| value.as_array())
        .map(|values| values.iter().filter_map(|value| value.as_str()).collect())
        .unwrap_or_default();
    let source_rows = columnar.row_count();
    let (eligible_rows, dimensions, eligibility_mode) =
        match crate::data::point_access::borrowed_feature_columns(
            columns,
            columnar,
            &feature_names,
        ) {
            Ok(borrowed) => (
                (0..source_rows)
                    .filter(|&row| borrowed.iter().all(|column| column.is_valid(row)))
                    .count(),
                borrowed.len(),
                "complete_case_selected_features",
            ),
            Err(_) => (
                source_rows,
                feature_names.len(),
                "conservative_source_rows_preflight",
            ),
        };
    let mapper_bins = params
        .get("bins")
        .and_then(|value| value.as_u64())
        .unwrap_or(10) as usize;
    let betti_steps = params
        .get("steps")
        .and_then(|value| value.as_u64())
        .unwrap_or(10) as usize;
    let estimate = tda_estimate(
        operation,
        eligible_rows,
        dimensions,
        mapper_bins,
        betti_steps,
        budget,
    );
    let refusal = require_exact(&estimate).err();

    TdaResourcePreflight {
        source_rows,
        eligible_rows,
        excluded_rows: source_rows.saturating_sub(eligible_rows),
        dimensions,
        missing_data_policy: crate::data::topology::TDA_MISSING_DATA_POLICY.to_string(),
        eligibility_mode: eligibility_mode.to_string(),
        estimate,
        refusal,
    }
}

/// Kernel-inline resource preflight for the `data_compute_*` TDA exports.
/// Resolves the resident columnar snapshot and builds the same preflight the
/// standalone `data_tda_resource_preflight` dry-run query produces, so direct
/// callers of the compute exports cannot bypass the analytical resource
/// envelope. Returns `None` only when the handle cannot be resolved (the
/// caller then falls through to its existing hard-error path).
pub(crate) fn tda_preflight_for(
    handle: u32,
    params: &serde_json::Value,
    operation: TdaOperation,
) -> Option<TdaResourcePreflight> {
    let (_name, columns, columnar) = crate::data::columnar_snapshot(handle)?;
    Some(build_tda_preflight(
        &columns,
        columnar.as_ref(),
        params,
        operation,
        AnalysisBudget::default(),
    ))
}

/// Rust-owned preflight for production TDA calls. The host passes the exact
/// request JSON and an operation code (0 Mapper, 1 persistence, 2 Betti-0).
/// The estimator reads resident columnar validity buffers directly and counts
/// complete-case eligible observations without constructing a row-index list.
/// If a feature cannot use the primitive point-access seam, preflight remains
/// fail-closed by budgeting all source rows instead of letting the raw TDA call
/// bypass resource control.
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn data_tda_resource_preflight(
    handle: u32,
    params_ptr: u32,
    params_len: u32,
    operation_code: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(operation) = TdaOperation::from_code(operation_code) else {
        return 0;
    };
    let Some(params_bytes) = (unsafe { crate::allocator::try_view(params_ptr, params_len) }) else {
        return 0;
    };
    let params: serde_json::Value = match serde_json::from_slice(params_bytes) {
        Ok(value) => value,
        Err(_) => return 0,
    };
    let Some((_name, columns, columnar)) = crate::data::columnar_snapshot(handle) else {
        return 0;
    };
    let preflight = build_tda_preflight(
        &columns,
        columnar.as_ref(),
        &params,
        operation,
        AnalysisBudget::default(),
    );
    let json = match serde_json::to_string(&preflight) {
        Ok(value) => value,
        Err(_) => return 0,
    };
    crate::write_str_out(&json, out_ptr, out_len)
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
    use crate::data::column::{Column, ColumnType};
    use crate::data::columnar::ColumnarDataset;
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

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
    fn estimate_can_name_owning_operation_without_changing_budget_math() {
        let estimate = exact_neighbourhood_estimate(100, 3, AnalysisBudget::default())
            .with_operation("compute_betti0_curve");
        assert_eq!(estimate.operation, "compute_betti0_curve");
        assert_eq!(estimate.decision, ResourceDecision::ExactAllowed);
    }

    #[test]
    fn kmeans_budget_accounts_for_naive_kmeans_plus_plus_and_lloyd_iterations() {
        let small = kmeans_estimate(10_000, 4, 4, AnalysisBudget::default());
        assert_eq!(small.decision, ResourceDecision::ExactAllowed);
        assert_eq!(small.complexity, AnalysisComplexity::Cubic);
        // 10k * 4 dimensions * (4*3/2 + 4*20) comparisons.
        assert_eq!(small.estimated_work_units, 3_440_000);

        let large = kmeans_estimate(100_000, 8, 8, AnalysisBudget::default());
        assert_eq!(large.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(large.reason_code.as_deref(), Some("EXACT_WORK_BUDGET_EXCEEDED"));
    }

    #[test]
    fn kmeans_user_controlled_k_exposes_cubic_scale_cliff() {
        let estimate = kmeans_estimate(2_000, 2, 2_000, AnalysisBudget::default());
        assert_eq!(estimate.complexity, AnalysisComplexity::Cubic);
        assert_eq!(estimate.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(estimate.reason_code.as_deref(), Some("EXACT_WORK_BUDGET_EXCEEDED"));
    }

    #[test]
    fn hierarchical_refuses_pathological_exact_work() {
        let estimate = hierarchical_estimate(2_000, 8, AnalysisBudget::default());
        assert_eq!(estimate.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(estimate.reason_code.as_deref(), Some("EXACT_WORK_BUDGET_EXCEEDED"));
    }

    #[test]
    fn mapper_budget_accounts_for_repeated_bins_and_overlap_edge_bookkeeping() {
        let small = tda_estimate(
            TdaOperation::Mapper,
            100,
            2,
            10,
            10,
            AnalysisBudget::default(),
        );
        assert_eq!(small.decision, ResourceDecision::ExactAllowed);

        // Isolate the work dimension: production keeps its conservative
        // memory-first refusal ordering, while this fixture proves that the
        // user-controlled bin multiplier independently exceeds exact work.
        let work_only_budget = AnalysisBudget {
            max_transient_bytes: u64::MAX,
            ..AnalysisBudget::default()
        };
        let unbounded_bins = tda_estimate(
            TdaOperation::Mapper,
            100,
            2,
            1_000,
            10,
            work_only_budget,
        );
        assert!(unbounded_bins.estimated_work_units > work_only_budget.max_exact_work_units);
        assert_eq!(unbounded_bins.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(
            unbounded_bins.reason_code.as_deref(),
            Some("EXACT_WORK_BUDGET_EXCEEDED")
        );
    }

    #[test]
    fn betti_budget_accounts_for_requested_steps() {
        // As above, isolate work from output-buffer memory so this test proves
        // the requested-step multiplier rather than depending on refusal order.
        let work_only_budget = AnalysisBudget {
            max_transient_bytes: u64::MAX,
            ..AnalysisBudget::default()
        };
        let estimate = tda_estimate(
            TdaOperation::Betti0,
            10,
            2,
            10,
            100_000_000,
            work_only_budget,
        );
        assert!(estimate.estimated_work_units > work_only_budget.max_exact_work_units);
        assert_eq!(estimate.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(estimate.reason_code.as_deref(), Some("EXACT_WORK_BUDGET_EXCEEDED"));
    }

    #[test]
    fn large_high_dimensional_tda_refuses_hidden_exact_fallback() {
        let estimate = tda_estimate(
            TdaOperation::Persistence,
            9_000,
            7,
            10,
            10,
            AnalysisBudget::default(),
        );
        assert_eq!(estimate.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(
            estimate.reason_code.as_deref(),
            Some("HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET")
        );
    }

    #[test]
    fn small_high_dimensional_tda_remains_exact() {
        let estimate = tda_estimate(
            TdaOperation::Persistence,
            100,
            7,
            10,
            10,
            AnalysisBudget::default(),
        );
        assert_eq!(estimate.decision, ResourceDecision::ExactAllowed);
    }

    #[test]
    fn tda_preflight_uses_complete_case_validity_without_zero_imputation() {
        let dataset = Dataset::new(
            "preflight",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            vec![
                std::collections::HashMap::from([
                    ("x".to_string(), Value::Number(0.0)),
                    ("y".to_string(), Value::Number(1.0)),
                ]),
                std::collections::HashMap::from([
                    ("x".to_string(), Value::Null),
                    ("y".to_string(), Value::Number(2.0)),
                ]),
                std::collections::HashMap::from([
                    ("x".to_string(), Value::Number(3.0)),
                    ("y".to_string(), Value::Number(4.0)),
                ]),
            ],
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let params = serde_json::json!({ "featureColumns": ["x", "y"], "bins": 10 });
        let preflight = build_tda_preflight(
            &dataset.columns,
            &columnar,
            &params,
            TdaOperation::Mapper,
            AnalysisBudget::default(),
        );
        assert_eq!(preflight.source_rows, 3);
        assert_eq!(preflight.eligible_rows, 2);
        assert_eq!(preflight.excluded_rows, 1);
        assert_eq!(preflight.dimensions, 2);
        assert_eq!(preflight.missing_data_policy, "complete_case_selected_features");
        assert_eq!(preflight.eligibility_mode, "complete_case_selected_features");
        assert!(preflight.refusal.is_none());
    }

    #[test]
    fn feature_borrow_failure_uses_conservative_source_rows_instead_of_bypassing_guard() {
        let dataset = Dataset::new(
            "categorical",
            vec![Column::new("label", ColumnType::Categorical)],
            vec![
                std::collections::HashMap::from([(
                    "label".to_string(),
                    Value::Text("1".to_string()),
                )]),
                std::collections::HashMap::from([(
                    "label".to_string(),
                    Value::Text("2".to_string()),
                )]),
            ],
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let params = serde_json::json!({ "featureColumns": ["label"] });
        let preflight = build_tda_preflight(
            &dataset.columns,
            &columnar,
            &params,
            TdaOperation::Persistence,
            AnalysisBudget::default(),
        );
        assert_eq!(preflight.eligible_rows, 2);
        assert_eq!(preflight.excluded_rows, 0);
        assert_eq!(preflight.dimensions, 1);
        assert_eq!(preflight.eligibility_mode, "conservative_source_rows_preflight");
    }

    #[test]
    fn budget_is_kernel_safety_not_ten_million_row_qualification() {
        let estimate = exact_neighbourhood_estimate(10_000_000, 2, AnalysisBudget::default());
        assert_ne!(estimate.decision, ResourceDecision::ExactAllowed);

        let kmeans = kmeans_estimate(10_000_000, 2, 8, AnalysisBudget::default());
        assert_ne!(kmeans.decision, ResourceDecision::ExactAllowed);

        let tda = tda_estimate(
            TdaOperation::Persistence,
            10_000_000,
            2,
            10,
            10,
            AnalysisBudget::default(),
        );
        assert_ne!(tda.decision, ResourceDecision::ExactAllowed);
    }
}
