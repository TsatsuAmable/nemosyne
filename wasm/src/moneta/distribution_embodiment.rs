use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::data;
use crate::data::column::ColumnType;
use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};

use super::embodiment::{
    validate_and_normalize, validate_distribution_request_contract, AnalyticalMethodV1,
    ApproximationModeV1, ApproximationV1, DistributionDomainV1,
    DistributionEcdfKnotV1, DistributionEmbodimentRequestV1,
    DistributionHistogramBinV1, DistributionObservationCountsV1, DistributionQuantileV1,
    EmpiricalDistributionPayloadV1, InformationContractV1, InformationTypeV1,
    RepresentationPayloadV1, ResourceEnvelopeV1, SemanticEmbodimentEnvelopeV1,
    SemanticEmbodimentFamilyV1, SemanticEmbodimentResultV1, SemanticPayloadProvenanceV1,
    SemanticRefusalCodeV1, SemanticRefusalV1, SemanticRepresentationIdV1,
    MAX_DISTRIBUTION_ELEMENTS_V1, SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
};

const DISTRIBUTION_ALGORITHM_VERSION: &str = "empirical-distribution-columnar-v1";

fn information_contract() -> InformationContractV1 {
    InformationContractV1 {
        preserves: vec![
            InformationTypeV1::PopulationDensityDistribution,
            InformationTypeV1::OutlierBoundaryVisibility,
        ],
        loses: vec![
            InformationTypeV1::IndividualObservationIdentity,
            InformationTypeV1::ExactMetricValues,
        ],
    }
}

fn analytical_parameters(request: &DistributionEmbodimentRequestV1) -> serde_json::Value {
    serde_json::json!({
        "histogram": {
            "binning": "equal-width",
            "interval": "left-closed-right-open-final-closed"
        },
        "ecdf": { "selection": "deterministic-rank-knots" },
        "quantiles": {
            "interpolation": "linear-r7",
            "probabilities": request.quantile_probabilities
        },
        "excludedPolicy": "canonical-invalid-exclude-and-count"
    })
}

