use std::collections::{BTreeMap, HashMap, HashSet};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::data;
use crate::data::column::ColumnType;
use crate::data::columnar::PrimitiveColumn;
use crate::data::dataset::{Edge, EdgeEndpoint};

use super::embodiment::{
    AnalyticalMethodV1, ApproximationModeV1, ApproximationV1, InformationContractV1,
    InformationTypeV1, ResourceEnvelopeV1, SemanticEmbodimentFamilyV1,
    SemanticPayloadProvenanceV1, SemanticRefusalCodeV1, SemanticRefusalV1,
    SemanticRepresentationIdV1, SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
};

pub const MAX_CLUSTER_REGIONS_V1: u32 = 1024;
pub const MAX_CLUSTER_MEASURE_FIELDS_V1: usize = 3;
pub const MAX_RELATIONSHIP_GRAPH_NODES_V1: u32 = 5000;
pub const MAX_RELATIONSHIP_GRAPH_EDGES_V1: u32 = 20_000;
pub const MAX_RELATIONSHIP_GRAPH_ELEMENTS_V1: u32 =
    MAX_RELATIONSHIP_GRAPH_NODES_V1 + MAX_RELATIONSHIP_GRAPH_EDGES_V1;

const MAX_SHORT_TEXT_BYTES: usize = 256;
const CLUSTER_METHOD_VERSION: &str = "source-partition-summary-v1";
const CLUSTER_ALGORITHM_VERSION: &str = "categorical-partition-columnar-v1";
const GRAPH_METHOD_VERSION: &str = "source-edge-list-v1";
const GRAPH_ALGORITHM_VERSION: &str = "source-edge-list-structural-v1";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterEmbodimentRequestV1 {
    pub schema_version: u32,
    pub candidate_id: SemanticRepresentationIdV1,
    pub cluster_field: String,
    pub measure_fields: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_artifact_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterObservationCountsV1 {
    pub source_count: u64,
    pub assigned_count: u64,
    pub unassigned_count: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterAxisSummaryV1 {
    pub field: String,
    pub valid_count: u64,
    pub min: f64,
    pub max: f64,
    pub mean: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterRegionV1 {
    pub semantic_id: String,
    pub key: String,
    pub count: u64,
    pub axes: Vec<ClusterAxisSummaryV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterRegionsPayloadV1 {
    pub cluster_field: String,
    pub measure_fields: Vec<String>,
    pub counts: ClusterObservationCountsV1,
    pub regions: Vec<ClusterRegionV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RelationshipGraphEmbodimentRequestV1 {
    pub schema_version: u32,
    pub candidate_id: SemanticRepresentationIdV1,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_artifact_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RelationshipGraphNodeV1 {
    pub semantic_id: String,
    pub source_identity: String,
    pub degree: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RelationshipGraphEdgeV1 {
    pub semantic_id: String,
    pub source_semantic_id: String,
    pub target_semantic_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RelationshipGraphPayloadV1 {
    pub nodes: Vec<RelationshipGraphNodeV1>,
    pub edges: Vec<RelationshipGraphEdgeV1>,
    pub source_edge_count: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StructuralRepresentationPayloadV1 {
    ClusterRegions(ClusterRegionsPayloadV1),
    RelationshipGraph(RelationshipGraphPayloadV1),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StructuralEmbodimentResultV1 {
    Ready { payload: StructuralRepresentationPayloadV1 },
    Refused { refusal: SemanticRefusalV1 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StructuralEmbodimentEnvelopeV1 {
    pub schema_version: u32,
    pub dataset_fingerprint: String,
    pub candidate_id: SemanticRepresentationIdV1,
    pub representation_family: SemanticEmbodimentFamilyV1,
    pub analytical_method: AnalyticalMethodV1,
    pub approximation: ApproximationV1,
    pub information_contract: InformationContractV1,
    pub resource: ResourceEnvelopeV1,
    pub provenance: SemanticPayloadProvenanceV1,
    pub result: StructuralEmbodimentResultV1,
}

fn validate_short_text(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > MAX_SHORT_TEXT_BYTES {
        return Err(format!("{label} must contain 1..={MAX_SHORT_TEXT_BYTES} UTF-8 bytes"));
    }
    if value.trim() != value {
        return Err(format!("{label} must not contain surrounding whitespace"));
    }
    Ok(())
}

fn validate_hash(value: &str, label: &str) -> Result<(), String> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(format!("{label} must be 64 lowercase hexadecimal characters"));
    }
    Ok(())
}

fn validate_provenance_request(
    decision_id: &Option<String>,
    model_version: &Option<String>,
    artifact_hash: &Option<String>,
    prefix: &str,
) -> Result<(), String> {
    if let Some(value) = decision_id {
        validate_short_text(value, &format!("{prefix} decisionId"))?;
    }
    if let Some(value) = model_version {
        validate_short_text(value, &format!("{prefix} decisionModelVersion"))?;
    }
    if let Some(value) = artifact_hash {
        validate_hash(value, &format!("{prefix} decisionModelArtifactHash"))?;
    }
    Ok(())
}

fn validate_cluster_request(request: &ClusterEmbodimentRequestV1) -> Result<(), String> {
    if request.schema_version != SEMANTIC_EMBODIMENT_SCHEMA_VERSION {
        return Err(format!(
            "unsupported cluster request schemaVersion {}",
            request.schema_version
        ));
    }
    if request.candidate_id != SemanticRepresentationIdV1::ClusterRegions {
        return Err("cluster request requires candidateId=CLUSTER_REGIONS".to_string());
    }
    validate_short_text(&request.cluster_field, "cluster clusterField")?;
    if request.measure_fields.len() > MAX_CLUSTER_MEASURE_FIELDS_V1 {
        return Err(format!(
            "cluster measureFields must contain at most {MAX_CLUSTER_MEASURE_FIELDS_V1} fields"
        ));
    }
    let mut seen = HashSet::new();
    for field in &request.measure_fields {
        validate_short_text(field, "cluster measure field")?;
        if field == &request.cluster_field {
            return Err("clusterField cannot also be a numeric measure field".to_string());
        }
        if !seen.insert(field.as_str()) {
            return Err("cluster measureFields must be unique".to_string());
        }
    }
    validate_provenance_request(
        &request.decision_id,
        &request.decision_model_version,
        &request.decision_model_artifact_hash,
        "cluster",
    )
}

fn validate_graph_request(request: &RelationshipGraphEmbodimentRequestV1) -> Result<(), String> {
    if request.schema_version != SEMANTIC_EMBODIMENT_SCHEMA_VERSION {
        return Err(format!(
            "unsupported relationship graph request schemaVersion {}",
            request.schema_version
        ));
    }
    if request.candidate_id != SemanticRepresentationIdV1::RelationshipGraph {
        return Err("relationship graph request requires candidateId=RELATIONSHIP_GRAPH".to_string());
    }
    validate_provenance_request(
        &request.decision_id,
        &request.decision_model_version,
        &request.decision_model_artifact_hash,
        "relationship graph",
    )
}

fn cluster_information_contract() -> InformationContractV1 {
    InformationContractV1 {
        preserves: vec![
            InformationTypeV1::ClusterSeparation,
            InformationTypeV1::AggregateGroupMagnitude,
        ],
        loses: vec![
            InformationTypeV1::IndividualObservationIdentity,
            InformationTypeV1::ExactMetricValues,
            InformationTypeV1::OutlierBoundaryVisibility,
        ],
    }
}

fn graph_information_contract() -> InformationContractV1 {
    InformationContractV1 {
        preserves: vec![
            InformationTypeV1::RelationalEdgeConnectivity,
            InformationTypeV1::IndividualObservationIdentity,
        ],
        loses: vec![
            InformationTypeV1::ExactMetricValues,
            InformationTypeV1::ClusterSeparation,
        ],
    }
}

fn cluster_refusal(
    fingerprint: String,
    source_row_count: usize,
    request: &ClusterEmbodimentRequestV1,
    code: SemanticRefusalCodeV1,
    message: impl Into<String>,
    estimated_elements: Option<u64>,
) -> StructuralEmbodimentEnvelopeV1 {
    StructuralEmbodimentEnvelopeV1 {
        schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
        dataset_fingerprint: fingerprint,
        candidate_id: SemanticRepresentationIdV1::ClusterRegions,
        representation_family: SemanticEmbodimentFamilyV1::Cluster,
        analytical_method: AnalyticalMethodV1 {
            name: "source-categorical-partition-summary".to_string(),
            version: CLUSTER_METHOD_VERSION.to_string(),
            parameters: serde_json::json!({
                "clusterField": request.cluster_field,
                "measureFields": request.measure_fields,
                "membershipAuthority": "source-categorical-partition"
            }),
        },
        approximation: ApproximationV1 {
            mode: ApproximationModeV1::Exact,
            represented_row_count: 0,
            description: Some(
                "Source-authoritative partition summary; no clustering is inferred".to_string(),
            ),
        },
        information_contract: cluster_information_contract(),
        resource: ResourceEnvelopeV1 {
            source_row_count: source_row_count as u64,
            element_count: 0,
            max_element_count: MAX_CLUSTER_REGIONS_V1,
        },
        provenance: SemanticPayloadProvenanceV1 {
            kernel_version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: CLUSTER_ALGORITHM_VERSION.to_string(),
            decision_id: request.decision_id.clone(),
            decision_model_version: request.decision_model_version.clone(),
            decision_model_artifact_hash: request.decision_model_artifact_hash.clone(),
        },
        result: StructuralEmbodimentResultV1::Refused {
            refusal: SemanticRefusalV1 {
                code,
                message: message.into(),
                estimated_elements,
            },
        },
    }
}

#[derive(Clone)]
struct AxisAccumulator {
    valid_count: u64,
    min: f64,
    max: f64,
    sum: f64,
}

impl AxisAccumulator {
    fn empty() -> Self {
        Self {
            valid_count: 0,
            min: f64::INFINITY,
            max: f64::NEG_INFINITY,
            sum: 0.0,
        }
    }

    fn push(&mut self, value: f64) {
        self.valid_count += 1;
        self.min = self.min.min(value);
        self.max = self.max.max(value);
        self.sum += value;
    }
}

struct RegionAccumulator {
    count: u64,
    axes: Vec<AxisAccumulator>,
}

fn column_value(column: &PrimitiveColumn, index: usize) -> Option<f64> {
    let value = *column.values.get(index)?;
    let valid = *column.validity.get(index)? != 0 && value.is_finite();
    valid.then_some(value)
}

fn cluster_from_columnar(
    fingerprint: String,
    columns: &[crate::data::column::Column],
    columnar: &crate::data::columnar::ColumnarDataset,
    request: &ClusterEmbodimentRequestV1,
) -> StructuralEmbodimentEnvelopeV1 {
    let source_row_count = columnar.row_count();
    if let Err(error) = validate_cluster_request(request) {
        return cluster_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            error,
            None,
        );
    }

    let Some(cluster_index) = columns.iter().position(|column| column.name == request.cluster_field)
    else {
        return cluster_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            format!("unknown clusterField {}", request.cluster_field),
            None,
        );
    };
    if columns[cluster_index].ty != ColumnType::Categorical {
        return cluster_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            "CLUSTER_REGIONS V1 requires an explicit categorical source partition field",
            None,
        );
    }
    let Some(cluster_column) = columnar.categorical_column(cluster_index) else {
        return cluster_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "cluster partition field has no resident categorical column",
            None,
        );
    };
    if cluster_column.codes.len() != source_row_count
        || cluster_column.validity.len() != source_row_count
    {
        return cluster_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "resident cluster partition column does not match the dataset row count",
            None,
        );
    }

    let mut measure_columns: Vec<(String, &PrimitiveColumn)> = Vec::new();
    for field in &request.measure_fields {
        let Some(index) = columns.iter().position(|column| column.name == *field) else {
            return cluster_refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::InvalidParameters,
                format!("unknown cluster measure field {field}"),
                None,
            );
        };
        if columns[index].ty != ColumnType::Numeric {
            return cluster_refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::InvalidParameters,
                format!("cluster measure field {field} must be numeric"),
                None,
            );
        }
        let Some(column) = columnar.primitive_column(index) else {
            return cluster_refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::MissingEvidence,
                format!("cluster measure field {field} has no resident numeric column"),
                None,
            );
        };
        if column.values.len() != source_row_count || column.validity.len() != source_row_count {
            return cluster_refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::MissingEvidence,
                format!("resident cluster measure field {field} length mismatch"),
                None,
            );
        }
        measure_columns.push((field.clone(), column));
    }

    let mut regions: BTreeMap<String, RegionAccumulator> = BTreeMap::new();
    let mut assigned_count = 0u64;
    for row_index in 0..source_row_count {
        if cluster_column.validity[row_index] == 0 {
            continue;
        }
        let code = cluster_column.codes[row_index] as usize;
        let Some(key) = cluster_column.dictionary.get(code) else {
            return cluster_refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::MissingEvidence,
                "cluster partition contains an out-of-range dictionary code",
                None,
            );
        };
        if !regions.contains_key(key) && regions.len() >= MAX_CLUSTER_REGIONS_V1 as usize {
            return cluster_refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::ResourceLimit,
                format!("cluster region count exceeds hard V1 bound {MAX_CLUSTER_REGIONS_V1}"),
                Some((regions.len() + 1) as u64),
            );
        }
        let region = regions.entry(key.clone()).or_insert_with(|| RegionAccumulator {
            count: 0,
            axes: (0..measure_columns.len())
                .map(|_| AxisAccumulator::empty())
                .collect(),
        });
        region.count += 1;
        assigned_count += 1;
        for (axis_index, (_, column)) in measure_columns.iter().enumerate() {
            if let Some(value) = column_value(column, row_index) {
                region.axes[axis_index].push(value);
            }
        }
    }

    if regions.is_empty() {
        return cluster_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "cluster partition contains no assigned observations",
            None,
        );
    }

    let payload_regions = regions
        .into_iter()
        .enumerate()
        .map(|(region_index, (key, region))| {
            let axes = region
                .axes
                .into_iter()
                .enumerate()
                .filter_map(|(axis_index, axis)| {
                    (axis.valid_count > 0).then(|| ClusterAxisSummaryV1 {
                        field: measure_columns[axis_index].0.clone(),
                        valid_count: axis.valid_count,
                        min: axis.min,
                        max: axis.max,
                        mean: axis.sum / axis.valid_count as f64,
                    })
                })
                .collect();
            ClusterRegionV1 {
                semantic_id: format!("cluster-region:{region_index:04}"),
                key,
                count: region.count,
                axes,
            }
        })
        .collect::<Vec<_>>();

    StructuralEmbodimentEnvelopeV1 {
        schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
        dataset_fingerprint: fingerprint,
        candidate_id: SemanticRepresentationIdV1::ClusterRegions,
        representation_family: SemanticEmbodimentFamilyV1::Cluster,
        analytical_method: AnalyticalMethodV1 {
            name: "source-categorical-partition-summary".to_string(),
            version: CLUSTER_METHOD_VERSION.to_string(),
            parameters: serde_json::json!({
                "clusterField": request.cluster_field,
                "measureFields": request.measure_fields,
                "membershipAuthority": "source-categorical-partition"
            }),
        },
        approximation: ApproximationV1 {
            mode: ApproximationModeV1::Exact,
            represented_row_count: source_row_count as u64,
            description: Some(
                "Exact source partition membership summarized into bounded semantic regions"
                    .to_string(),
            ),
        },
        information_contract: cluster_information_contract(),
        resource: ResourceEnvelopeV1 {
            source_row_count: source_row_count as u64,
            element_count: payload_regions.len() as u32,
            max_element_count: MAX_CLUSTER_REGIONS_V1,
        },
        provenance: SemanticPayloadProvenanceV1 {
            kernel_version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: CLUSTER_ALGORITHM_VERSION.to_string(),
            decision_id: request.decision_id.clone(),
            decision_model_version: request.decision_model_version.clone(),
            decision_model_artifact_hash: request.decision_model_artifact_hash.clone(),
        },
        result: StructuralEmbodimentResultV1::Ready {
            payload: StructuralRepresentationPayloadV1::ClusterRegions(ClusterRegionsPayloadV1 {
                cluster_field: request.cluster_field.clone(),
                measure_fields: request.measure_fields.clone(),
                counts: ClusterObservationCountsV1 {
                    source_count: source_row_count as u64,
                    assigned_count,
                    unassigned_count: source_row_count as u64 - assigned_count,
                },
                regions: payload_regions,
            }),
        },
    }
}

