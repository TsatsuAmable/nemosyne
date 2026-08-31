use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::data;
use crate::data::column::ColumnType;
use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};

use super::embodiment::{
    validate_and_normalize, validate_density_request_contract, AnalyticalMethodV1,
    ApproximationModeV1, ApproximationV1, BinnedDensityPayloadV1, DensityDomainV1,
    DensityEmbodimentRequestV1, DensityGridCellV1, DensityObservationCountsV1,
    InformationContractV1, InformationTypeV1, RepresentationPayloadV1, ResourceEnvelopeV1,
    SemanticEmbodimentEnvelopeV1, SemanticEmbodimentFamilyV1, SemanticEmbodimentResultV1,
    SemanticPayloadProvenanceV1, SemanticRefusalCodeV1, SemanticRefusalV1,
    SemanticRepresentationIdV1, BINNED_DENSITY_CONSTANT_DOMAIN_POLICY_V1,
    MAX_DENSITY_CELLS_V1, SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
};

const DENSITY_METHOD_VERSION: &str = "binned-density-contract-v1";
const DENSITY_ALGORITHM_VERSION: &str = "bivariate-binned-density-columnar-v1";

fn information_contract() -> InformationContractV1 {
    InformationContractV1 {
        preserves: vec![InformationTypeV1::EmpiricalBivariateBinMass],
        loses: vec![
            InformationTypeV1::IndividualObservationIdentity,
            InformationTypeV1::ExactMetricValues,
            InformationTypeV1::PopulationDensityDistribution,
            InformationTypeV1::EmpiricalDistributionShape,
            InformationTypeV1::OutlierBoundaryVisibility,
        ],
    }
}

fn analytical_parameters() -> serde_json::Value {
    serde_json::json!({
        "binning": "equal-width",
        "interval": "left-closed-right-open-final-closed",
        "excludedPolicy": "canonical-invalid-exclude-and-count",
        "constantDomain": BINNED_DENSITY_CONSTANT_DOMAIN_POLICY_V1
    })
}

fn base_envelope(
    fingerprint: String,
    source_row_count: usize,
    valid_count: usize,
    request: &DensityEmbodimentRequestV1,
    result: SemanticEmbodimentResultV1,
    element_count: u32,
) -> SemanticEmbodimentEnvelopeV1 {
    SemanticEmbodimentEnvelopeV1 {
        schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
        dataset_fingerprint: fingerprint,
        candidate_id: SemanticRepresentationIdV1::DensityField,
        representation_family: SemanticEmbodimentFamilyV1::Density,
        analytical_method: AnalyticalMethodV1 {
            name: "bivariate-binned-density".to_string(),
            version: DENSITY_METHOD_VERSION.to_string(),
            parameters: analytical_parameters(),
        },
        approximation: ApproximationV1 {
            mode: ApproximationModeV1::Binned,
            represented_row_count: if matches!(result, SemanticEmbodimentResultV1::Ready { .. }) {
                valid_count as u64
            } else {
                0
            },
            description: Some("Bivariate equal-width empirical bin-mass grid".to_string()),
        },
        information_contract: information_contract(),
        resource: ResourceEnvelopeV1 {
            source_row_count: source_row_count as u64,
            element_count,
            max_element_count: MAX_DENSITY_CELLS_V1,
        },
        provenance: SemanticPayloadProvenanceV1 {
            kernel_version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: DENSITY_ALGORITHM_VERSION.to_string(),
            decision_id: request.decision_id.clone(),
            decision_model_version: request.decision_model_version.clone(),
            decision_model_artifact_hash: request.decision_model_artifact_hash.clone(),
        },
        result,
    }
}

fn refusal(
    fingerprint: String,
    source_row_count: usize,
    request: &DensityEmbodimentRequestV1,
    code: SemanticRefusalCodeV1,
    message: impl Into<String>,
) -> SemanticEmbodimentEnvelopeV1 {
    base_envelope(
        fingerprint,
        source_row_count,
        0,
        request,
        SemanticEmbodimentResultV1::Refused {
            refusal: SemanticRefusalV1 {
                code,
                message: message.into(),
                estimated_elements: None,
            },
        },
        0,
    )
}

fn find_column_index(columns: &[crate::data::column::Column], name: &str) -> Option<usize> {
    columns.iter().position(|column| column.name == name)
}