fn base_envelope(
    fingerprint: String,
    source_row_count: usize,
    valid_count: usize,
    request: &DistributionEmbodimentRequestV1,
    result: SemanticEmbodimentResultV1,
    element_count: u32,
) -> SemanticEmbodimentEnvelopeV1 {
    SemanticEmbodimentEnvelopeV1 {
        schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
        dataset_fingerprint: fingerprint,
        candidate_id: SemanticRepresentationIdV1::DistributionField,
        representation_family: SemanticEmbodimentFamilyV1::Distribution,
        analytical_method: AnalyticalMethodV1 {
            name: "univariate-empirical-distribution".to_string(),
            version: DISTRIBUTION_ALGORITHM_VERSION.to_string(),
            parameters: analytical_parameters(request),
        },
        approximation: ApproximationV1 {
            mode: ApproximationModeV1::Binned,
            represented_row_count: if matches!(result, SemanticEmbodimentResultV1::Ready { .. }) {
                valid_count as u64
            } else {
                0
            },
            description: Some(
                "Equal-width histogram with unique-value ECDF knots and R7 quantiles"
                    .to_string(),
            ),
        },
        information_contract: information_contract(),
        resource: ResourceEnvelopeV1 {
            source_row_count: source_row_count as u64,
            element_count,
            max_element_count: MAX_DISTRIBUTION_ELEMENTS_V1,
        },
        provenance: SemanticPayloadProvenanceV1 {
            kernel_version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: DISTRIBUTION_ALGORITHM_VERSION.to_string(),
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
    request: &DistributionEmbodimentRequestV1,
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

fn normalized_position(value: f64, min: f64, max: f64) -> f64 {
    let scale = min.abs().max(max.abs()).max(1.0);
    let scaled_min = min / scale;
    let scaled_max = max / scale;
    ((value / scale - scaled_min) / (scaled_max - scaled_min)).clamp(0.0, 1.0)
}

fn build_histogram(
    sorted: &[f64],
    min: f64,
    max: f64,
    requested_bins: u32,
) -> Vec<DistributionHistogramBinV1> {
    if min == max {
        return vec![DistributionHistogramBinV1 {
            semantic_id: "distribution-bin:000".to_string(),
            lower_bound: min,
            upper_bound: max,
            count: sorted.len() as u64,
            upper_inclusive: true,
        }];
    }

    let bin_count = requested_bins as usize;
    let mut counts = vec![0u64; bin_count];
    for value in sorted {
        let scaled = normalized_position(*value, min, max) * bin_count as f64;
        let index = (scaled.floor() as usize).min(bin_count - 1);
        counts[index] += 1;
    }

    (0..bin_count)
        .map(|index| {
            let final_bin = index + 1 == bin_count;
            DistributionHistogramBinV1 {
                semantic_id: format!("distribution-bin:{index:03}"),
                lower_bound: stable_lerp(min, max, index as f64 / bin_count as f64),
                upper_bound: if final_bin {
                    max
                } else {
                    stable_lerp(min, max, (index + 1) as f64 / bin_count as f64)
                },
                count: counts[index],
                upper_inclusive: final_bin,
            }
        })
        .collect()
}

fn unique_ecdf_endpoints(sorted: &[f64]) -> Vec<(f64, u64)> {
    let mut endpoints = Vec::new();
    for (index, value) in sorted.iter().copied().enumerate() {
        let final_value = index + 1 == sorted.len() || sorted[index + 1] != value;
        if final_value {
            endpoints.push((value, (index + 1) as u64));
        }
    }
    endpoints
}

fn build_ecdf(sorted: &[f64], requested_knots: u32) -> Vec<DistributionEcdfKnotV1> {
    let endpoints = unique_ecdf_endpoints(sorted);
    let knot_count = endpoints.len().min(requested_knots as usize);
    let selected_indices: Vec<usize> = if knot_count == endpoints.len() {
        (0..endpoints.len()).collect()
    } else if knot_count == 1 {
        vec![endpoints.len() - 1]
    } else {
        (0..knot_count)
            .map(|index| index * (endpoints.len() - 1) / (knot_count - 1))
            .collect()
    };

    selected_indices
        .into_iter()
        .enumerate()
        .map(|(index, endpoint_index)| {
            let (value, cumulative_count) = endpoints[endpoint_index];
            DistributionEcdfKnotV1 {
                semantic_id: format!("distribution-ecdf:{index:03}"),
                value,
                cumulative_count,
                cumulative_probability: cumulative_count as f64 / sorted.len() as f64,
            }
        })
        .collect()
}

fn quantile_r7(sorted: &[f64], probability: f64) -> f64 {
    let position = (sorted.len() - 1) as f64 * probability;
    let lower_index = position.floor() as usize;
    let upper_index = position.ceil() as usize;
    stable_lerp(
        sorted[lower_index],
        sorted[upper_index],
        position - lower_index as f64,
    )
}

fn build_quantiles(
    sorted: &[f64],
    probabilities: &[f64],
) -> Vec<DistributionQuantileV1> {
    probabilities
        .iter()
        .copied()
        .enumerate()
        .map(|(index, probability)| DistributionQuantileV1 {
            semantic_id: format!("distribution-quantile:{index:03}"),
            probability,
            value: quantile_r7(sorted, probability),
        })
        .collect()
}

fn valid_values(column: &PrimitiveColumn) -> Vec<f64> {
    column
        .values
        .iter()
        .copied()
        .zip(column.validity.iter().copied())
        .filter_map(|(value, valid)| (valid != 0 && value.is_finite()).then_some(value))
        .collect()
}

fn distribution_from_columnar(
    fingerprint: String,
    columns: &[crate::data::column::Column],
    columnar: &ColumnarDataset,
    request: &DistributionEmbodimentRequestV1,
) -> SemanticEmbodimentEnvelopeV1 {
    let source_row_count = columnar.row_count();
    if let Err(error) = validate_distribution_request_contract(request) {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            error,
        );
    }

    let Some(measure_index) = find_column_index(columns, &request.measure_field) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            format!("unknown distribution measureField {}", request.measure_field),
        );
    };
    if columns[measure_index].ty != ColumnType::Numeric {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            "empirical distribution requires a numeric measureField",
        );
    }
    let Some(column) = columnar.primitive_column(measure_index) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "numeric distribution measure has no resident columnar data",
        );
    };

    let mut sorted = valid_values(column);
    if sorted.is_empty() {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "empirical distribution requires at least one canonical valid numeric observation",
        );
    }
    sorted.sort_by(f64::total_cmp);

    let min = sorted[0];
    let max = sorted[sorted.len() - 1];
    let histogram = build_histogram(&sorted, min, max, request.histogram_bin_count);
    let ecdf = build_ecdf(&sorted, request.ecdf_knot_count);
    let quantiles = build_quantiles(&sorted, &request.quantile_probabilities);
    let element_count = histogram.len() + ecdf.len() + quantiles.len();
    let valid_count = sorted.len();

    base_envelope(
        fingerprint,
        source_row_count,
        valid_count,
        request,
        SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::EmpiricalDistribution(
                EmpiricalDistributionPayloadV1 {
                    measure_field: request.measure_field.clone(),
                    domain: DistributionDomainV1 { min, max },
                    counts: DistributionObservationCountsV1 {
                        source_count: source_row_count as u64,
                        valid_count: valid_count as u64,
                        excluded_count: (source_row_count - valid_count) as u64,
                    },
                    histogram,
                    ecdf,
                    quantiles,
                },
            ),
        },
        element_count as u32,
    )
}

