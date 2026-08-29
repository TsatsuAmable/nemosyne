use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

pub const SEMANTIC_EMBODIMENT_SCHEMA_VERSION: u32 = 1;
pub const MAX_AGGREGATE_GROUPS_V1: u32 = 4096;
pub const MAX_METHOD_PARAMETERS_JSON_BYTES_V1: usize = 8192;
const MAX_SHORT_TEXT_BYTES: usize = 256;
const MAX_MESSAGE_BYTES: usize = 1024;
const MAX_GROUPING_FIELDS_V1: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SemanticRepresentationIdV1 {
    PointSet,
    DensityField,
    DistributionField,
    ClusterRegions,
    AggregateVolume,
    TemporalTrajectory,
    HierarchicalSpace,
    RelationshipGraph,
    MatrixField,
    ManifoldEmbedding,
    SpatialRegion,
    MultiscaleField,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SemanticEmbodimentFamilyV1 {
    Observation,
    Distribution,
    Cluster,
    Aggregate,
    Graph,
    Field,
    Topology,
    Temporal,
    Hierarchical,
    Frequency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum InformationTypeV1 {
    IndividualObservationIdentity,
    ExactMetricValues,
    PopulationDensityDistribution,
    OutlierBoundaryVisibility,
    ClusterSeparation,
    RelationalEdgeConnectivity,
    HierarchicalParentChild,
    ChronologicalOrder,
    HarmonicFrequencyStructure,
    GeographicSpatialAdjacency,
    AggregateGroupMagnitude,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApproximationModeV1 {
    Exact,
    Binned,
    Sampled,
    Estimated,
    Bounded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AggregateFunctionV1 {
    Count,
    Sum,
    Mean,
    Min,
    Max,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SemanticRefusalCodeV1 {
    UnsupportedCandidate,
    ResourceLimit,
    MissingEvidence,
    InvalidParameters,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AnalyticalMethodV1 {
    pub name: String,
    pub version: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ApproximationV1 {
    pub mode: ApproximationModeV1,
    pub represented_row_count: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InformationContractV1 {
    pub preserves: Vec<InformationTypeV1>,
    pub loses: Vec<InformationTypeV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResourceEnvelopeV1 {
    pub source_row_count: u64,
    pub element_count: u32,
    pub max_element_count: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SemanticPayloadProvenanceV1 {
    pub kernel_version: String,
    pub algorithm_version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_artifact_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AggregateMeasureV1 {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    pub function: AggregateFunctionV1,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AggregateGroupV1 {
    pub semantic_id: String,
    pub key: serde_json::Value,
    pub count: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aggregate_value: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AggregateVolumePayloadV1 {
    pub grouping_fields: Vec<String>,
    pub measure: AggregateMeasureV1,
    pub groups: Vec<AggregateGroupV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RepresentationPayloadV1 {
    AggregateVolume(AggregateVolumePayloadV1),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SemanticRefusalV1 {
    pub code: SemanticRefusalCodeV1,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub estimated_elements: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SemanticEmbodimentResultV1 {
    Ready { payload: RepresentationPayloadV1 },
    Refused { refusal: SemanticRefusalV1 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SemanticEmbodimentEnvelopeV1 {
    pub schema_version: u32,
    pub dataset_fingerprint: String,
    pub candidate_id: SemanticRepresentationIdV1,
    pub representation_family: SemanticEmbodimentFamilyV1,
    pub analytical_method: AnalyticalMethodV1,
    pub approximation: ApproximationV1,
    pub information_contract: InformationContractV1,
    pub resource: ResourceEnvelopeV1,
    pub provenance: SemanticPayloadProvenanceV1,
    pub result: SemanticEmbodimentResultV1,
}

fn is_lower_hex_64(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn validate_short_text(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > MAX_SHORT_TEXT_BYTES {
        return Err(format!(
            "{label} must contain 1..={MAX_SHORT_TEXT_BYTES} UTF-8 bytes"
        ));
    }
    Ok(())
}

fn validate_information_contract(contract: &InformationContractV1) -> Result<(), String> {
    let preserves: HashSet<_> = contract.preserves.iter().copied().collect();
    let loses: HashSet<_> = contract.loses.iter().copied().collect();
    if preserves.len() != contract.preserves.len() || loses.len() != contract.loses.len() {
        return Err("informationContract must not contain duplicate entries".to_string());
    }
    if preserves.iter().any(|entry| loses.contains(entry)) {
        return Err("informationContract cannot both preserve and lose the same information".to_string());
    }
    Ok(())
}

fn validate_aggregate_information_contract(contract: &InformationContractV1) -> Result<(), String> {
    let expected_preserves = vec![InformationTypeV1::AggregateGroupMagnitude];
    let expected_loses = vec![
        InformationTypeV1::IndividualObservationIdentity,
        InformationTypeV1::ExactMetricValues,
        InformationTypeV1::OutlierBoundaryVisibility,
    ];
    if contract.preserves != expected_preserves || contract.loses != expected_loses {
        return Err(
            "AGGREGATE_VOLUME informationContract must match the reviewed candidate ontology"
                .to_string(),
        );
    }
    Ok(())
}

fn validate_group_key(value: &serde_json::Value) -> bool {
    matches!(
        value,
        serde_json::Value::Null
            | serde_json::Value::Bool(_)
            | serde_json::Value::Number(_)
            | serde_json::Value::String(_)
    )
}

fn validate_aggregate_payload(
    candidate_id: SemanticRepresentationIdV1,
    representation_family: SemanticEmbodimentFamilyV1,
    information_contract: &InformationContractV1,
    approximation: &ApproximationV1,
    resource: &ResourceEnvelopeV1,
    payload: &mut AggregateVolumePayloadV1,
) -> Result<(), String> {
    if candidate_id != SemanticRepresentationIdV1::AggregateVolume
        || representation_family != SemanticEmbodimentFamilyV1::Aggregate
    {
        return Err(
            "AGGREGATE_VOLUME payload requires candidateId=AGGREGATE_VOLUME and representationFamily=AGGREGATE"
                .to_string(),
        );
    }
    validate_aggregate_information_contract(information_contract)?;

    if payload.grouping_fields.is_empty() || payload.grouping_fields.len() > MAX_GROUPING_FIELDS_V1 {
        return Err(format!(
            "aggregate groupingFields must contain 1..={MAX_GROUPING_FIELDS_V1} fields"
        ));
    }
    let mut grouping_fields = HashSet::new();
    for field in &payload.grouping_fields {
        validate_short_text(field, "aggregate grouping field")?;
        if !grouping_fields.insert(field) {
            return Err("aggregate groupingFields must be unique".to_string());
        }
    }

    match payload.measure.function {
        AggregateFunctionV1::Count => {
            if let Some(field) = &payload.measure.field {
                validate_short_text(field, "aggregate measure field")?;
            }
        }
        _ => {
            let Some(field) = &payload.measure.field else {
                return Err("non-COUNT aggregate requires an explicit measure field".to_string());
            };
            validate_short_text(field, "aggregate measure field")?;
        }
    }

    if payload.groups.len() > MAX_AGGREGATE_GROUPS_V1 as usize {
        return Err(format!(
            "aggregate group count exceeds hard V1 bound {MAX_AGGREGATE_GROUPS_V1}"
        ));
    }
    if resource.max_element_count != MAX_AGGREGATE_GROUPS_V1 {
        return Err(format!(
            "AGGREGATE_VOLUME maxElementCount must equal contract bound {MAX_AGGREGATE_GROUPS_V1}"
        ));
    }
    if resource.element_count != payload.groups.len() as u32 {
        return Err("resource.elementCount must equal aggregate groups length".to_string());
    }

    let mut semantic_ids = HashSet::new();
    let mut represented_rows = 0u64;
    for group in &payload.groups {
        validate_short_text(&group.semantic_id, "aggregate semanticId")?;
        if !semantic_ids.insert(group.semantic_id.as_str()) {
            return Err("aggregate semanticId values must be unique".to_string());
        }
        if !validate_group_key(&group.key) {
            return Err("aggregate group key must be a JSON scalar".to_string());
        }
        if group.count == 0 {
            return Err("aggregate groups with zero count are not serialised".to_string());
        }
        represented_rows = represented_rows
            .checked_add(group.count)
            .ok_or_else(|| "aggregate represented row count overflow".to_string())?;
        if let Some(value) = group.aggregate_value {
            if !value.is_finite() {
                return Err("aggregateValue must be finite when present".to_string());
            }
        }
    }

    if represented_rows != approximation.represented_row_count {
        return Err(
            "approximation.representedRowCount must equal the sum of aggregate group counts"
                .to_string(),
        );
    }
    if approximation.represented_row_count > resource.source_row_count {
        return Err("representedRowCount cannot exceed sourceRowCount".to_string());
    }
    if approximation.mode == ApproximationModeV1::Exact
        && approximation.represented_row_count != resource.source_row_count
    {
        return Err("EXACT approximation mode must represent every source row".to_string());
    }

    payload.groups.sort_by(|left, right| left.semantic_id.cmp(&right.semantic_id));
    Ok(())
}

pub fn validate_and_normalize(
    envelope: &mut SemanticEmbodimentEnvelopeV1,
) -> Result<(), String> {
    if envelope.schema_version != SEMANTIC_EMBODIMENT_SCHEMA_VERSION {
        return Err(format!(
            "unsupported semantic embodiment schemaVersion {}",
            envelope.schema_version
        ));
    }
    if !is_lower_hex_64(&envelope.dataset_fingerprint) {
        return Err("datasetFingerprint must be exactly 64 lowercase hexadecimal characters".to_string());
    }

    validate_short_text(&envelope.analytical_method.name, "analyticalMethod.name")?;
    validate_short_text(&envelope.analytical_method.version, "analyticalMethod.version")?;
    let parameter_bytes = serde_json::to_vec(&envelope.analytical_method.parameters)
        .map_err(|error| format!("analyticalMethod.parameters serialization failed: {error}"))?;
    if parameter_bytes.len() > MAX_METHOD_PARAMETERS_JSON_BYTES_V1 {
        return Err(format!(
            "analyticalMethod.parameters exceeds {MAX_METHOD_PARAMETERS_JSON_BYTES_V1} JSON bytes"
        ));
    }

    if let Some(description) = &envelope.approximation.description {
        if description.len() > MAX_MESSAGE_BYTES {
            return Err(format!(
                "approximation.description exceeds {MAX_MESSAGE_BYTES} UTF-8 bytes"
            ));
        }
    }
    validate_information_contract(&envelope.information_contract)?;
    validate_short_text(&envelope.provenance.kernel_version, "provenance.kernelVersion")?;
    validate_short_text(
        &envelope.provenance.algorithm_version,
        "provenance.algorithmVersion",
    )?;
    if let Some(decision_id) = &envelope.provenance.decision_id {
        validate_short_text(decision_id, "provenance.decisionId")?;
    }
    if let Some(model_version) = &envelope.provenance.decision_model_version {
        validate_short_text(model_version, "provenance.decisionModelVersion")?;
    }
    if let Some(hash) = &envelope.provenance.decision_model_artifact_hash {
        if !is_lower_hex_64(hash) {
            return Err(
                "provenance.decisionModelArtifactHash must be 64 lowercase hexadecimal characters"
                    .to_string(),
            );
        }
    }

    if envelope.resource.element_count > envelope.resource.max_element_count {
        return Err("resource.elementCount exceeds maxElementCount".to_string());
    }

    let candidate_id = envelope.candidate_id;
    let representation_family = envelope.representation_family;
    let information_contract = &envelope.information_contract;
    let approximation = &envelope.approximation;
    let resource = &envelope.resource;

    match &mut envelope.result {
        SemanticEmbodimentResultV1::Ready { payload } => match payload {
            RepresentationPayloadV1::AggregateVolume(aggregate) => {
                validate_aggregate_payload(
                    candidate_id,
                    representation_family,
                    information_contract,
                    approximation,
                    resource,
                    aggregate,
                )?;
            }
        },
        SemanticEmbodimentResultV1::Refused { refusal } => {
            if refusal.message.is_empty() || refusal.message.len() > MAX_MESSAGE_BYTES {
                return Err(format!(
                    "refusal.message must contain 1..={MAX_MESSAGE_BYTES} UTF-8 bytes"
                ));
            }
            if resource.element_count != 0 {
                return Err("REFUSED semantic embodiment must have elementCount=0".to_string());
            }
        }
    }

    Ok(())
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

/// A3 contract boundary probe. It intentionally performs no analytical work.
/// Rust owns parsing, strict validation, normalization and serialization of the
/// versioned payload contract; later representation builders will construct the
/// same Rust types directly from canonical dataset handles.
#[wasm_bindgen]
pub fn moneta_semantic_embodiment_v1_roundtrip(
    in_ptr: u32,
    in_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(bytes) = copy_host_input(in_ptr, in_len) else {
        return 0;
    };
    let mut envelope: SemanticEmbodimentEnvelopeV1 = match serde_json::from_slice(&bytes) {
        Ok(value) => value,
        Err(error) => {
            crate::log_error(&format!(
                "moneta_semantic_embodiment_v1_roundtrip parse failed: {error}"
            ));
            return 0;
        }
    };
    if let Err(error) = validate_and_normalize(&mut envelope) {
        crate::log_error(&format!(
            "moneta_semantic_embodiment_v1_roundtrip validation failed: {error}"
        ));
        return 0;
    }
    let json = match serde_json::to_vec(&envelope) {
        Ok(value) => value,
        Err(error) => {
            crate::log_error(&format!(
                "moneta_semantic_embodiment_v1_roundtrip serialization failed: {error}"
            ));
            return 0;
        }
    };
    crate::write_bytes_out(&json, out_ptr, out_len)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> SemanticEmbodimentEnvelopeV1 {
        SemanticEmbodimentEnvelopeV1 {
            schema_version: 1,
            dataset_fingerprint: "a".repeat(64),
            candidate_id: SemanticRepresentationIdV1::AggregateVolume,
            representation_family: SemanticEmbodimentFamilyV1::Aggregate,
            analytical_method: AnalyticalMethodV1 {
                name: "grouped-aggregate".to_string(),
                version: "aggregate-contract-v1".to_string(),
                parameters: serde_json::json!({
                    "groupBy": ["group"],
                    "measure": "value",
                    "function": "MEAN"
                }),
            },
            approximation: ApproximationV1 {
                mode: ApproximationModeV1::Exact,
                represented_row_count: 4,
                description: None,
            },
            information_contract: InformationContractV1 {
                preserves: vec![InformationTypeV1::AggregateGroupMagnitude],
                loses: vec![
                    InformationTypeV1::IndividualObservationIdentity,
                    InformationTypeV1::ExactMetricValues,
                    InformationTypeV1::OutlierBoundaryVisibility,
                ],
            },
            resource: ResourceEnvelopeV1 {
                source_row_count: 4,
                element_count: 2,
                max_element_count: MAX_AGGREGATE_GROUPS_V1,
            },
            provenance: SemanticPayloadProvenanceV1 {
                kernel_version: "0.1.0".to_string(),
                algorithm_version: "aggregate-contract-v1".to_string(),
                decision_id: Some("decision_AGGREGATE_VOLUME_fixture".to_string()),
                decision_model_version: None,
                decision_model_artifact_hash: None,
            },
            result: SemanticEmbodimentResultV1::Ready {
                payload: RepresentationPayloadV1::AggregateVolume(AggregateVolumePayloadV1 {
                    grouping_fields: vec!["group".to_string()],
                    measure: AggregateMeasureV1 {
                        field: Some("value".to_string()),
                        function: AggregateFunctionV1::Mean,
                    },
                    groups: vec![
                        AggregateGroupV1 {
                            semantic_id: "group:b".to_string(),
                            key: serde_json::json!("b"),
                            count: 2,
                            aggregate_value: Some(3.5),
                        },
                        AggregateGroupV1 {
                            semantic_id: "group:a".to_string(),
                            key: serde_json::json!("a"),
                            count: 2,
                            aggregate_value: Some(1.5),
                        },
                    ],
                }),
            },
        }
    }

    #[test]
    fn valid_aggregate_contract_normalizes_semantic_group_order() {
        let mut envelope = fixture();
        validate_and_normalize(&mut envelope).expect("valid aggregate contract");
        let SemanticEmbodimentResultV1::Ready { payload } = envelope.result else {
            panic!("expected ready payload");
        };
        let RepresentationPayloadV1::AggregateVolume(payload) = payload;
        assert_eq!(payload.groups[0].semantic_id, "group:a");
        assert_eq!(payload.groups[1].semantic_id, "group:b");
    }

    #[test]
    fn schema_and_candidate_payload_mismatches_fail_closed() {
        let mut wrong_version = fixture();
        wrong_version.schema_version = 2;
        assert!(validate_and_normalize(&mut wrong_version).is_err());

        let mut wrong_candidate = fixture();
        wrong_candidate.candidate_id = SemanticRepresentationIdV1::DensityField;
        assert!(validate_and_normalize(&mut wrong_candidate).is_err());
    }

    #[test]
    fn aggregate_group_bound_is_hard() {
        let mut envelope = fixture();
        if let SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::AggregateVolume(payload),
        } = &mut envelope.result
        {
            payload.groups = (0..=MAX_AGGREGATE_GROUPS_V1)
                .map(|index| AggregateGroupV1 {
                    semantic_id: format!("group:{index:05}"),
                    key: serde_json::json!(index),
                    count: 1,
                    aggregate_value: Some(index as f64),
                })
                .collect();
            envelope.resource.element_count = payload.groups.len() as u32;
            envelope.resource.source_row_count = payload.groups.len() as u64;
            envelope.approximation.represented_row_count = payload.groups.len() as u64;
        }
        assert!(validate_and_normalize(&mut envelope).is_err());
    }

    #[test]
    fn unsupported_candidate_can_return_explicit_refusal_without_fake_payload() {
        let mut envelope = fixture();
        envelope.candidate_id = SemanticRepresentationIdV1::DensityField;
        envelope.representation_family = SemanticEmbodimentFamilyV1::Distribution;
        envelope.resource.element_count = 0;
        envelope.result = SemanticEmbodimentResultV1::Refused {
            refusal: SemanticRefusalV1 {
                code: SemanticRefusalCodeV1::UnsupportedCandidate,
                message: "DENSITY_FIELD builder is not implemented in A3".to_string(),
                estimated_elements: None,
            },
        };
        validate_and_normalize(&mut envelope).expect("explicit refusal is valid");
    }

    #[test]
    fn unknown_fields_are_rejected_by_serde_contract() {
        let mut value = serde_json::to_value(fixture()).expect("fixture JSON");
        value
            .as_object_mut()
            .expect("object")
            .insert("rows".to_string(), serde_json::json!([]));
        let parsed = serde_json::from_value::<SemanticEmbodimentEnvelopeV1>(value);
        assert!(parsed.is_err());
    }
}