fn stable_lerp(lower: f64, upper: f64, fraction: f64) -> f64 {
    if fraction <= 0.0 {
        lower
    } else if fraction >= 1.0 {
        upper
    } else {
        lower * (1.0 - fraction) + upper * fraction
    }
}

fn column_matches_row_count(column: &PrimitiveColumn, row_count: usize) -> bool {
    column.values.len() == row_count && column.validity.len() == row_count
}

fn canonical_pair_at(
    col_x: &PrimitiveColumn,
    col_y: &PrimitiveColumn,
    index: usize,
) -> Option<(f64, f64)> {
    let vx = *col_x.values.get(index)?;
    let vy = *col_y.values.get(index)?;
    let valid_x = *col_x.validity.get(index)? != 0 && vx.is_finite();
    let valid_y = *col_y.validity.get(index)? != 0 && vy.is_finite();
    (valid_x && valid_y).then_some((vx, vy))
}

/// First pass over the resident numeric columns. This deliberately computes the
/// domain and valid-pair count without materializing an O(N) `(x, y)` buffer.
fn scan_density_domain(
    col_x: &PrimitiveColumn,
    col_y: &PrimitiveColumn,
    row_count: usize,
) -> Option<(DensityDomainV1, DensityDomainV1, usize)> {
    let mut min_x = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    let mut valid_count = 0usize;

    for index in 0..row_count {
        let Some((vx, vy)) = canonical_pair_at(col_x, col_y, index) else {
            continue;
        };
        min_x = min_x.min(vx);
        max_x = max_x.max(vx);
        min_y = min_y.min(vy);
        max_y = max_y.max(vy);
        valid_count += 1;
    }

    (valid_count > 0).then_some((
        DensityDomainV1 {
            min: min_x,
            max: max_x,
        },
        DensityDomainV1 {
            min: min_y,
            max: max_y,
        },
        valid_count,
    ))
}

