//! Shared analytical resource envelope for scale-sensitive Rust/WASM work.
//!
//! RF-029/RF-030/RF-031/RF-035: running work in a Worker does not make
//! unbounded memory, computational complexity, or host materialisation safe.
//! This module provides deterministic estimates and refusal vocabulary. The
//! defaults are conservative kernel safety limits, not Quest/device
//! qualification claims; target-device profiles are measured separately.

use serde::{Deserialize, Serialize};

pub const MIB: u64 = 1024 * 1024;
/// Conservative transient-allocation ceiling inside the 512 MiB WASM maximum.
pub const DEFAULT_TRANSIENT_BUDGET_BYTES: u64 = 128 * MIB;
/// Conservative whole-operation peak ceiling. This leaves substantial room in
/// the 512 MiB maximum for allocator fragmentation, bindings, renderer state,
/// stack, and browser/Worker overhead that the analytical estimate does not own.
pub const DEFAULT_PEAK_BUDGET_BYTES: u64 = 384 * MIB;
/// Maximum estimated host materialisation for one mutation result. Large
/// datasets remain resident in the analytical runtime; the current product
/// contract only materialises outputs whose transfer/parse envelope is bounded.
pub const DEFAULT_MATERIALIZATION_BUDGET_BYTES: u64 = 64 * MIB;
/// Abstract exact-work ceiling. One work unit approximates one primitive
/// scalar-distance/assignment comparison. It is a refusal guard, not latency.
pub const DEFAULT_EXACT_WORK_UNITS: u64 = 50_000_000;
pub const DEFAULT_EXACT_PAIR_ROWS: usize = 8_192;
pub const DEFAULT_HIERARCHICAL_ROWS: usize = 2_048;
pub const KMEANS_ITERATIONS: u64 = 20;

// Stable conservative structural estimates. They deliberately do not use
// target-dependent `size_of::<usize>()` / `size_of::<Vec<_>>()` values so the
// same request receives the same resource decision natively and on wasm32.
const SOURCE_INDEX_BYTES: u64 = 8;
const VEC_METADATA_BYTES: u64 = 24;
const CSR_OFFSET_BYTES: u64 = 4;
const CSR_EDGE_BYTES: u64 = 8;
const PERSISTENCE_EDGE_BYTES: u64 = 24;
const BETTI_EDGE_BYTES: u64 = 16;
const MAPPER_NODE_BASE_BYTES: u64 = 72;
const MAPPER_EDGE_BYTES: u64 = 32;
const SORT_COMPARISON_UPPER_BOUND: u64 = 64;
const ROW_METADATA_BYTES: u64 = 64;
const CELL_ENVELOPE_BYTES: u64 = 40;
const COLUMN_METADATA_BYTES: u64 = 64;
const COLUMNAR_CELL_ENVELOPE_BYTES: u64 = 12;
const HOST_MATERIALIZATION_MULTIPLIER: u64 = 2;

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
    /// The exact route cannot be admitted and no governed approximation has
    /// been selected for this request.
    ApproximationRequired,
    /// An explicit bounded approximation request is inside the governed work
    /// and memory envelope. The caller must still apply its quality gate.
    BoundedApproximationAllowed,
    UnsupportedAtScale,
}

impl ResourceDecision {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ExactAllowed => "exact_allowed",
            Self::ApproximationRequired => "approximation_required",
            Self::BoundedApproximationAllowed => "bounded_approximation_allowed",
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
    /// Resident canonical input storage participating in this operation.
    pub estimated_resident_bytes: u64,
    /// Rust -> host materialisation/decode/parse envelope for a result.
    pub estimated_transfer_bytes: u64,
    /// Conservative simultaneous peak: resident + transient + transfer.
    pub estimated_peak_bytes: u64,
    pub decision: ResourceDecision,
    pub reason_code: Option<String>,
}

impl ResourceEstimate {
    pub fn with_operation(mut self, operation: impl Into<String>) -> Self {
        self.operation = operation.into();
        self
    }

