use serde::Deserialize;
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::data::column::ColumnType;
use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};
use crate::data;

use super::embodiment::{
    validate_and_normalize, AggregateFunctionV1, AggregateGroupV1, AggregateMeasureV1,
    AggregateVolumePayloadV1, AnalyticalMethodV1, ApproximationModeV1, ApproximationV1,
    InformationContractV1, InformationTypeV1, RepresentationPayloadV1, ResourceEnvelopeV1,
    SemanticEmbodimentEnvelopeV1, SemanticEmbodimentFamilyV1, SemanticEmbodimentResultV1,
    SemanticPayloadProvenanceV1, SemanticRefusalCodeV1, SemanticRefusalV1,
    SemanticRepresentationIdV1, MAX_AGGREGATE_GROUPS_V1, SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
};

const AGGREGATE_ALGORITHM_VERSION: &str = "aggregate-columnar-v1";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AggregateEmbodimentRequestV1 {
    pub schema_version: u32,
    pub candidate_id: SemanticRepresentationIdV1,
    pub grouping_field: String,
    pub measure: AggregateMeasureV1,
    #[serde(default)]
    pub decision_id: Option<String>,
    #[serde(default)]
    pub decision_model_version: Option<String>,
    #[serde(default)]
    pub decision_model_artifact_hash: Option<String>,
}

#[derive(Debug, Clone)]
struct AggregateAccumulator {
    key: serde_json::Value,
    count: u64,
    valid_measure_count: u64,
    sum: f64,
    min: Option<f64>,
    max: Option<f64>,
}

impl AggregateAccumulator {
    fn new(key: serde_json::Value) -> Self {
        Self {
            key,
            count: 0,
            valid_measure_count: 0,
            sum: 0.0,
            min: None,
            max: None,
        }
    }

    fn observe_measure(&mut self, value: f64) {
        self.valid_measure_count += 1;
        self.sum += value;
        self.min = Some(self.min.map_or(value, |current| current.min(value)));
        self.max = Some(self.max.map_or(value, |current| current.max(value)));
    }

    fn aggregate_value(&self, function: AggregateFunctionV1) -> Option<f64> {
        match function {
            AggregateFunctionV1::Count => Some(self.count as f64),
            AggregateFunctionV1::Sum => (self.valid_measure_count > 0).then_some(self.sum),
            AggregateFunctionV1::Mean => (self.valid_measure_count > 0)
                .then_some(self.sum / self.valid_measure_count as f64),
            AggregateFunctionV1::Min => self.min,
            AggregateFunctionV1::Max => self.max,
        }
    }
}

fn information_contract() -> InformationContractV1 {
    InformationContractV1 {
        preserves: vec![InformationTypeV1::AggregateGroupMagnitude],
        loses: vec![
            InformationTypeV1::IndividualObservationIdentity,
            InformationTypeV1::ExactMetricValues,
            InformationTypeV1::OutlierBoundaryVisibility,
        ],
    }
}

fn analytical_parameters(request: &AggregateEmbodimentRequestV1) -> serde_json::Value {
    serde_json::json!({
        "groupingField": request.grouping_field,
        "measure": {
            "field": request.measure.field,
            "function": request.measure.function,
        },
        "missingGroupingPolicy": "group-as-null",
        "missingMeasurePolicy": "exclude-from-measure-retain-group-count",
    })
}