fn graph_refusal(
    fingerprint: String,
    source_row_count: usize,
    request: &RelationshipGraphEmbodimentRequestV1,
    code: SemanticRefusalCodeV1,
    message: impl Into<String>,
    estimated_elements: Option<u64>,
) -> StructuralEmbodimentEnvelopeV1 {
    StructuralEmbodimentEnvelopeV1 {
        schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
        dataset_fingerprint: fingerprint,
        candidate_id: SemanticRepresentationIdV1::RelationshipGraph,
        representation_family: SemanticEmbodimentFamilyV1::Graph,
        analytical_method: AnalyticalMethodV1 {
            name: "source-edge-list".to_string(),
            version: GRAPH_METHOD_VERSION.to_string(),
            parameters: serde_json::json!({ "edgeAuthority": "source-provided" }),
        },
        approximation: ApproximationV1 {
            mode: ApproximationModeV1::Exact,
            represented_row_count: 0,
            description: Some("Source-provided relationship edges only; no topology is inferred".to_string()),
        },
        information_contract: graph_information_contract(),
        resource: ResourceEnvelopeV1 {
            source_row_count: source_row_count as u64,
            element_count: 0,
            max_element_count: MAX_RELATIONSHIP_GRAPH_ELEMENTS_V1,
        },
        provenance: SemanticPayloadProvenanceV1 {
            kernel_version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: GRAPH_ALGORITHM_VERSION.to_string(),
            decision_id: request.decision_id.clone(),
            decision_model_version: request.decision_model_version.clone(),
            decision_model_artifact_hash: request.decision_model_artifact_hash.clone(),
        },
        result: StructuralEmbodimentResultV1::Refused {
            refusal: SemanticRefusalV1 {
                code,
                message: message.into(),
                estimated_elements,
            },
        },
    }
}