pub fn build_distribution_embodiment_v1(
    handle: u32,
    request: &DistributionEmbodimentRequestV1,
) -> Option<SemanticEmbodimentEnvelopeV1> {
    let fingerprint = data::fingerprint_for_handle(handle)?.ok()?;
    let mut envelope = data::with_columnar_metadata(handle, |_name, columns, columnar| {
        distribution_from_columnar(fingerprint, columns, columnar, request)
    })?;
    if let Err(error) = validate_and_normalize(&mut envelope) {
        crate::log_error(&format!(
            "distribution semantic embodiment validation failed: {error}"
        ));
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
pub fn moneta_build_distribution_embodiment_v1(
    handle: u32,
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(input) = copy_host_input(input_ptr, input_len) else {
        return 0;
    };
    let request: DistributionEmbodimentRequestV1 = match serde_json::from_slice(&input) {
        Ok(request) => request,
        Err(error) => {
            crate::log_error(&format!(
                "distribution semantic embodiment request parse failed: {error}"
            ));
            return 0;
        }
    };
    let Some(envelope) = build_distribution_embodiment_v1(handle, &request) else {
        return 0;
    };
    let output = match serde_json::to_vec(&envelope) {
        Ok(output) => output,
        Err(error) => {
            crate::log_error(&format!(
                "distribution semantic embodiment serialization failed: {error}"
            ));
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

    fn request() -> DistributionEmbodimentRequestV1 {
        DistributionEmbodimentRequestV1 {
            schema_version: 1,
            candidate_id: SemanticRepresentationIdV1::DistributionField,
            measure_field: "value".to_string(),
            histogram_bin_count: 2,
            ecdf_knot_count: 3,
            quantile_probabilities: vec![0.0, 0.125, 0.5, 0.875, 1.0],
            decision_id: Some("decision-distribution-m2".to_string()),
            decision_model_version: None,
            decision_model_artifact_hash: None,
        }
    }

    fn handle(values: &[Option<f64>]) -> u32 {
        let rows = values
            .iter()
            .map(|value| match value {
                Some(value) => HashMap::from([("value".to_string(), Value::Number(*value))]),
                None => HashMap::from([("value".to_string(), Value::Null)]),
            })
            .collect();
        data::register_dataset(Dataset::new(
            "distribution-m2",
            vec![Column::new("value", ColumnType::Numeric)],
            rows,
        ))
    }

    fn payload(envelope: SemanticEmbodimentEnvelopeV1) -> EmpiricalDistributionPayloadV1 {
        let SemanticEmbodimentResultV1::Ready { payload } = envelope.result else {
            panic!("expected ready distribution payload");
        };
        let RepresentationPayloadV1::EmpiricalDistribution(payload) = payload else {
            panic!("expected empirical distribution payload");
        };
        payload
    }

    #[test]
    fn hand_calculable_distribution_preserves_zero_duplicates_and_r7_quantiles() {
        let envelope = build_distribution_embodiment_v1(
            handle(&[Some(0.0), Some(1.0), Some(1.0), Some(2.0), Some(4.0), None]),
            &request(),
        )
        .expect("distribution envelope");
        assert_eq!(envelope.approximation.represented_row_count, 5);
        assert_eq!(envelope.resource.source_row_count, 6);
        let payload = payload(envelope);
        assert_eq!(payload.counts.valid_count, 5);
        assert_eq!(payload.counts.excluded_count, 1);
        assert_eq!(payload.histogram.iter().map(|bin| bin.count).collect::<Vec<_>>(), vec![3, 2]);
        assert_eq!(
            payload
                .ecdf
                .iter()
                .map(|knot| (knot.value, knot.cumulative_count))
                .collect::<Vec<_>>(),
            vec![(0.0, 1), (1.0, 3), (4.0, 5)]
        );
        assert_eq!(
            payload.quantiles.iter().map(|value| value.value).collect::<Vec<_>>(),
            vec![0.0, 0.5, 1.0, 3.0, 4.0]
        );
    }

    #[test]
    fn row_order_does_not_change_distribution_payload() {
        let forward = payload(
            build_distribution_embodiment_v1(
                handle(&[Some(0.0), Some(1.0), Some(1.0), Some(2.0), Some(4.0), None]),
                &request(),
            )
            .unwrap(),
        );
        let reverse = payload(
            build_distribution_embodiment_v1(
                handle(&[None, Some(4.0), Some(2.0), Some(1.0), Some(1.0), Some(0.0)]),
                &request(),
            )
            .unwrap(),
        );
        assert_eq!(forward, reverse);
    }

    #[test]
    fn constant_domain_uses_one_closed_bin_and_one_ecdf_endpoint() {
        let distribution = payload(
            build_distribution_embodiment_v1(
                handle(&[Some(2.0), None, Some(2.0), Some(2.0)]),
                &request(),
            )
            .unwrap(),
        );
        assert_eq!(distribution.domain, DistributionDomainV1 { min: 2.0, max: 2.0 });
        assert_eq!(distribution.histogram.len(), 1);
        assert!(distribution.histogram[0].upper_inclusive);
        assert_eq!(distribution.histogram[0].count, 3);
        assert_eq!(distribution.ecdf.len(), 1);
        assert_eq!(distribution.ecdf[0].cumulative_probability, 1.0);
    }

    #[test]
    fn canonical_non_finite_normalization_is_reported_only_as_excluded() {
        let columnar = ColumnarDataset::from_parts(
            3,
            HashMap::from([(
                0,
                PrimitiveColumn {
                    values: vec![1.0, f64::NAN, 2.0],
                    validity: vec![1, 1, 1],
                },
            )]),
            HashMap::new(),
        )
        .unwrap();
        let handle = data::register_columnar_dataset(
            "distribution-canonical-invalid".to_string(),
            vec![Column::new("value", ColumnType::Numeric)],
            columnar,
        );
        let distribution = payload(build_distribution_embodiment_v1(handle, &request()).unwrap());
        assert_eq!(distribution.counts.source_count, 3);
        assert_eq!(distribution.counts.valid_count, 2);
        assert_eq!(distribution.counts.excluded_count, 1);
    }

    #[test]
    fn invalid_measure_and_empty_valid_population_refuse_without_fabrication() {
        let all_invalid = build_distribution_embodiment_v1(handle(&[None, None]), &request()).unwrap();
        assert!(matches!(
            all_invalid.result,
            SemanticEmbodimentResultV1::Refused {
                refusal: SemanticRefusalV1 {
                    code: SemanticRefusalCodeV1::MissingEvidence,
                    ..
                }
            }
        ));

        let categorical = data::register_dataset(Dataset::new(
            "distribution-nonnumeric",
            vec![Column::new("value", ColumnType::Categorical)],
            vec![HashMap::from([("value".to_string(), Value::Text("a".to_string()))])],
        ));
        let nonnumeric = build_distribution_embodiment_v1(categorical, &request()).unwrap();
        assert!(matches!(
            nonnumeric.result,
            SemanticEmbodimentResultV1::Refused {
                refusal: SemanticRefusalV1 {
                    code: SemanticRefusalCodeV1::InvalidParameters,
                    ..
                }
            }
        ));
    }

    #[test]
    fn maximum_request_bounds_output_independently_of_source_rows() {
        let values: Vec<Option<f64>> = (0..2_048).map(|index| Some(index as f64)).collect();
        let mut maximum = request();
        maximum.histogram_bin_count = 256;
        maximum.ecdf_knot_count = 256;
        maximum.quantile_probabilities = (0..32).map(|index| index as f64 / 31.0).collect();
        let envelope = build_distribution_embodiment_v1(handle(&values), &maximum).unwrap();
        assert_eq!(envelope.resource.source_row_count, 2_048);
        assert_eq!(envelope.resource.element_count, MAX_DISTRIBUTION_ELEMENTS_V1);
        let distribution = payload(envelope);
        assert_eq!(distribution.histogram.len(), 256);
        assert_eq!(distribution.ecdf.len(), 256);
        assert_eq!(distribution.quantiles.len(), 32);
    }

    #[test]
    fn extreme_finite_domain_avoids_overflowing_bin_and_quantile_boundaries() {
        let distribution = payload(
            build_distribution_embodiment_v1(
                handle(&[Some(-f64::MAX), Some(0.0), Some(f64::MAX)]),
                &request(),
            )
            .unwrap(),
        );
        assert!(distribution
            .histogram
            .iter()
            .all(|bin| bin.lower_bound.is_finite() && bin.upper_bound.is_finite()));
        assert!(distribution.quantiles.iter().all(|quantile| quantile.value.is_finite()));
    }
}