fn base_envelope(
    fingerprint: String,
    source_row_count: usize,
    request: &AggregateEmbodimentRequestV1,
    result: SemanticEmbodimentResultV1,
    element_count: u32,
) -> SemanticEmbodimentEnvelopeV1 {
    SemanticEmbodimentEnvelopeV1 {
        schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
        dataset_fingerprint: fingerprint,
        candidate_id: SemanticRepresentationIdV1::AggregateVolume,
        representation_family: SemanticEmbodimentFamilyV1::Aggregate,
        analytical_method: AnalyticalMethodV1 {
            name: "categorical-grouped-aggregate".to_string(),
            version: AGGREGATE_ALGORITHM_VERSION.to_string(),
            parameters: analytical_parameters(request),
        },
        approximation: ApproximationV1 {
            mode: ApproximationModeV1::Exact,
            represented_row_count: if matches!(result, SemanticEmbodimentResultV1::Ready { .. }) {
                source_row_count as u64
            } else {
                0
            },
            description: None,
        },
        information_contract: information_contract(),
        resource: ResourceEnvelopeV1 {
            source_row_count: source_row_count as u64,
            element_count,
            max_element_count: MAX_AGGREGATE_GROUPS_V1,
        },
        provenance: SemanticPayloadProvenanceV1 {
            kernel_version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: AGGREGATE_ALGORITHM_VERSION.to_string(),
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
    request: &AggregateEmbodimentRequestV1,
    code: SemanticRefusalCodeV1,
    message: impl Into<String>,
    estimated_elements: Option<u64>,
) -> SemanticEmbodimentEnvelopeV1 {
    base_envelope(
        fingerprint,
        source_row_count,
        request,
        SemanticEmbodimentResultV1::Refused {
            refusal: SemanticRefusalV1 {
                code,
                message: message.into(),
                estimated_elements,
            },
        },
        0,
    )
}

fn find_column_index(columns: &[crate::data::column::Column], name: &str) -> Option<usize> {
    columns.iter().position(|column| column.name == name)
}

fn aggregate_from_columnar(
    fingerprint: String,
    columns: &[crate::data::column::Column],
    columnar: &ColumnarDataset,
    request: &AggregateEmbodimentRequestV1,
) -> SemanticEmbodimentEnvelopeV1 {
    let source_row_count = columnar.row_count();

    if request.schema_version != SEMANTIC_EMBODIMENT_SCHEMA_VERSION {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            format!(
                "unsupported aggregate embodiment request schemaVersion {}",
                request.schema_version
            ),
            None,
        );
    }
    if request.candidate_id != SemanticRepresentationIdV1::AggregateVolume {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            "aggregate builder requires candidateId=AGGREGATE_VOLUME",
            None,
        );
    }
    if request.grouping_field.is_empty() {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            "AGGREGATE_VOLUME requires an explicit groupingField",
            None,
        );
    }

    let Some(grouping_index) = find_column_index(columns, &request.grouping_field) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            format!("unknown aggregate groupingField {}", request.grouping_field),
            None,
        );
    };
    if columns[grouping_index].ty != ColumnType::Categorical {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            "A4 aggregate embodiment requires a categorical groupingField",
            None,
        );
    }
    let Some(grouping) = columnar.categorical_column(grouping_index) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "categorical grouping column has no resident columnar data",
            None,
        );
    };

    let has_missing_group = grouping.validity.iter().any(|valid| *valid == 0);
    let estimated_groups = grouping.dictionary.len() + usize::from(has_missing_group);
    if estimated_groups > MAX_AGGREGATE_GROUPS_V1 as usize {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::ResourceLimit,
            format!(
                "aggregate group count {estimated_groups} exceeds hard V1 bound {MAX_AGGREGATE_GROUPS_V1}"
            ),
            Some(estimated_groups as u64),
        );
    }

    let measure_column: Option<&PrimitiveColumn> = match request.measure.function {
        AggregateFunctionV1::Count => None,
        _ => {
            let Some(field) = request.measure.field.as_deref().filter(|field| !field.is_empty()) else {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::InvalidParameters,
                    "non-COUNT aggregate requires an explicit numeric measure field",
                    None,
                );
            };
            let Some(measure_index) = find_column_index(columns, field) else {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::InvalidParameters,
                    format!("unknown aggregate measure field {field}"),
                    None,
                );
            };
            if columns[measure_index].ty != ColumnType::Numeric {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::InvalidParameters,
                    "A4 aggregate measure must be numeric",
                    None,
                );
            }
            let Some(column) = columnar.primitive_column(measure_index) else {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::MissingEvidence,
                    "numeric measure column has no resident columnar data",
                    None,
                );
            };
            Some(column)
        }
    };

    let missing_index = has_missing_group.then_some(grouping.dictionary.len());
    let mut accumulators: Vec<AggregateAccumulator> = grouping
        .dictionary
        .iter()
        .map(|value| AggregateAccumulator::new(serde_json::Value::String(value.clone())))
        .collect();
    if has_missing_group {
        accumulators.push(AggregateAccumulator::new(serde_json::Value::Null));
    }

    for row_index in 0..source_row_count {
        let accumulator_index = if grouping.validity.get(row_index).copied().unwrap_or(0) == 0 {
            missing_index.expect("missing group preflight must allocate an accumulator")
        } else {
            let code = grouping.codes.get(row_index).copied().unwrap_or(u32::MAX) as usize;
            if code >= grouping.dictionary.len() {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::MissingEvidence,
                    "categorical grouping column contains an invalid dictionary code",
                    None,
                );
            }
            code
        };

        let accumulator = &mut accumulators[accumulator_index];
        accumulator.count += 1;

        if let Some(measure) = measure_column {
            if measure.validity.get(row_index).copied().unwrap_or(0) != 0 {
                if let Some(value) = measure.values.get(row_index).copied().filter(|v| v.is_finite()) {
                    accumulator.observe_measure(value);
                }
            }
        }
    }

    let groups: Vec<AggregateGroupV1> = accumulators
        .into_iter()
        .enumerate()
        .filter(|(_, accumulator)| accumulator.count > 0)
        .map(|(index, accumulator)| {
            let aggregate_value = accumulator.aggregate_value(request.measure.function);
            AggregateGroupV1 {
                semantic_id: if Some(index) == missing_index {
                    "aggregate-group:missing".to_string()
                } else {
                    format!("aggregate-group:{index:05}")
                },
                key: accumulator.key,
                count: accumulator.count,
                aggregate_value,
            }
        })
        .collect();

    base_envelope(
        fingerprint,
        source_row_count,
        request,
        SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::AggregateVolume(AggregateVolumePayloadV1 {
                grouping_fields: vec![request.grouping_field.clone()],
                measure: request.measure.clone(),
                groups: groups.clone(),
            }),
        },
        groups.len() as u32,
    )
}