fn bin_index(value: f64, domain: &DensityDomainV1, bins: usize) -> usize {
    if domain.min == domain.max {
        return bins - 1;
    }

    let mut lo = 0usize;
    let mut hi = bins;
    while lo < hi {
        let mid = (lo + hi) / 2;
        let upper = if mid + 1 == bins {
            domain.max
        } else {
            stable_lerp(domain.min, domain.max, (mid + 1) as f64 / bins as f64)
        };
        if value >= upper {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    lo.min(bins - 1)
}

fn build_grid(
    col_x: &PrimitiveColumn,
    col_y: &PrimitiveColumn,
    row_count: usize,
    domain_x: DensityDomainV1,
    domain_y: DensityDomainV1,
    bins_x: u32,
    bins_y: u32,
) -> Vec<DensityGridCellV1> {
    let bx = bins_x as usize;
    let by = bins_y as usize;
    let mut grid: Vec<DensityGridCellV1> = (0..by)
        .flat_map(|y| {
            (0..bx).map(move |x| {
                let x_final = x + 1 == bx;
                let y_final = y + 1 == by;
                DensityGridCellV1 {
                    semantic_id: format!("density-cell:{x}-{y}"),
                    x_index: x as u32,
                    y_index: y as u32,
                    x_lower_bound: stable_lerp(domain_x.min, domain_x.max, x as f64 / bx as f64),
                    x_upper_bound: if x_final {
                        domain_x.max
                    } else {
                        stable_lerp(domain_x.min, domain_x.max, (x + 1) as f64 / bx as f64)
                    },
                    y_lower_bound: stable_lerp(domain_y.min, domain_y.max, y as f64 / by as f64),
                    y_upper_bound: if y_final {
                        domain_y.max
                    } else {
                        stable_lerp(domain_y.min, domain_y.max, (y + 1) as f64 / by as f64)
                    },
                    count: 0,
                    x_upper_inclusive: x_final,
                    y_upper_inclusive: y_final,
                }
            })
        })
        .collect();

    // Second pass over the resident columns. V1 retains the full declared
    // lattice. On each degenerate axis, every valid observation is assigned to
    // that axis's final bin. The only data-dependent allocation is the bounded
    // grid itself (<= MAX_DENSITY_CELLS_V1).
    for index in 0..row_count {
        let Some((vx, vy)) = canonical_pair_at(col_x, col_y, index) else {
            continue;
        };
        let x_idx = bin_index(vx, &domain_x, bx);
        let y_idx = bin_index(vy, &domain_y, by);
        let cell_index = y_idx * bx + x_idx;
        grid[cell_index].count += 1;
    }
    grid
}

fn density_from_columnar(
    fingerprint: String,
    columns: &[crate::data::column::Column],
    columnar: &ColumnarDataset,
    request: &DensityEmbodimentRequestV1,
) -> SemanticEmbodimentEnvelopeV1 {
    let source_row_count = columnar.row_count();
    if let Err(error) = validate_density_request_contract(request) {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            error,
        );
    }

    let Some(idx_x) = find_column_index(columns, &request.measure_field_x) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            format!("unknown density measureFieldX {}", request.measure_field_x),
        );
    };
    let Some(idx_y) = find_column_index(columns, &request.measure_field_y) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            format!("unknown density measureFieldY {}", request.measure_field_y),
        );
    };
    if columns[idx_x].ty != ColumnType::Numeric || columns[idx_y].ty != ColumnType::Numeric {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            "binned density requires numeric measureFieldX/Y",
        );
    }
    let Some(col_x) = columnar.primitive_column(idx_x) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "numeric density measure X has no resident columnar data",
        );
    };
    let Some(col_y) = columnar.primitive_column(idx_y) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "numeric density measure Y has no resident columnar data",
        );
    };
    if !column_matches_row_count(col_x, source_row_count)
        || !column_matches_row_count(col_y, source_row_count)
    {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "resident density columns do not match the dataset row count",
        );
    }

    let Some((domain_x, domain_y, valid_count)) =
        scan_density_domain(col_x, col_y, source_row_count)
    else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "binned density requires at least one canonical valid numeric pair",
        );
    };

    let grid = build_grid(
        col_x,
        col_y,
        source_row_count,
        domain_x.clone(),
        domain_y.clone(),
        request.bins_x,
        request.bins_y,
    );
    let element_count = grid.len() as u32;

    base_envelope(
        fingerprint,
        source_row_count,
        valid_count,
        request,
        SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::BinnedDensity(BinnedDensityPayloadV1 {
                measure_field_x: request.measure_field_x.clone(),
                measure_field_y: request.measure_field_y.clone(),
                domain_x,
                domain_y,
                counts: DensityObservationCountsV1 {
                    source_count: source_row_count as u64,
                    valid_count: valid_count as u64,
                    excluded_count: (source_row_count - valid_count) as u64,
                },
                grid,
                bins_x: request.bins_x,
                bins_y: request.bins_y,
            }),
        },
        element_count,
    )
}

pub fn build_density_embodiment_v1(
    handle: u32,
    request: &DensityEmbodimentRequestV1,
) -> Option<SemanticEmbodimentEnvelopeV1> {
    let fingerprint = data::fingerprint_for_handle(handle)?.ok()?;
    let mut envelope = data::with_columnar_metadata(handle, |_name, columns, columnar| {
        density_from_columnar(fingerprint, columns, columnar, request)
    })?;
    if let Err(error) = validate_and_normalize(&mut envelope) {
        crate::log_error(&format!("density semantic embodiment validation failed: {error}"));
        return None;
    }
    Some(envelope)
}

#[cfg(target_arch = "wasm32")]
fn copy_host_input(in_ptr: u32, in_len: u32) -> Option<Vec<u8>> {
    if in_len == 0 || !crate::data::column_view::host_buffer_contains_range(in_ptr, in_len) {
        return None;
    }
    let end = in_ptr.checked_add(in_len)?;
    let memory = wasm_bindgen::memory()
        .dyn_into::<js_sys::WebAssembly::Memory>()
        .ok()?;
    let bytes = js_sys::Uint8Array::new(&memory.buffer()).subarray(in_ptr, end);
    Some(bytes.to_vec())
}

#[cfg(not(target_arch = "wasm32"))]
fn copy_host_input(_in_ptr: u32, _in_len: u32) -> Option<Vec<u8>> {
    None
}

