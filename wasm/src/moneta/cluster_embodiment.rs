use std::collections::{BTreeMap, HashSet};
use std::fmt::Write as _;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::data;
use crate::data::column::ColumnType;
use crate::data::columnar::PrimitiveColumn;

use super::embodiment::{
    AnalyticalMethodV1, ApproximationModeV1, ApproximationV1, InformationContractV1,
    InformationTypeV1, ResourceEnvelopeV1, SemanticEmbodimentFamilyV1,
    SemanticPayloadProvenanceV1, SemanticRefusalCodeV1, SemanticRefusalV1,
    SemanticRepresentationIdV1, SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
};

pub const MAX_CLUSTER_REGIONS_V1: u32 = 256;
const MAX_SHORT_TEXT_BYTES: usize = 256;
const MAX_MESSAGE_BYTES: usize = 1024;
const CLUSTER_METHOD_NAME_V1: &str = "source-partition-spatial-summary";
const CLUSTER_METHOD_VERSION_V1: &str = "source-partition-summary-v1";
const CLUSTER_ALGORITHM_VERSION_V1: &str = "categorical-partition-complete-case-v1";
const CLUSTER_SEMANTIC_ID_DOMAIN_V1: &[u8] = b"nemosyne:cluster-region:v1\0";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClusterAuthorityKindV1 {
    SourcePartition,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourcePartitionAuthorityV1 {
    pub kind: ClusterAuthorityKindV1,
    pub field: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterEmbodimentRequestV1 {
    pub schema_version: u32,
    pub candidate_id: SemanticRepresentationIdV1,
    pub authority: SourcePartitionAuthorityV1,
    pub coordinate_fields: Vec<String>,
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
    pub coordinate_valid_count: u64,
    pub coordinate_excluded_count: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterSpatialSummaryV1 {
    pub centroid: Vec<f64>,
    pub min: Vec<f64>,
    pub max: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterRegionV1 {
    pub semantic_id: String,
    pub partition_value: String,
    pub assigned_count: u64,
    pub coordinate_valid_count: u64,
    pub coordinate_excluded_count: u64,
    pub spatial_summary: Option<ClusterSpatialSummaryV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterRegionsPayloadV1 {
    pub partition_field: String,
    pub coordinate_fields: Vec<String>,
    pub counts: ClusterObservationCountsV1,
    pub regions: Vec<ClusterRegionV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClusterRepresentationPayloadV1 {
    ClusterRegions(ClusterRegionsPayloadV1),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClusterSemanticEmbodimentResultV1 {
    Ready { payload: ClusterRepresentationPayloadV1 },
    Refused { refusal: SemanticRefusalV1 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterSemanticEmbodimentEnvelopeV1 {
    pub schema_version: u32,
    pub dataset_fingerprint: String,
    pub candidate_id: SemanticRepresentationIdV1,
    pub representation_family: SemanticEmbodimentFamilyV1,
    pub analytical_method: AnalyticalMethodV1,
    pub approximation: ApproximationV1,
    pub information_contract: InformationContractV1,
    pub resource: ResourceEnvelopeV1,
    pub provenance: SemanticPayloadProvenanceV1,
    pub result: ClusterSemanticEmbodimentResultV1,
}

#[derive(Debug, Clone)]
struct AxisAccumulator {
    count: u64,
    min: f64,
    max: f64,
    mean: f64,
}

impl AxisAccumulator {
    fn empty() -> Self {
        Self {
            count: 0,
            min: f64::INFINITY,
            max: f64::NEG_INFINITY,
            mean: 0.0,
        }
    }

    fn push(&mut self, value: f64) {
        let next_count = self.count + 1;
        self.min = self.min.min(value);
        self.max = self.max.max(value);
        self.mean = if self.count == 0 {
            value
        } else {
            let previous_weight = self.count as f64 / next_count as f64;
            let next_weight = 1.0 / next_count as f64;
            self.mean * previous_weight + value * next_weight
        };
        self.count = next_count;
    }
}

#[derive(Debug, Clone)]
struct RegionAccumulator {
    assigned_count: u64,
    coordinate_valid_count: u64,
    coordinate_excluded_count: u64,
    axes: Vec<AxisAccumulator>,
}

impl RegionAccumulator {
    fn new(dimension_count: usize) -> Self {
        Self {
            assigned_count: 0,
            coordinate_valid_count: 0,
            coordinate_excluded_count: 0,
            axes: (0..dimension_count).map(|_| AxisAccumulator::empty()).collect(),
        }
    }

    fn assign(&mut self) {
        self.assigned_count += 1;
    }

    fn exclude_coordinates(&mut self) {
        self.coordinate_excluded_count += 1;
    }

    fn observe_complete_coordinates(&mut self, coordinates: &[f64]) {
        self.coordinate_valid_count += 1;
        for (axis, value) in self.axes.iter_mut().zip(coordinates.iter().copied()) {
            axis.push(value);
        }
    }
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
    if value.trim() != value {
        return Err(format!("{label} must not contain surrounding whitespace"));
    }
    Ok(())
}

fn validate_request(request: &ClusterEmbodimentRequestV1) -> Result<(), String> {
    if request.schema_version != SEMANTIC_EMBODIMENT_SCHEMA_VERSION {
        return Err(format!(
            "unsupported cluster request schemaVersion {}",
            request.schema_version
        ));
    }
    if request.candidate_id != SemanticRepresentationIdV1::ClusterRegions {
        return Err("cluster request requires candidateId=CLUSTER_REGIONS".to_string());
    }
    if request.authority.kind != ClusterAuthorityKindV1::SourcePartition {
        return Err("cluster request requires SOURCE_PARTITION authority".to_string());
    }
    validate_short_text(&request.authority.field, "cluster authority field")?;
    if !(2..=3).contains(&request.coordinate_fields.len()) {
        return Err("cluster coordinateFields must contain exactly 2 or 3 fields".to_string());
    }
    let mut seen = HashSet::new();
    for field in &request.coordinate_fields {
        validate_short_text(field, "cluster coordinate field")?;
        if field == &request.authority.field {
            return Err("cluster partition field cannot also be a coordinate field".to_string());
        }
        if !seen.insert(field.as_str()) {
            return Err("cluster coordinateFields must be distinct".to_string());
        }
    }
    if let Some(value) = &request.decision_id {
        validate_short_text(value, "cluster decisionId")?;
    }
    if let Some(value) = &request.decision_model_version {
        validate_short_text(value, "cluster decisionModelVersion")?;
    }
    if let Some(value) = &request.decision_model_artifact_hash {
        if !is_lower_hex_64(value) {
            return Err(
                "cluster decisionModelArtifactHash must be 64 lowercase hexadecimal characters"
                    .to_string(),
            );
        }
    }
    Ok(())
}

fn information_contract() -> InformationContractV1 {
    InformationContractV1 {
        preserves: vec![
            InformationTypeV1::ClusterSeparation,
            InformationTypeV1::AggregateGroupMagnitude,
        ],
        loses: vec![
            InformationTypeV1::IndividualObservationIdentity,
            InformationTypeV1::ExactMetricValues,
            InformationTypeV1::PopulationDensityDistribution,
            InformationTypeV1::EmpiricalBivariateBinMass,
            InformationTypeV1::EmpiricalDistributionShape,
            InformationTypeV1::OutlierBoundaryVisibility,
        ],
    }
}

fn analytical_parameters(request: &ClusterEmbodimentRequestV1) -> serde_json::Value {
    serde_json::json!({
        "authority": "SOURCE_PARTITION",
        "partitionField": request.authority.field,
        "coordinateFields": request.coordinate_fields,
        "coordinatePolicy": "complete-case",
        "boundsSemantics": "descriptive-axis-aligned",
        "emptyPartitionLabelPolicy": "unassigned"
    })
}

fn base_envelope(
    fingerprint: String,
    source_row_count: usize,
    request: &ClusterEmbodimentRequestV1,
    represented_row_count: u64,
    element_count: u32,
    result: ClusterSemanticEmbodimentResultV1,
) -> ClusterSemanticEmbodimentEnvelopeV1 {
    ClusterSemanticEmbodimentEnvelopeV1 {
        schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
        dataset_fingerprint: fingerprint,
        candidate_id: SemanticRepresentationIdV1::ClusterRegions,
        representation_family: SemanticEmbodimentFamilyV1::Cluster,
        analytical_method: AnalyticalMethodV1 {
            name: CLUSTER_METHOD_NAME_V1.to_string(),
            version: CLUSTER_METHOD_VERSION_V1.to_string(),
            parameters: analytical_parameters(request),
        },
        approximation: ApproximationV1 {
            mode: ApproximationModeV1::Bounded,
            represented_row_count,
            description: Some(
                "Exact source-partition membership with bounded complete-case spatial summaries"
                    .to_string(),
            ),
        },
        information_contract: information_contract(),
        resource: ResourceEnvelopeV1 {
            source_row_count: source_row_count as u64,
            element_count,
            max_element_count: MAX_CLUSTER_REGIONS_V1,
        },
        provenance: SemanticPayloadProvenanceV1 {
            kernel_version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: CLUSTER_ALGORITHM_VERSION_V1.to_string(),
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
    request: &ClusterEmbodimentRequestV1,
    code: SemanticRefusalCodeV1,
    message: impl Into<String>,
    estimated_elements: Option<u64>,
) -> ClusterSemanticEmbodimentEnvelopeV1 {
    base_envelope(
        fingerprint,
        source_row_count,
        request,
        0,
        0,
        ClusterSemanticEmbodimentResultV1::Refused {
            refusal: SemanticRefusalV1 {
                code,
                message: message.into(),
                estimated_elements,
            },
        },
    )
}

fn coordinate_value(column: &PrimitiveColumn, row_index: usize) -> Option<f64> {
    let value = *column.values.get(row_index)?;
    let valid = column.validity.get(row_index).copied().unwrap_or(0) != 0;
    (valid && value.is_finite()).then_some(value)
}

fn semantic_id(partition_field: &str, partition_value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(CLUSTER_SEMANTIC_ID_DOMAIN_V1);
    hasher.update((partition_field.len() as u64).to_be_bytes());
    hasher.update(partition_field.as_bytes());
    hasher.update((partition_value.len() as u64).to_be_bytes());
    hasher.update(partition_value.as_bytes());
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(64);
    for byte in digest {
        write!(&mut hex, "{byte:02x}").expect("writing to String cannot fail");
    }
    format!("cluster-region:{hex}")
}

fn cluster_from_columnar(
    fingerprint: String,
    columns: &[crate::data::column::Column],
    columnar: &crate::data::columnar::ColumnarDataset,
    request: &ClusterEmbodimentRequestV1,
) -> ClusterSemanticEmbodimentEnvelopeV1 {
    let source_row_count = columnar.row_count();
    if let Err(error) = validate_request(request) {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            error,
            None,
        );
    }

    let Some(partition_index) = columns
        .iter()
        .position(|column| column.name == request.authority.field)
    else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            format!("unknown cluster partition field {}", request.authority.field),
            None,
        );
    };
    if columns[partition_index].ty != ColumnType::Categorical {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            "CLUSTER_REGIONS V1 requires a categorical SOURCE_PARTITION field",
            None,
        );
    }
    let Some(partition_column) = columnar.categorical_column(partition_index) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "cluster partition field has no resident categorical column",
            None,
        );
    };
    if partition_column.codes.len() != source_row_count
        || partition_column.validity.len() != source_row_count
    {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "resident cluster partition column does not match dataset row count",
            None,
        );
    }

    let mut coordinate_columns: Vec<&PrimitiveColumn> = Vec::with_capacity(request.coordinate_fields.len());
    for field in &request.coordinate_fields {
        let Some(index) = columns.iter().position(|column| column.name == *field) else {
            return refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::InvalidParameters,
                format!("unknown cluster coordinate field {field}"),
                None,
            );
        };
        if columns[index].ty != ColumnType::Numeric {
            return refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::InvalidParameters,
                format!("cluster coordinate field {field} must be numeric"),
                None,
            );
        }
        let Some(column) = columnar.primitive_column(index) else {
            return refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::MissingEvidence,
                format!("cluster coordinate field {field} has no resident numeric column"),
                None,
            );
        };
        if column.values.len() != source_row_count || column.validity.len() != source_row_count {
            return refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::MissingEvidence,
                format!("resident cluster coordinate field {field} length mismatch"),
                None,
            );
        }
        coordinate_columns.push(column);
    }

    let mut regions: BTreeMap<String, RegionAccumulator> = BTreeMap::new();
    let mut assigned_count = 0u64;
    let mut unassigned_count = 0u64;
    let mut coordinate_valid_count = 0u64;
    let mut coordinate_excluded_count = 0u64;

    for row_index in 0..source_row_count {
        if partition_column.validity[row_index] == 0 {
            unassigned_count += 1;
            continue;
        }
        let code = partition_column.codes[row_index] as usize;
        let Some(partition_value) = partition_column.dictionary.get(code) else {
            return refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::MissingEvidence,
                "cluster partition contains an out-of-range dictionary code",
                None,
            );
        };
        if partition_value.is_empty() {
            unassigned_count += 1;
            continue;
        }

        if !regions.contains_key(partition_value) && regions.len() >= MAX_CLUSTER_REGIONS_V1 as usize {
            return refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::ResourceLimit,
                format!(
                    "cluster region count exceeds hard V1 bound {MAX_CLUSTER_REGIONS_V1}"
                ),
                Some((regions.len() + 1) as u64),
            );
        }

        assigned_count += 1;
        let region = regions
            .entry(partition_value.clone())
            .or_insert_with(|| RegionAccumulator::new(coordinate_columns.len()));
        region.assign();

        let coordinates = coordinate_columns
            .iter()
            .map(|column| coordinate_value(column, row_index))
            .collect::<Option<Vec<_>>>();
        if let Some(coordinates) = coordinates {
            coordinate_valid_count += 1;
            region.observe_complete_coordinates(&coordinates);
        } else {
            coordinate_excluded_count += 1;
            region.exclude_coordinates();
        }
    }

    if regions.is_empty() {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "cluster source partition contains no non-empty assigned labels",
            None,
        );
    }
    if coordinate_valid_count == 0 {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "cluster source partition contains no complete-case coordinate tuples",
            None,
        );
    }

    let payload_regions = regions
        .into_iter()
        .map(|(partition_value, region)| {
            let spatial_summary = (region.coordinate_valid_count > 0).then(|| {
                ClusterSpatialSummaryV1 {
                    centroid: region.axes.iter().map(|axis| axis.mean).collect(),
                    min: region.axes.iter().map(|axis| axis.min).collect(),
                    max: region.axes.iter().map(|axis| axis.max).collect(),
                }
            });
            ClusterRegionV1 {
                semantic_id: semantic_id(&request.authority.field, &partition_value),
                partition_value,
                assigned_count: region.assigned_count,
                coordinate_valid_count: region.coordinate_valid_count,
                coordinate_excluded_count: region.coordinate_excluded_count,
                spatial_summary,
            }
        })
        .collect::<Vec<_>>();

    base_envelope(
        fingerprint,
        source_row_count,
        request,
        coordinate_valid_count,
        payload_regions.len() as u32,
        ClusterSemanticEmbodimentResultV1::Ready {
            payload: ClusterRepresentationPayloadV1::ClusterRegions(ClusterRegionsPayloadV1 {
                partition_field: request.authority.field.clone(),
                coordinate_fields: request.coordinate_fields.clone(),
                counts: ClusterObservationCountsV1 {
                    source_count: source_row_count as u64,
                    assigned_count,
                    unassigned_count,
                    coordinate_valid_count,
                    coordinate_excluded_count,
                },
                regions: payload_regions,
            }),
        },
    )
}