pub fn build_aggregate_embodiment_v1(
    handle: u32,
    request: &AggregateEmbodimentRequestV1,
) -> Option<SemanticEmbodimentEnvelopeV1> {
    let fingerprint = data::fingerprint_for_handle(handle)?.ok()?;
    let mut envelope = data::with_columnar_metadata(handle, |_name, columns, columnar| {
        aggregate_from_columnar(fingerprint, columns, columnar, request)
    })?;
    if let Err(error) = validate_and_normalize(&mut envelope) {
        crate::log_error(&format!("aggregate semantic embodiment validation failed: {error}"));
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
pub fn moneta_build_aggregate_embodiment_v1(
    handle: u32,
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(input) = copy_host_input(input_ptr, input_len) else {
        return 0;
    };
    let request: AggregateEmbodimentRequestV1 = match serde_json::from_slice(&input) {
        Ok(request) => request,
        Err(error) => {
            crate::log_error(&format!("aggregate semantic embodiment request parse failed: {error}"));
            return 0;
        }
    };
    let Some(envelope) = build_aggregate_embodiment_v1(handle, &request) else {
        return 0;
    };
    let output = match serde_json::to_vec(&envelope) {
        Ok(output) => output,
        Err(error) => {
            crate::log_error(&format!("aggregate semantic embodiment serialization failed: {error}"));
            return 0;
        }
    };
    crate::write_bytes_out(&output, out_ptr, out_len)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

    use super::*;

    fn dataset_handle() -> u32 {
        data::register_dataset(Dataset::new(
            "aggregate-a4",
            vec![
                Column::new("group", ColumnType::Categorical),
                Column::new("value", ColumnType::Numeric),
            ],
            vec![
                HashMap::from([
                    ("group".to_string(), Value::Text("b".to_string())),
                    ("value".to_string(), Value::Number(0.0)),
                ]),
                HashMap::from([
                    ("group".to_string(), Value::Text("a".to_string())),
                    ("value".to_string(), Value::Number(2.0)),
                ]),
                HashMap::from([
                    ("group".to_string(), Value::Text("b".to_string())),
                    ("value".to_string(), Value::Null),
                ]),
                HashMap::from([("value".to_string(), Value::Number(8.0))]),
            ],
        ))
    }

    fn request(function: AggregateFunctionV1) -> AggregateEmbodimentRequestV1 {
        AggregateEmbodimentRequestV1 {
            schema_version: 1,
            candidate_id: SemanticRepresentationIdV1::AggregateVolume,
            grouping_field: "group".to_string(),
            measure: AggregateMeasureV1 {
                field: Some("value".to_string()),
                function,
            },
            decision_id: Some("decision-aggregate-a4".to_string()),
            decision_model_version: None,
            decision_model_artifact_hash: None,
        }
    }

    #[test]
    fn mean_preserves_zero_and_excludes_missing_measure_without_losing_group_population() {
        let handle = dataset_handle();
        let envelope = build_aggregate_embodiment_v1(handle, &request(AggregateFunctionV1::Mean))
            .expect("aggregate envelope");
        assert_eq!(envelope.approximation.represented_row_count, 4);
        assert_eq!(envelope.resource.element_count, 3);
        let SemanticEmbodimentResultV1::Ready { payload } = envelope.result else {
            panic!("expected ready aggregate payload");
        };
        let RepresentationPayloadV1::AggregateVolume(payload) = payload;
        let b = payload.groups.iter().find(|group| group.key == serde_json::json!("b")).unwrap();
        assert_eq!(b.count, 2);
        assert_eq!(b.aggregate_value, Some(0.0));
        let missing = payload.groups.iter().find(|group| group.key.is_null()).unwrap();
        assert_eq!(missing.count, 1);
        assert_eq!(missing.aggregate_value, Some(8.0));
    }

    #[test]
    fn count_is_explicit_and_keeps_missing_grouping_as_null() {
        let handle = dataset_handle();
        let envelope = build_aggregate_embodiment_v1(handle, &request(AggregateFunctionV1::Count))
            .expect("aggregate envelope");
        let SemanticEmbodimentResultV1::Ready { payload } = envelope.result else {
            panic!("expected ready aggregate payload");
        };
        let RepresentationPayloadV1::AggregateVolume(payload) = payload;
        assert!(payload.groups.iter().all(|group| group.aggregate_value == Some(group.count as f64)));
        assert!(payload.groups.iter().any(|group| group.key.is_null()));
    }

    #[test]
    fn noncategorical_grouping_refuses_without_materializing_rows() {
        let handle = dataset_handle();
        let mut bad = request(AggregateFunctionV1::Mean);
        bad.grouping_field = "value".to_string();
        let envelope = build_aggregate_embodiment_v1(handle, &bad).expect("refusal envelope");
        let SemanticEmbodimentResultV1::Refused { refusal } = envelope.result else {
            panic!("expected refusal");
        };
        assert_eq!(refusal.code, SemanticRefusalCodeV1::InvalidParameters);
    }

    #[test]
    fn group_bound_refuses_instead_of_truncating() {
        let rows = (0..=MAX_AGGREGATE_GROUPS_V1)
            .map(|index| {
                HashMap::from([
                    ("group".to_string(), Value::Text(format!("g{index}"))),
                    ("value".to_string(), Value::Number(index as f64)),
                ])
            })
            .collect();
        let handle = data::register_dataset(Dataset::new(
            "aggregate-bound",
            vec![
                Column::new("group", ColumnType::Categorical),
                Column::new("value", ColumnType::Numeric),
            ],
            rows,
        ));
        let envelope = build_aggregate_embodiment_v1(handle, &request(AggregateFunctionV1::Mean))
            .expect("refusal envelope");
        let SemanticEmbodimentResultV1::Refused { refusal } = envelope.result else {
            panic!("expected refusal");
        };
        assert_eq!(refusal.code, SemanticRefusalCodeV1::ResourceLimit);
        assert_eq!(refusal.estimated_elements, Some(MAX_AGGREGATE_GROUPS_V1 as u64 + 1));
    }
}