#[wasm_bindgen]
pub fn moneta_build_density_embodiment_v1(
    handle: u32,
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(input) = copy_host_input(input_ptr, input_len) else {
        return 0;
    };
    let request: DensityEmbodimentRequestV1 = match serde_json::from_slice(&input) {
        Ok(request) => request,
        Err(error) => {
            crate::log_error(&format!("density semantic embodiment request parse failed: {error}"));
            return 0;
        }
    };
    let Some(envelope) = build_density_embodiment_v1(handle, &request) else {
        return 0;
    };
    let output = match serde_json::to_vec(&envelope) {
        Ok(output) => output,
        Err(error) => {
            crate::log_error(&format!("density semantic embodiment serialization failed: {error}"));
            return 0;
        }
    };
    crate::write_bytes_out(&output, out_ptr, out_len)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

    use super::*;

    fn request() -> DensityEmbodimentRequestV1 {
        DensityEmbodimentRequestV1 {
            schema_version: 1,
            candidate_id: SemanticRepresentationIdV1::DensityField,
            measure_field_x: "x".to_string(),
            measure_field_y: "y".to_string(),
            bins_x: 2,
            bins_y: 2,
            decision_id: Some("decision-density-m2".to_string()),
            decision_model_version: None,
            decision_model_artifact_hash: None,
        }
    }

    fn handle(pairs: &[(Option<f64>, Option<f64>)]) -> u32 {
        let rows = pairs
            .iter()
            .map(|(x, y)| {
                let mut map = HashMap::new();
                map.insert(
                    "x".to_string(),
                    match x {
                        Some(v) => Value::Number(*v),
                        None => Value::Null,
                    },
                );
                map.insert(
                    "y".to_string(),
                    match y {
                        Some(v) => Value::Number(*v),
                        None => Value::Null,
                    },
                );
                map
            })
            .collect();
        data::register_dataset(Dataset::new(
            "density-m2",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            rows,
        ))
    }

    fn payload(envelope: SemanticEmbodimentEnvelopeV1) -> BinnedDensityPayloadV1 {
        let SemanticEmbodimentResultV1::Ready { payload } = envelope.result else {
            panic!("expected ready density payload");
        };
        let RepresentationPayloadV1::BinnedDensity(payload) = payload else {
            panic!("expected binned density payload");
        };
        payload
    }

    fn count_at(payload: &BinnedDensityPayloadV1, x: u32, y: u32) -> u64 {
        payload
            .grid
            .iter()
            .find(|cell| cell.x_index == x && cell.y_index == y)
            .map(|cell| cell.count)
            .expect("density cell")
    }

    #[test]
    fn two_pass_column_scan_preserves_domain_counts_and_final_bin_rules() {
        let col_x = PrimitiveColumn {
            values: vec![0.0, 1.0, 3.0, 0.0, 0.5],
            validity: vec![1, 1, 1, 0, 1],
        };
        let col_y = PrimitiveColumn {
            values: vec![0.0, 1.0, 1.5, 1.0, 0.0],
            validity: vec![1, 1, 1, 1, 0],
        };
        let (domain_x, domain_y, valid_count) =
            scan_density_domain(&col_x, &col_y, 5).expect("density scan");
        assert_eq!(valid_count, 3);
        assert_eq!(domain_x, DensityDomainV1 { min: 0.0, max: 3.0 });
        assert_eq!(domain_y, DensityDomainV1 { min: 0.0, max: 1.5 });

        let grid = build_grid(&col_x, &col_y, 5, domain_x, domain_y, 2, 2);
        assert_eq!(grid.len(), 4);
        assert_eq!(grid.iter().map(|cell| cell.count).sum::<u64>(), 3);
    }

    #[test]
    fn hand_calculable_density_preserves_counts_and_grid() {
        let envelope = build_density_embodiment_v1(
            handle(&[
                (Some(0.0), Some(0.0)),
                (Some(1.0), Some(1.0)),
                (Some(3.0), Some(1.5)),
                (None, Some(1.0)),
                (Some(0.5), Some(f64::NAN)),
            ]),
            &request(),
        )
        .expect("density envelope");
        assert_eq!(envelope.approximation.represented_row_count, 3);
        assert_eq!(envelope.resource.source_row_count, 5);
        assert_eq!(envelope.analytical_method.version, DENSITY_METHOD_VERSION);
        assert_eq!(
            envelope.analytical_method.parameters["constantDomain"],
            BINNED_DENSITY_CONSTANT_DOMAIN_POLICY_V1
        );
        assert_eq!(envelope.provenance.algorithm_version, DENSITY_ALGORITHM_VERSION);
        assert_eq!(
            envelope.information_contract.preserves,
            vec![InformationTypeV1::EmpiricalBivariateBinMass]
        );
        assert!(envelope
            .information_contract
            .loses
            .contains(&InformationTypeV1::PopulationDensityDistribution));
        let payload = payload(envelope);
        assert_eq!(payload.counts.valid_count, 3);
        assert_eq!(payload.counts.excluded_count, 2);
        assert_eq!(payload.grid.len(), 4);
        assert_eq!(payload.grid.iter().map(|c| c.count).sum::<u64>(), 3);
        assert_eq!(payload.domain_x.min, 0.0);
        assert_eq!(payload.domain_y.min, 0.0);
    }

    #[test]
    fn constant_axes_assign_mass_to_final_bin_without_collapsing_lattice() {
        let constant_x = payload(
            build_density_embodiment_v1(
                handle(&[(Some(5.0), Some(0.0)), (Some(5.0), Some(1.0)), (Some(5.0), Some(3.0))]),
                &request(),
            )
            .expect("constant-x envelope"),
        );
        assert_eq!(constant_x.domain_x.min, constant_x.domain_x.max);
        assert_eq!(constant_x.grid.len(), 4);
        assert_eq!(count_at(&constant_x, 0, 0) + count_at(&constant_x, 0, 1), 0);
        assert_eq!(count_at(&constant_x, 1, 0), 2);
        assert_eq!(count_at(&constant_x, 1, 1), 1);
        assert_eq!(constant_x.grid.iter().map(|cell| cell.count).sum::<u64>(), 3);

        let constant_y = payload(
            build_density_embodiment_v1(
                handle(&[(Some(0.0), Some(7.0)), (Some(1.0), Some(7.0)), (Some(3.0), Some(7.0))]),
                &request(),
            )
            .expect("constant-y envelope"),
        );
        assert_eq!(constant_y.domain_y.min, constant_y.domain_y.max);
        assert_eq!(count_at(&constant_y, 0, 0) + count_at(&constant_y, 1, 0), 0);
        assert_eq!(count_at(&constant_y, 0, 1), 2);
        assert_eq!(count_at(&constant_y, 1, 1), 1);
        assert_eq!(constant_y.grid.iter().map(|cell| cell.count).sum::<u64>(), 3);

        let both_constant = payload(
            build_density_embodiment_v1(
                handle(&[(Some(4.0), Some(9.0)), (Some(4.0), Some(9.0)), (Some(4.0), Some(9.0))]),
                &request(),
            )
            .expect("both-constant envelope"),
        );
        assert_eq!(both_constant.domain_x.min, both_constant.domain_x.max);
        assert_eq!(both_constant.domain_y.min, both_constant.domain_y.max);
        assert_eq!(count_at(&both_constant, 1, 1), 3);
        assert_eq!(count_at(&both_constant, 0, 0), 0);
        assert_eq!(count_at(&both_constant, 0, 1), 0);
        assert_eq!(count_at(&both_constant, 1, 0), 0);
    }

    #[test]
    fn row_order_does_not_change_density_payload() {
        let a = payload(
            build_density_embodiment_v1(
                handle(&[(Some(0.0), Some(0.0)), (Some(3.0), Some(1.5)), (Some(1.0), Some(1.0))]),
                &request(),
            )
            .unwrap(),
        );
        let b = payload(
            build_density_embodiment_v1(
                handle(&[(Some(1.0), Some(1.0)), (Some(0.0), Some(0.0)), (Some(3.0), Some(1.5))]),
                &request(),
            )
            .unwrap(),
        );
        assert_eq!(a, b);
    }

    #[test]
    fn maximum_request_bounds_output_independently_of_source_rows() {
        let pairs: Vec<(Option<f64>, Option<f64>)> =
            (0..2048).map(|i| (Some(i as f64), Some((i % 20) as f64))).collect();
        let mut max = request();
        max.bins_x = 20;
        max.bins_y = 20;
        let envelope = build_density_embodiment_v1(handle(&pairs), &max).unwrap();
        assert_eq!(envelope.resource.element_count, 400);
        assert_eq!(payload(envelope).grid.len(), 400);
    }
}