fn validate_ready_payload(
    envelope: &ClusterSemanticEmbodimentEnvelopeV1,
    payload: &ClusterRegionsPayloadV1,
) -> Result<(), String> {
    if envelope.candidate_id != SemanticRepresentationIdV1::ClusterRegions
        || envelope.representation_family != SemanticEmbodimentFamilyV1::Cluster
    {
        return Err("cluster payload requires CLUSTER_REGIONS / CLUSTER envelope identity".to_string());
    }
    if envelope.analytical_method.name != CLUSTER_METHOD_NAME_V1
        || envelope.analytical_method.version != CLUSTER_METHOD_VERSION_V1
    {
        return Err("cluster analytical method does not match reviewed C2 V1 contract".to_string());
    }
    if envelope.approximation.mode != ApproximationModeV1::Bounded {
        return Err("CLUSTER_REGIONS READY approximation mode must be BOUNDED".to_string());
    }
    if envelope.information_contract != information_contract() {
        return Err("cluster informationContract must match the reviewed C1 ontology".to_string());
    }
    if envelope.resource.max_element_count != MAX_CLUSTER_REGIONS_V1 {
        return Err(format!(
            "cluster maxElementCount must equal {MAX_CLUSTER_REGIONS_V1}"
        ));
    }
    if payload.regions.is_empty() || payload.regions.len() > MAX_CLUSTER_REGIONS_V1 as usize {
        return Err(format!(
            "READY cluster payload must contain 1..={MAX_CLUSTER_REGIONS_V1} regions"
        ));
    }
    if envelope.resource.element_count != payload.regions.len() as u32 {
        return Err("cluster resource.elementCount must equal regions length".to_string());
    }
    if payload.counts.source_count != envelope.resource.source_row_count {
        return Err("cluster counts.sourceCount must equal resource.sourceRowCount".to_string());
    }
    if payload.counts.assigned_count + payload.counts.unassigned_count
        != payload.counts.source_count
    {
        return Err("cluster assignedCount + unassignedCount must equal sourceCount".to_string());
    }
    if payload.counts.coordinate_valid_count + payload.counts.coordinate_excluded_count
        != payload.counts.assigned_count
    {
        return Err(
            "cluster coordinateValidCount + coordinateExcludedCount must equal assignedCount"
                .to_string(),
        );
    }
    if payload.counts.coordinate_valid_count == 0 {
        return Err("READY cluster payload requires at least one valid coordinate tuple".to_string());
    }
    if envelope.approximation.represented_row_count != payload.counts.coordinate_valid_count {
        return Err("cluster representedRowCount must equal coordinateValidCount".to_string());
    }
    if !(2..=3).contains(&payload.coordinate_fields.len()) {
        return Err("cluster payload requires exactly 2 or 3 coordinateFields".to_string());
    }

    let dimension_count = payload.coordinate_fields.len();
    let mut semantic_ids = HashSet::new();
    let mut previous_partition_value: Option<&str> = None;
    let mut assigned_sum = 0u64;
    let mut valid_sum = 0u64;
    let mut excluded_sum = 0u64;

    for region in &payload.regions {
        if region.partition_value.is_empty() {
            return Err("READY cluster region cannot contain an empty partitionValue".to_string());
        }
        if previous_partition_value.is_some_and(|previous| previous >= region.partition_value.as_str()) {
            return Err("cluster regions must be ordered by exact source partition value".to_string());
        }
        previous_partition_value = Some(region.partition_value.as_str());
        let expected_id = semantic_id(&payload.partition_field, &region.partition_value);
        if region.semantic_id != expected_id {
            return Err("cluster semanticId must derive from partition field + exact source label".to_string());
        }
        if !semantic_ids.insert(region.semantic_id.as_str()) {
            return Err("cluster semanticId values must be unique".to_string());
        }
        if region.assigned_count == 0 {
            return Err("cluster regions with zero assigned members are not serialized".to_string());
        }
        if region.coordinate_valid_count + region.coordinate_excluded_count != region.assigned_count {
            return Err(
                "cluster region valid + excluded coordinate counts must equal assignedCount"
                    .to_string(),
            );
        }
        assigned_sum += region.assigned_count;
        valid_sum += region.coordinate_valid_count;
        excluded_sum += region.coordinate_excluded_count;

        match (&region.spatial_summary, region.coordinate_valid_count) {
            (None, 0) => {}
            (None, _) => {
                return Err(
                    "cluster region with valid coordinates requires a spatialSummary".to_string(),
                )
            }
            (Some(_), 0) => {
                return Err(
                    "cluster region with zero valid coordinates must use spatialSummary=null"
                        .to_string(),
                )
            }
            (Some(summary), _) => {
                if summary.centroid.len() != dimension_count
                    || summary.min.len() != dimension_count
                    || summary.max.len() != dimension_count
                {
                    return Err("cluster spatialSummary dimensionality mismatch".to_string());
                }
                for axis in 0..dimension_count {
                    let centroid = summary.centroid[axis];
                    let min = summary.min[axis];
                    let max = summary.max[axis];
                    if !centroid.is_finite() || !min.is_finite() || !max.is_finite() {
                        return Err("cluster spatialSummary values must be finite".to_string());
                    }
                    if min > max || centroid < min || centroid > max {
                        return Err(
                            "cluster centroid must lie inside its descriptive axis-aligned bounds"
                                .to_string(),
                        );
                    }
                }
            }
        }
    }

    if assigned_sum != payload.counts.assigned_count
        || valid_sum != payload.counts.coordinate_valid_count
        || excluded_sum != payload.counts.coordinate_excluded_count
    {
        return Err("cluster per-region counts must reconcile with global counts".to_string());
    }
    Ok(())
}