    pub fn with_memory_envelope(
        mut self,
        resident_bytes: u64,
        transfer_bytes: u64,
        budget: AnalysisBudget,
    ) -> Self {
        self.estimated_resident_bytes = resident_bytes;
        self.estimated_transfer_bytes = transfer_bytes;
        self.estimated_peak_bytes = resident_bytes
            .saturating_add(self.estimated_transient_bytes)
            .saturating_add(transfer_bytes);

        if transfer_bytes > budget.max_materialization_bytes {
            self.decision = ResourceDecision::UnsupportedAtScale;
            self.reason_code = Some("MATERIALIZATION_BUDGET_EXCEEDED".to_string());
        } else if self.estimated_peak_bytes > budget.max_peak_bytes {
            self.decision = ResourceDecision::UnsupportedAtScale;
            self.reason_code = Some("PEAK_MEMORY_BUDGET_EXCEEDED".to_string());
        }
        self
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AnalysisBudget {
    pub max_exact_work_units: u64,
    pub max_transient_bytes: u64,
    pub max_peak_bytes: u64,
    pub max_materialization_bytes: u64,
    pub max_exact_pair_rows: usize,
    pub max_hierarchical_rows: usize,
}

impl Default for AnalysisBudget {
    fn default() -> Self {
        Self {
            max_exact_work_units: DEFAULT_EXACT_WORK_UNITS,
            max_transient_bytes: DEFAULT_TRANSIENT_BUDGET_BYTES,
            max_peak_bytes: DEFAULT_PEAK_BUDGET_BYTES,
            max_materialization_bytes: DEFAULT_MATERIALIZATION_BUDGET_BYTES,
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

fn base_estimate(
    operation: impl Into<String>,
    rows: usize,
    dimensions: usize,
    complexity: AnalysisComplexity,
    work: u64,
    transient: u64,
    decision: ResourceDecision,
    reason_code: Option<String>,
) -> ResourceEstimate {
    ResourceEstimate {
        operation: operation.into(),
        rows,
        dimensions,
        complexity,
        estimated_work_units: work,
        estimated_transient_bytes: transient,
        estimated_resident_bytes: 0,
        estimated_transfer_bytes: 0,
        estimated_peak_bytes: transient,
        decision,
        reason_code,
    }
}

fn undirected_pair_count(rows: usize) -> u64 {
    let n = rows as u64;
    n.saturating_mul(n.saturating_sub(1)).saturating_div(2)
}

/// Stable conservative row-major dataset storage envelope. It intentionally
/// treats every cell as capable of carrying owned/value metadata; this can
/// over-estimate compact numeric tables but cannot under-estimate them by
/// pretending all values are primitive f64s.
pub fn row_dataset_bytes(rows: usize, columns: usize) -> u64 {
    sat_mul(&[rows as u64, ROW_METADATA_BYTES])
        .saturating_add(sat_mul(&[
            rows as u64,
            columns as u64,
            CELL_ENVELOPE_BYTES,
        ]))
        .saturating_add(sat_mul(&[columns as u64, COLUMN_METADATA_BYTES]))
}

/// Stable conservative resident columnar substrate envelope. Numeric values,
/// categorical codes, and validity are all bounded by a per-cell envelope; the
/// dictionary/schema allowance is represented by column metadata.
pub fn columnar_dataset_bytes(rows: usize, columns: usize) -> u64 {
    sat_mul(&[
        rows as u64,
        columns as u64,
        COLUMNAR_CELL_ENVELOPE_BYTES,
    ])
    .saturating_add(sat_mul(&[columns as u64, COLUMN_METADATA_BYTES]))
}

/// Resident registry estimate. Row-major ingests retain both their row-oriented
/// Dataset and canonical columnar substrate; typed/columnar-only handles retain
/// only the latter.
pub fn resident_dataset_bytes(rows: usize, columns: usize, has_row_major: bool) -> u64 {
    let columnar = columnar_dataset_bytes(rows, columns);
    if has_row_major {
        columnar.saturating_add(row_dataset_bytes(rows, columns))
    } else {
        columnar
    }
}

/// Conservative full DatasetJSON crossing envelope. The multiplier accounts
/// for simultaneous Rust serialization/output bytes and host decode/parse state.
pub fn dataset_materialization_bytes(rows: usize, columns: usize) -> u64 {
    row_dataset_bytes(rows, columns).saturating_mul(HOST_MATERIALIZATION_MULTIPLIER)
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

pub fn csr_worst_case_bytes(rows: usize) -> u64 {
    let rows_u64 = rows as u64;
    let offsets = rows_u64
        .saturating_add(1)
        .saturating_mul(CSR_OFFSET_BYTES);
    let directed_edges = rows_u64.saturating_mul(rows_u64.saturating_sub(1));
    offsets.saturating_add(directed_edges.saturating_mul(CSR_EDGE_BYTES))
}

pub fn bounded_csr_bytes(rows: usize, max_neighbors: usize) -> u64 {
    let offsets = (rows as u64)
        .saturating_add(1)
        .saturating_mul(CSR_OFFSET_BYTES);
    let directed = sat_mul(&[rows as u64, max_neighbors as u64, 2]);
    offsets.saturating_add(directed.saturating_mul(CSR_EDGE_BYTES))
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
    base_estimate(
        "radius_neighbourhood",
        rows,
        dimensions,
        AnalysisComplexity::Quadratic,
        work,
        bytes,
        decision,
        reason_code,
    )
}

/// Deterministic work/memory bound for the opt-in landmark approximation.
/// Fixed landmark and per-point neighbour caps make both work and CSR size
/// linear in N for a governed request.
pub fn bounded_landmark_estimate(
    rows: usize,
    dimensions: usize,
    landmark_count: usize,
    max_neighbors: usize,
    budget: AnalysisBudget,
) -> ResourceEstimate {
    let k = landmark_count.max(1).min(rows.max(1));
    let max_neighbors = max_neighbors.max(1).min(k);
    let work = sat_mul(&[
        rows as u64,
        k as u64,
        dimensions.max(1) as u64,
        2,
    ]);
    let bytes = point_cloud_bytes(rows, dimensions)
        .saturating_add(bounded_csr_bytes(rows, max_neighbors))
        .saturating_add(sat_mul(&[rows as u64, k as u64, 4]));
    let (decision, reason_code) = if bytes > budget.max_transient_bytes {
        (
            ResourceDecision::UnsupportedAtScale,
            Some("BOUNDED_APPROXIMATION_MEMORY_BUDGET_EXCEEDED".to_string()),
        )
    } else if work > budget.max_exact_work_units {
        (
            ResourceDecision::UnsupportedAtScale,
            Some("BOUNDED_APPROXIMATION_WORK_BUDGET_EXCEEDED".to_string()),
        )
    } else {
        (ResourceDecision::BoundedApproximationAllowed, None)
    };
    base_estimate(
        "bounded_landmark_neighbourhood",
        rows,
        dimensions,
        AnalysisComplexity::Linear,
        work,
        bytes,
        decision,
        reason_code,
    )
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
        .saturating_add(sat_mul(&[rows as u64, 8]))
        .saturating_add(sat_mul(&[effective_k as u64, dimensions as u64, 16]));
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
    base_estimate(
        "k_means",
        rows,
        dimensions,
        AnalysisComplexity::Cubic,
        work,
        bytes,
        decision,
        reason_code,
    )
}

pub fn hierarchical_estimate(
    rows: usize,
    dimensions: usize,
    budget: AnalysisBudget,
) -> ResourceEstimate {
    let work = sat_mul(&[
        rows as u64,
        rows as u64,
        rows as u64,
        dimensions.max(1) as u64,
    ]);
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
    base_estimate(
        "hierarchical_clustering",
        rows,
        dimensions,
        AnalysisComplexity::Cubic,
        work,
        bytes,
        decision,
        reason_code,
    )
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
        .saturating_add(rows_u64.saturating_mul(8));
    let neighbourhood_bytes = point_cloud_bytes(rows, dimensions)
        .saturating_add(csr_worst_case_bytes(rows));

    let (work, bytes, complexity) = match operation {
        TdaOperation::Mapper => {
            let bins = mapper_bins.max(1) as u64;
            let per_row_node_memberships = rows_u64.saturating_mul(bins);
            let possible_row_node_pairs = rows_u64
                .saturating_mul(bins.saturating_mul(bins.saturating_sub(1)).saturating_div(2));
            let edge_sort_work = possible_row_node_pairs.saturating_mul(SORT_COMPARISON_UPPER_BOUND);
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

    base_estimate(
        operation.name(),
        rows,
        dimensions,
        complexity,
        work,
        bytes,
        decision,
        reason_code,
    )
}

fn build_tda_preflight(
    columns: &[crate::data::column::Column],
    columnar: &crate::data::columnar::ColumnarDataset,
    has_row_major: bool,
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
    let resident = resident_dataset_bytes(source_rows, columns.len(), has_row_major);
    let estimate = tda_estimate(
        operation,
        eligible_rows,
        dimensions,
        mapper_bins,
        betti_steps,
        budget,
    )
    .with_memory_envelope(resident, 0, budget);
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

pub(crate) fn tda_preflight_for(
    handle: u32,
    params: &serde_json::Value,
    operation: TdaOperation,
) -> Option<TdaResourcePreflight> {
    let (_name, columns, columnar) = crate::data::columnar_snapshot(handle)?;
    let has_row_major = crate::data::with_dataset(handle, |_| ()).is_some();
    Some(build_tda_preflight(
        &columns,
        columnar.as_ref(),
        has_row_major,
        params,
        operation,
        AnalysisBudget::default(),
    ))
}

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
    let has_row_major = crate::data::with_dataset(handle, |_| ()).is_some();
    let preflight = build_tda_preflight(
        &columns,
        columnar.as_ref(),
        has_row_major,
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
        ResourceDecision::ApproximationRequired
        | ResourceDecision::BoundedApproximationAllowed
        | ResourceDecision::UnsupportedAtScale => Err(format!(
            "UNSUPPORTED_AT_SCALE:operation={};decision={};reason={};rows={};dimensions={};work={};transientBytes={};residentBytes={};transferBytes={};peakBytes={}",
            estimate.operation,
            estimate.decision.as_str(),
            estimate.reason_code.as_deref().unwrap_or("RESOURCE_BUDGET_EXCEEDED"),
            estimate.rows,
            estimate.dimensions,
            estimate.estimated_work_units,
            estimate.estimated_transient_bytes,
            estimate.estimated_resident_bytes,
            estimate.estimated_transfer_bytes,
            estimate.estimated_peak_bytes,
        )),
    }
}

pub fn require_bounded_approximation(estimate: &ResourceEstimate) -> Result<(), String> {
    if estimate.decision == ResourceDecision::BoundedApproximationAllowed {
        Ok(())
    } else {
        require_exact(estimate)
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
        assert_eq!(row_dataset_bytes(usize::MAX, usize::MAX), u64::MAX);
        assert_eq!(dataset_materialization_bytes(usize::MAX, usize::MAX), u64::MAX);
    }

    #[test]
    fn row_major_residency_accounts_for_row_and_columnar_copies() {
        let row_only = row_dataset_bytes(1_000, 4);
        let columnar = columnar_dataset_bytes(1_000, 4);
        assert_eq!(resident_dataset_bytes(1_000, 4, true), row_only + columnar);
        assert_eq!(resident_dataset_bytes(1_000, 4, false), columnar);
    }

    #[test]
    fn materialisation_budget_refuses_large_host_crossing() {
        let budget = AnalysisBudget::default();
        let transfer = dataset_materialization_bytes(1_000_000, 4);
        assert!(transfer > budget.max_materialization_bytes);
        let estimate = base_estimate(
            "sort",
            1_000_000,
            4,
            AnalysisComplexity::NLogN,
            1_000_000,
            1024,
            ResourceDecision::ExactAllowed,
            None,
        )
        .with_memory_envelope(resident_dataset_bytes(1_000_000, 4, true), transfer, budget);
        assert_eq!(estimate.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(estimate.reason_code.as_deref(), Some("MATERIALIZATION_BUDGET_EXCEEDED"));
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
        assert_eq!(estimate.reason_code.as_deref(), Some("TRANSIENT_MEMORY_BUDGET_EXCEEDED"));
        let error = require_exact(&estimate).unwrap_err();
        assert!(error.starts_with("UNSUPPORTED_AT_SCALE:"));
        assert!(error.contains("residentBytes="));
    }

    #[test]
    fn exact_neighbourhood_allows_small_fixture() {
        let estimate = exact_neighbourhood_estimate(100, 3, AnalysisBudget::default());
        assert_eq!(estimate.decision, ResourceDecision::ExactAllowed);
        assert!(require_exact(&estimate).is_ok());
    }

    #[test]
    fn bounded_landmark_estimate_has_linear_edge_bound() {
        let budget = AnalysisBudget::default();
        let estimate = bounded_landmark_estimate(50_000, 2, 32, 8, budget);
        assert_eq!(estimate.decision, ResourceDecision::BoundedApproximationAllowed);
        assert_eq!(estimate.complexity, AnalysisComplexity::Linear);
        assert!(estimate.estimated_transient_bytes < budget.max_transient_bytes);
        assert!(require_bounded_approximation(&estimate).is_ok());
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
        let small = tda_estimate(TdaOperation::Mapper, 100, 2, 10, 10, AnalysisBudget::default());
        assert_eq!(small.decision, ResourceDecision::ExactAllowed);

        let work_only_budget = AnalysisBudget {
            max_transient_bytes: u64::MAX,
            max_peak_bytes: u64::MAX,
            max_materialization_bytes: u64::MAX,
            ..AnalysisBudget::default()
        };
        let unbounded_bins = tda_estimate(TdaOperation::Mapper, 100, 2, 1_000, 10, work_only_budget);
        assert!(unbounded_bins.estimated_work_units > work_only_budget.max_exact_work_units);
        assert_eq!(unbounded_bins.decision, ResourceDecision::UnsupportedAtScale);
    }

    #[test]
    fn betti_budget_accounts_for_requested_steps() {
        let work_only_budget = AnalysisBudget {
            max_transient_bytes: u64::MAX,
            max_peak_bytes: u64::MAX,
            max_materialization_bytes: u64::MAX,
            ..AnalysisBudget::default()
        };
        let estimate = tda_estimate(TdaOperation::Betti0, 10, 2, 10, 100_000_000, work_only_budget);
        assert!(estimate.estimated_work_units > work_only_budget.max_exact_work_units);
        assert_eq!(estimate.decision, ResourceDecision::UnsupportedAtScale);
    }

    #[test]
    fn large_high_dimensional_tda_refuses_hidden_exact_fallback() {
        let estimate = tda_estimate(TdaOperation::Persistence, 9_000, 7, 10, 10, AnalysisBudget::default());
        assert_eq!(estimate.decision, ResourceDecision::UnsupportedAtScale);
        assert_eq!(estimate.reason_code.as_deref(), Some("HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET"));
    }

    #[test]
    fn small_high_dimensional_tda_remains_exact() {
        let estimate = tda_estimate(TdaOperation::Persistence, 100, 7, 10, 10, AnalysisBudget::default());
        assert_eq!(estimate.decision, ResourceDecision::ExactAllowed);
    }

    #[test]
    fn tda_preflight_uses_complete_case_validity_without_zero_imputation() {
        let dataset = Dataset::new(
            "preflight",
            vec![Column::new("x", ColumnType::Numeric), Column::new("y", ColumnType::Numeric)],
            vec![
                std::collections::HashMap::from([("x".to_string(), Value::Number(0.0)), ("y".to_string(), Value::Number(1.0))]),
                std::collections::HashMap::from([("x".to_string(), Value::Null), ("y".to_string(), Value::Number(2.0))]),
                std::collections::HashMap::from([("x".to_string(), Value::Number(3.0)), ("y".to_string(), Value::Number(4.0))]),
            ],
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let params = serde_json::json!({ "featureColumns": ["x", "y"], "bins": 10 });
        let preflight = build_tda_preflight(
            &dataset.columns,
            &columnar,
            true,
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
        assert!(preflight.estimate.estimated_resident_bytes > 0);
        assert!(preflight.estimate.estimated_peak_bytes >= preflight.estimate.estimated_transient_bytes);
        assert!(preflight.refusal.is_none());
    }

    #[test]
    fn feature_borrow_failure_uses_conservative_source_rows_instead_of_bypassing_guard() {
        let dataset = Dataset::new(
            "categorical",
            vec![Column::new("label", ColumnType::Categorical)],
            vec![
                std::collections::HashMap::from([("label".to_string(), Value::Text("1".to_string()))]),
                std::collections::HashMap::from([("label".to_string(), Value::Text("2".to_string()))]),
            ],
        );
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let params = serde_json::json!({ "featureColumns": ["label"] });
        let preflight = build_tda_preflight(
            &dataset.columns,
            &columnar,
            true,
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
        let tda = tda_estimate(TdaOperation::Persistence, 10_000_000, 2, 10, 10, AnalysisBudget::default());
        assert_ne!(tda.decision, ResourceDecision::ExactAllowed);
        assert!(dataset_materialization_bytes(10_000_000, 4) > DEFAULT_MATERIALIZATION_BUDGET_BYTES);
    }
}