fn endpoint_identity(endpoint: &EdgeEndpoint, row_count: usize) -> Result<String, String> {
    match endpoint {
        EdgeEndpoint::Index(index) if *index < row_count => Ok(format!("index:{index}")),
        EdgeEndpoint::Index(index) => Err(format!(
            "source graph edge endpoint index {index} is outside row count {row_count}"
        )),
        EdgeEndpoint::Id(id) => {
            validate_short_text(id, "source graph edge endpoint id")?;
            Ok(format!("id:{id}"))
        }
    }
}

fn graph_from_dataset(
    fingerprint: String,
    dataset: &crate::data::Dataset,
    request: &RelationshipGraphEmbodimentRequestV1,
) -> StructuralEmbodimentEnvelopeV1 {
    let source_row_count = dataset.rows.len();
    if let Err(error) = validate_graph_request(request) {
        return graph_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            error,
            None,
        );
    }
    let Some(source_edges) = dataset.edges.as_ref() else {
        return graph_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "RELATIONSHIP_GRAPH V1 requires a source-provided dataset edge list",
            None,
        );
    };
    if source_edges.is_empty() {
        return graph_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "RELATIONSHIP_GRAPH V1 source edge list is empty",
            None,
        );
    }
    if source_edges.len() > MAX_RELATIONSHIP_GRAPH_EDGES_V1 as usize {
        return graph_refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::ResourceLimit,
            format!(
                "relationship edge count exceeds hard V1 bound {MAX_RELATIONSHIP_GRAPH_EDGES_V1}"
            ),
            Some(source_edges.len() as u64),
        );
    }

    let mut degree_by_identity: BTreeMap<String, u32> = BTreeMap::new();
    let mut canonical_edges: Vec<(String, String, Option<f64>)> = Vec::with_capacity(source_edges.len());
    for edge in source_edges {
        let source = match endpoint_identity(&edge.source, source_row_count) {
            Ok(value) => value,
            Err(error) => {
                return graph_refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::InvalidParameters,
                    error,
                    None,
                )
            }
        };
        let target = match endpoint_identity(&edge.target, source_row_count) {
            Ok(value) => value,
            Err(error) => {
                return graph_refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::InvalidParameters,
                    error,
                    None,
                )
            }
        };
        if edge.weight.is_some_and(|weight| !weight.is_finite()) {
            return graph_refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::InvalidParameters,
                "relationship graph edge weights must be finite when present",
                None,
            );
        }
        *degree_by_identity.entry(source.clone()).or_insert(0) += 1;
        *degree_by_identity.entry(target.clone()).or_insert(0) += 1;
        if degree_by_identity.len() > MAX_RELATIONSHIP_GRAPH_NODES_V1 as usize {
            return graph_refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::ResourceLimit,
                format!(
                    "relationship node count exceeds hard V1 bound {MAX_RELATIONSHIP_GRAPH_NODES_V1}"
                ),
                Some(degree_by_identity.len() as u64),
            );
        }
        canonical_edges.push((source, target, edge.weight));
    }

    let mut semantic_by_identity: HashMap<String, String> = HashMap::new();
    let nodes = degree_by_identity
        .into_iter()
        .enumerate()
        .map(|(index, (source_identity, degree))| {
            let semantic_id = format!("relationship-node:{index:05}");
            semantic_by_identity.insert(source_identity.clone(), semantic_id.clone());
            RelationshipGraphNodeV1 {
                semantic_id,
                source_identity,
                degree,
            }
        })
        .collect::<Vec<_>>();

    let edges = canonical_edges
        .into_iter()
        .enumerate()
        .map(|(index, (source, target, weight))| RelationshipGraphEdgeV1 {
            semantic_id: format!("relationship-edge:{index:05}"),
            source_semantic_id: semantic_by_identity
                .get(&source)
                .expect("source identity collected before graph node construction")
                .clone(),
            target_semantic_id: semantic_by_identity
                .get(&target)
                .expect("target identity collected before graph node construction")
                .clone(),
            weight,
        })
        .collect::<Vec<_>>();

    let element_count = nodes.len() as u32 + edges.len() as u32;
    StructuralEmbodimentEnvelopeV1 {
        schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
        dataset_fingerprint: fingerprint,
        candidate_id: SemanticRepresentationIdV1::RelationshipGraph,
        representation_family: SemanticEmbodimentFamilyV1::Graph,
        analytical_method: AnalyticalMethodV1 {
            name: "source-edge-list".to_string(),
            version: GRAPH_METHOD_VERSION.to_string(),
            parameters: serde_json::json!({ "edgeAuthority": "source-provided" }),
        },
        approximation: ApproximationV1 {
            mode: ApproximationModeV1::Exact,
            represented_row_count: nodes.len() as u64,
            description: Some("Exact bounded source edge-list topology".to_string()),
        },
        information_contract: graph_information_contract(),
        resource: ResourceEnvelopeV1 {
            source_row_count: source_row_count as u64,
            element_count,
            max_element_count: MAX_RELATIONSHIP_GRAPH_ELEMENTS_V1,
        },
        provenance: SemanticPayloadProvenanceV1 {
            kernel_version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: GRAPH_ALGORITHM_VERSION.to_string(),
            decision_id: request.decision_id.clone(),
            decision_model_version: request.decision_model_version.clone(),
            decision_model_artifact_hash: request.decision_model_artifact_hash.clone(),
        },
        result: StructuralEmbodimentResultV1::Ready {
            payload: StructuralRepresentationPayloadV1::RelationshipGraph(
                RelationshipGraphPayloadV1 {
                    nodes,
                    edges,
                    source_edge_count: source_edges.len() as u64,
                },
            ),
        },
    }
}