pub fn validate_cluster_envelope(
    envelope: &ClusterSemanticEmbodimentEnvelopeV1,
) -> Result<(), String> {
    if envelope.schema_version != SEMANTIC_EMBODIMENT_SCHEMA_VERSION {
        return Err("unsupported cluster envelope schemaVersion".to_string());
    }
    if !is_lower_hex_64(&envelope.dataset_fingerprint) {
        return Err("cluster datasetFingerprint must be 64 lowercase hexadecimal characters".to_string());
    }
    if envelope.resource.element_count > envelope.resource.max_element_count {
        return Err("cluster resource.elementCount exceeds maxElementCount".to_string());
    }
    if envelope.provenance.algorithm_version != CLUSTER_ALGORITHM_VERSION_V1 {
        return Err("cluster provenance algorithmVersion mismatch".to_string());
    }
    if let Some(description) = &envelope.approximation.description {
        if description.len() > MAX_MESSAGE_BYTES {
            return Err(format!(
                "cluster approximation description exceeds {MAX_MESSAGE_BYTES} bytes"
            ));
        }
    }

    match &envelope.result {
        ClusterSemanticEmbodimentResultV1::Ready { payload } => match payload {
            ClusterRepresentationPayloadV1::ClusterRegions(payload) => {
                validate_ready_payload(envelope, payload)?;
            }
        },
        ClusterSemanticEmbodimentResultV1::Refused { refusal } => {
            if refusal.message.is_empty() || refusal.message.len() > MAX_MESSAGE_BYTES {
                return Err(format!(
                    "cluster refusal message must contain 1..={MAX_MESSAGE_BYTES} bytes"
                ));
            }
            if envelope.resource.element_count != 0
                || envelope.approximation.represented_row_count != 0
            {
                return Err(
                    "REFUSED cluster embodiment must have zero elements and represented rows"
                        .to_string(),
                );
            }
        }
    }
    Ok(())
}

