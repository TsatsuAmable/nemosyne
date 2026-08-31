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
    SemanticRepresentationIdV1, MAX_DENSITY_CELLS_V1, SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
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
        "excludedPolicy": "canonical-invalid-exclude-and-count"
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

fn valid_pairs(
    col_x: &PrimitiveColumn,
    col_y: &PrimitiveColumn,
) -> Result<(Vec<(f64, f64)>, usize, usize), ()> {
    let len = col_x.values.len().min(col_y.values.len());
    let mut pairs = Vec::new();
    pairs.try_reserve_exact(len).map_err(|_| ())?;
    let mut excluded = 0usize;
    for index in 0..len {
        let vx = col_x.values[index];
        let vy = col_y.values[index];
        let valid_x = col_x.validity[index] != 0 && vx.is_finite();
        let valid_y = col_y.validity[index] != 0 && vy.is_finite();
        if valid_x && valid_y {
            pairs.push((vx, vy));
        } else {
            excluded += 1;
        }
    }
    let total_excluded = col_x.values.len().saturating_sub(pairs.len());
    Ok((pairs, len, total_excluded))
}

fn build_grid(
    pairs: &[(f64, f64)],
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

    if domain_x.min == domain_x.max || domain_y.min == domain_y.max {
        // Degenerate domains: all valid pairs fall into the single cell that covers the domain
        // but our grid already has bx*by cells. For constant domains we collapse to single logical bin
        // per degenerate axis? However contract requires grid == binsX*binsY, so we keep grid but
        // only the final cell is inclusive? For simplicity, distribute via same logic: if constant
        // domain, lower==upper, stable_lerp returns same, but we still have multiple cells with zero width.
        // To avoid misleading, we treat constant domain as single occupied cell at max index.
    }

    for (vx, vy) in pairs {
        let x_idx = if domain_x.min == domain_x.max {
            bx - 1
        } else {
            let mut idx = 0usize;
            for b in 0..bx - 1 {
                let upper = stable_lerp(domain_x.min, domain_x.max, (b + 1) as f64 / bx as f64);
                if *vx < upper {
                    idx = b;
                    break;
                }
                if b + 1 == bx - 1 {
                    idx = bx - 1;
                }
            }
            // Use partition logic similar to distribution
            let mut lo = 0usize;
            let mut hi = bx;
            while lo < hi {
                let mid = (lo + hi) / 2;
                let upper = if mid + 1 == bx {
                    domain_x.max
                } else {
                    stable_lerp(domain_x.min, domain_x.max, (mid + 1) as f64 / bx as f64)
                };
                if *vx >= upper {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }
            lo.min(bx - 1)
        };
        let y_idx = if domain_y.min == domain_y.max {
            by - 1
        } else {
            let mut lo = 0usize;
            let mut hi = by;
            while lo < hi {
                let mid = (lo + hi) / 2;
                let upper = if mid + 1 == by {
                    domain_y.max
                } else {
                    stable_lerp(domain_y.min, domain_y.max, (mid + 1) as f64 / by as f64)
                };
                if *vy >= upper {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }
            lo.min(by - 1)
        };
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

    let (pairs, _len, _) = match valid_pairs(col_x, col_y) {
        Ok(v) => v,
        Err(()) => {
            return refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::ResourceLimit,
                "insufficient transient memory for density pairs",
            )
        }
    };
    if pairs.is_empty() {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "binned density requires at least one canonical valid numeric pair",
        );
    }

    let min_x = pairs.iter().map(|(x, _)| *x).fold(f64::INFINITY, f64::min);
    let max_x = pairs.iter().map(|(x, _)| *x).fold(f64::NEG_INFINITY, f64::max);
    let min_y = pairs.iter().map(|(_, y)| *y).fold(f64::INFINITY, f64::min);
    let max_y = pairs.iter().map(|(_, y)| *y).fold(f64::NEG_INFINITY, f64::max);

    let domain_x = DensityDomainV1 { min: min_x, max: max_x };
    let domain_y = DensityDomainV1 { min: min_y, max: max_y };
    let grid = build_grid(&pairs, domain_x.clone(), domain_y.clone(), request.bins_x, request.bins_y);
    let valid_count = pairs.len();
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
        // Check domain
        assert_eq!(payload.domain_x.min, 0.0);
        assert_eq!(payload.domain_y.min, 0.0);
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