pub fn build_cluster_embodiment_v1(
    handle: u32,
    request: &ClusterEmbodimentRequestV1,
) -> Option<StructuralEmbodimentEnvelopeV1> {
    let fingerprint = data::fingerprint_for_handle(handle)?.ok()?;
    data::with_columnar_metadata(handle, |_name, columns, columnar| {
        cluster_from_columnar(fingerprint, columns, columnar, request)
    })
}

pub fn build_relationship_graph_embodiment_v1(
    handle: u32,
    request: &RelationshipGraphEmbodimentRequestV1,
) -> Option<StructuralEmbodimentEnvelopeV1> {
    let fingerprint = data::fingerprint_for_handle(handle)?.ok()?;
    data::with_dataset(handle, |dataset| graph_from_dataset(fingerprint, dataset, request))
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

fn write_envelope<T: Serialize>(envelope: &T, out_ptr: u32, out_len: u32) -> u32 {
    let output = match serde_json::to_vec(envelope) {
        Ok(output) => output,
        Err(error) => {
            crate::log_error(&format!("structural semantic embodiment serialization failed: {error}"));
            return 0;
        }
    };
    crate::write_bytes_out(&output, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn moneta_build_cluster_embodiment_v1(
    handle: u32,
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(input) = copy_host_input(input_ptr, input_len) else {
        return 0;
    };
    let request: ClusterEmbodimentRequestV1 = match serde_json::from_slice(&input) {
        Ok(request) => request,
        Err(error) => {
            crate::log_error(&format!("cluster semantic embodiment request parse failed: {error}"));
            return 0;
        }
    };
    let Some(envelope) = build_cluster_embodiment_v1(handle, &request) else {
        return 0;
    };
    write_envelope(&envelope, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn moneta_build_relationship_graph_embodiment_v1(
    handle: u32,
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(input) = copy_host_input(input_ptr, input_len) else {
        return 0;
    };
    let request: RelationshipGraphEmbodimentRequestV1 = match serde_json::from_slice(&input) {
        Ok(request) => request,
        Err(error) => {
            crate::log_error(&format!(
                "relationship graph semantic embodiment request parse failed: {error}"
            ));
            return 0;
        }
    };
    let Some(envelope) = build_relationship_graph_embodiment_v1(handle, &request) else {
        return 0;
    };
    write_envelope(&envelope, out_ptr, out_len)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

    use super::*;

    fn cluster_request() -> ClusterEmbodimentRequestV1 {
        ClusterEmbodimentRequestV1 {
            schema_version: 1,
            candidate_id: SemanticRepresentationIdV1::ClusterRegions,
            cluster_field: "group".to_string(),
            measure_fields: vec!["x".to_string(), "y".to_string()],
            decision_id: Some("decision-cluster".to_string()),
            decision_model_version: None,
            decision_model_artifact_hash: None,
        }
    }

    #[test]
    fn cluster_builder_uses_explicit_source_partition_and_bounded_summary() {
        let rows = vec![
            HashMap::from([
                ("group".to_string(), Value::Text("a".to_string())),
                ("x".to_string(), Value::Number(1.0)),
                ("y".to_string(), Value::Number(2.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text("a".to_string())),
                ("x".to_string(), Value::Number(3.0)),
                ("y".to_string(), Value::Number(4.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text("b".to_string())),
                ("x".to_string(), Value::Number(8.0)),
                ("y".to_string(), Value::Number(9.0)),
            ]),
        ];
        let handle = data::register_dataset(Dataset::new(
            "cluster",
            vec![
                Column::new("group", ColumnType::Categorical),
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            rows,
        ));
        let envelope = build_cluster_embodiment_v1(handle, &cluster_request()).expect("cluster envelope");
        let StructuralEmbodimentResultV1::Ready { payload } = envelope.result else {
            panic!("expected ready cluster payload");
        };
        let StructuralRepresentationPayloadV1::ClusterRegions(payload) = payload else {
            panic!("expected cluster payload");
        };
        assert_eq!(payload.regions.len(), 2);
        assert_eq!(payload.counts.assigned_count, 3);
        assert_eq!(payload.regions[0].key, "a");
        assert_eq!(payload.regions[0].count, 2);
        assert_eq!(payload.regions[0].axes[0].mean, 2.0);
    }

    #[test]
    fn cluster_builder_refuses_non_categorical_partition_authority() {
        let handle = data::register_dataset(Dataset::new(
            "bad-cluster",
            vec![Column::new("group", ColumnType::Numeric)],
            vec![HashMap::from([("group".to_string(), Value::Number(1.0))])],
        ));
        let mut request = cluster_request();
        request.measure_fields.clear();
        let envelope = build_cluster_embodiment_v1(handle, &request).expect("refusal envelope");
        assert!(matches!(
            envelope.result,
            StructuralEmbodimentResultV1::Refused {
                refusal: SemanticRefusalV1 {
                    code: SemanticRefusalCodeV1::InvalidParameters,
                    ..
                }
            }
        ));
    }

    fn graph_request() -> RelationshipGraphEmbodimentRequestV1 {
        RelationshipGraphEmbodimentRequestV1 {
            schema_version: 1,
            candidate_id: SemanticRepresentationIdV1::RelationshipGraph,
            decision_id: Some("decision-graph".to_string()),
            decision_model_version: None,
            decision_model_artifact_hash: None,
        }
    }

    #[test]
    fn graph_builder_transports_only_source_edges() {
        let mut dataset = Dataset::new(
            "graph",
            vec![Column::new("id", ColumnType::Categorical)],
            vec![
                HashMap::from([("id".to_string(), Value::Text("a".to_string()))]),
                HashMap::from([("id".to_string(), Value::Text("b".to_string()))]),
            ],
        );
        dataset.edges = Some(vec![Edge::new_id("a", "b")]);
        let handle = data::register_dataset(dataset);
        let envelope = build_relationship_graph_embodiment_v1(handle, &graph_request())
            .expect("graph envelope");
        let StructuralEmbodimentResultV1::Ready { payload } = envelope.result else {
            panic!("expected ready graph payload");
        };
        let StructuralRepresentationPayloadV1::RelationshipGraph(payload) = payload else {
            panic!("expected relationship graph payload");
        };
        assert_eq!(payload.nodes.len(), 2);
        assert_eq!(payload.edges.len(), 1);
        assert_eq!(payload.source_edge_count, 1);
    }

    #[test]
    fn graph_builder_refuses_missing_source_edges_instead_of_inferring_topology() {
        let handle = data::register_dataset(Dataset::new(
            "no-edges",
            vec![Column::new("id", ColumnType::Categorical)],
            vec![HashMap::from([("id".to_string(), Value::Text("a".to_string()))])],
        ));
        let envelope = build_relationship_graph_embodiment_v1(handle, &graph_request())
            .expect("refusal envelope");
        assert!(matches!(
            envelope.result,
            StructuralEmbodimentResultV1::Refused {
                refusal: SemanticRefusalV1 {
                    code: SemanticRefusalCodeV1::MissingEvidence,
                    ..
                }
            }
        ));
    }
}