pub fn build_cluster_embodiment_v1(
    handle: u32,
    request: &ClusterEmbodimentRequestV1,
) -> Option<ClusterSemanticEmbodimentEnvelopeV1> {
    let fingerprint = data::fingerprint_for_handle(handle)?.ok()?;
    let envelope = data::with_columnar_metadata(handle, |_name, columns, columnar| {
        cluster_from_columnar(fingerprint, columns, columnar, request)
    })?;
    if let Err(error) = validate_cluster_envelope(&envelope) {
        crate::log_error(&format!("cluster semantic embodiment validation failed: {error}"));
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
    let output = match serde_json::to_vec(&envelope) {
        Ok(output) => output,
        Err(error) => {
            crate::log_error(&format!("cluster semantic embodiment serialization failed: {error}"));
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

    fn request() -> ClusterEmbodimentRequestV1 {
        ClusterEmbodimentRequestV1 {
            schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
            candidate_id: SemanticRepresentationIdV1::ClusterRegions,
            authority: SourcePartitionAuthorityV1 {
                kind: ClusterAuthorityKindV1::SourcePartition,
                field: "cluster".to_string(),
            },
            coordinate_fields: vec!["x".to_string(), "y".to_string()],
            decision_id: Some("decision-cluster-c2".to_string()),
            decision_model_version: Some("bootstrap-fitness-v4".to_string()),
            decision_model_artifact_hash: None,
        }
    }

    fn row(cluster: Option<&str>, x: Option<f64>, y: Option<f64>) -> HashMap<String, Value> {
        HashMap::from([
            (
                "cluster".to_string(),
                cluster
                    .map(|value| Value::Text(value.to_string()))
                    .unwrap_or(Value::Null),
            ),
            ("x".to_string(), x.map(Value::Number).unwrap_or(Value::Null)),
            ("y".to_string(), y.map(Value::Number).unwrap_or(Value::Null)),
        ])
    }

    fn handle(name: &str, rows: Vec<HashMap<String, Value>>) -> u32 {
        data::register_dataset(Dataset::new(
            name,
            vec![
                Column::new("cluster", ColumnType::Categorical),
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            rows,
        ))
    }

    fn ready_payload(
        envelope: ClusterSemanticEmbodimentEnvelopeV1,
    ) -> ClusterRegionsPayloadV1 {
        let ClusterSemanticEmbodimentResultV1::Ready { payload } = envelope.result else {
            panic!("expected READY cluster payload");
        };
        let ClusterRepresentationPayloadV1::ClusterRegions(payload) = payload;
        payload
    }

    fn refusal_code(envelope: ClusterSemanticEmbodimentEnvelopeV1) -> SemanticRefusalCodeV1 {
        let ClusterSemanticEmbodimentResultV1::Refused { refusal } = envelope.result else {
            panic!("expected REFUSED cluster payload");
        };
        refusal.code
    }

    #[test]
    fn computes_complete_case_source_partition_summary() {
        let handle = handle(
            "cluster-c2-reference",
            vec![
                row(Some("A"), Some(0.0), Some(0.0)),
                row(Some("A"), Some(2.0), Some(2.0)),
                row(Some("A"), None, Some(4.0)),
                row(Some("B"), Some(10.0), Some(5.0)),
                row(Some("B"), None, None),
                row(None, Some(3.0), Some(3.0)),
                row(Some(""), Some(4.0), Some(4.0)),
                row(Some("C"), None, Some(9.0)),
            ],
        );
        let envelope = build_cluster_embodiment_v1(handle, &request()).expect("cluster envelope");
        assert_eq!(envelope.approximation.mode, ApproximationModeV1::Bounded);
        assert_eq!(envelope.approximation.represented_row_count, 3);
        let payload = ready_payload(envelope);
        assert_eq!(
            payload.counts,
            ClusterObservationCountsV1 {
                source_count: 8,
                assigned_count: 6,
                unassigned_count: 2,
                coordinate_valid_count: 3,
                coordinate_excluded_count: 3,
            }
        );
        assert_eq!(payload.regions.len(), 3);
        let a = payload.regions.iter().find(|region| region.partition_value == "A").unwrap();
        assert_eq!(a.assigned_count, 3);
        assert_eq!(a.coordinate_valid_count, 2);
        assert_eq!(a.coordinate_excluded_count, 1);
        let a_spatial = a.spatial_summary.as_ref().expect("A spatial summary");
        assert_eq!(a_spatial.centroid, vec![1.0, 1.0]);
        assert_eq!(a_spatial.min, vec![0.0, 0.0]);
        assert_eq!(a_spatial.max, vec![2.0, 2.0]);
        let c = payload.regions.iter().find(|region| region.partition_value == "C").unwrap();
        assert_eq!(c.assigned_count, 1);
        assert_eq!(c.coordinate_valid_count, 0);
        assert!(c.spatial_summary.is_none());
        data::destroy_dataset(handle);
    }

    #[test]
    fn stable_region_ids_ignore_row_order_and_unrelated_group_insertion() {
        let forward = handle(
            "stable-id",
            vec![
                row(Some("B"), Some(2.0), Some(2.0)),
                row(Some("A"), Some(1.0), Some(1.0)),
            ],
        );
        let reverse = handle(
            "stable-id",
            vec![
                row(Some("A"), Some(1.0), Some(1.0)),
                row(Some("B"), Some(2.0), Some(2.0)),
            ],
        );
        let inserted = handle(
            "stable-id",
            vec![
                row(Some("0-before"), Some(0.0), Some(0.0)),
                row(Some("A"), Some(1.0), Some(1.0)),
                row(Some("B"), Some(2.0), Some(2.0)),
            ],
        );
        let id_for = |handle, label: &str| {
            ready_payload(build_cluster_embodiment_v1(handle, &request()).unwrap())
                .regions
                .into_iter()
                .find(|region| region.partition_value == label)
                .unwrap()
                .semantic_id
        };
        assert_eq!(id_for(forward, "A"), id_for(reverse, "A"));
        assert_eq!(id_for(forward, "A"), id_for(inserted, "A"));
        assert_ne!(
            data::fingerprint_for_handle(forward).unwrap().unwrap(),
            data::fingerprint_for_handle(reverse).unwrap().unwrap()
        );
        data::destroy_dataset(forward);
        data::destroy_dataset(reverse);
        data::destroy_dataset(inserted);
    }

    #[test]
    fn preserves_non_empty_source_labels_exactly() {
        let handle = handle(
            "exact-label",
            vec![
                row(Some(" A "), Some(1.0), Some(2.0)),
                row(Some("A"), Some(3.0), Some(4.0)),
            ],
        );
        let payload = ready_payload(build_cluster_embodiment_v1(handle, &request()).unwrap());
        assert_eq!(
            payload
                .regions
                .iter()
                .map(|region| region.partition_value.as_str())
                .collect::<Vec<_>>(),
            vec![" A ", "A"]
        );
        data::destroy_dataset(handle);
    }

    #[test]
    fn refuses_when_all_assigned_rows_lack_complete_coordinates() {
        let handle = handle(
            "all-invalid-spatial",
            vec![
                row(Some("A"), None, Some(2.0)),
                row(Some("B"), Some(3.0), None),
            ],
        );
        let envelope = build_cluster_embodiment_v1(handle, &request()).unwrap();
        assert_eq!(refusal_code(envelope), SemanticRefusalCodeV1::MissingEvidence);
        data::destroy_dataset(handle);
    }

    #[test]
    fn refuses_more_than_256_assigned_partition_groups() {
        let rows = (0..257)
            .map(|index| row(Some(&format!("g{index:03}")), Some(index as f64), Some(0.0)))
            .collect();
        let handle = handle("over-bound", rows);
        let envelope = build_cluster_embodiment_v1(handle, &request()).unwrap();
        assert_eq!(refusal_code(envelope), SemanticRefusalCodeV1::ResourceLimit);
        assert_eq!(envelope.resource.max_element_count, MAX_CLUSTER_REGIONS_V1);
        data::destroy_dataset(handle);
    }

    #[test]
    fn rejects_non_categorical_partition_and_wrong_coordinate_cardinality() {
        let numeric_partition = data::register_dataset(Dataset::new(
            "numeric-partition",
            vec![
                Column::new("cluster", ColumnType::Numeric),
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            vec![HashMap::from([
                ("cluster".to_string(), Value::Number(1.0)),
                ("x".to_string(), Value::Number(1.0)),
                ("y".to_string(), Value::Number(2.0)),
            ])],
        ));
        let envelope = build_cluster_embodiment_v1(numeric_partition, &request()).unwrap();
        assert_eq!(refusal_code(envelope), SemanticRefusalCodeV1::InvalidParameters);

        let valid = handle("bad-dimensions", vec![row(Some("A"), Some(1.0), Some(2.0))]);
        let mut one_dimension = request();
        one_dimension.coordinate_fields = vec!["x".to_string()];
        let envelope = build_cluster_embodiment_v1(valid, &one_dimension).unwrap();
        assert_eq!(refusal_code(envelope), SemanticRefusalCodeV1::InvalidParameters);
        data::destroy_dataset(numeric_partition);
        data::destroy_dataset(valid);
    }
}
