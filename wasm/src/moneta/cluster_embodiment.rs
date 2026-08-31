use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::data;
use crate::data::column::ColumnType;
use crate::data::columnar::{ColumnarDataset, PrimitiveColumn};
use crate::data::fingerprint::sha256_hex;

use super::embodiment::{
    AnalyticalMethodV1, ApproximationModeV1, ApproximationV1, InformationContractV1,
    InformationTypeV1, ResourceEnvelopeV1, SemanticEmbodimentFamilyV1,
    SemanticPayloadProvenanceV1, SemanticRefusalCodeV1, SemanticRefusalV1,
    SemanticRepresentationIdV1, SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
};

pub const MAX_CLUSTER_REGIONS_V1: u32 = 256;
const MAX_SHORT_TEXT_BYTES: usize = 256;
const CLUSTER_METHOD_NAME_V1: &str = "source-partition-cluster-summary";
const CLUSTER_METHOD_VERSION_V1: &str = "source-partition-cluster-summary-v1";
const CLUSTER_ALGORITHM_VERSION_V1: &str = "source-partition-cluster-columnar-v1";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterEmbodimentRequestV1 {
    pub schema_version: u32,
    pub candidate_id: SemanticRepresentationIdV1,
    pub partition_field: String,
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
pub struct ClusterAxisSummaryV1 {
    pub field: String,
    pub centroid: f64,
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterSpatialSummaryV1 {
    pub axes: Vec<ClusterAxisSummaryV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterRegionV1 {
    pub semantic_id: String,
    pub source_partition_value: String,
    pub assigned_count: u64,
    pub coordinate_valid_count: u64,
    pub coordinate_excluded_count: u64,
    #[serde(default)]
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
pub enum ClusterEmbodimentResultV1 {
    Ready { payload: ClusterRepresentationPayloadV1 },
    Refused { refusal: SemanticRefusalV1 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClusterEmbodimentEnvelopeV1 {
    pub schema_version: u32,
    pub dataset_fingerprint: String,
    pub candidate_id: SemanticRepresentationIdV1,
    pub representation_family: SemanticEmbodimentFamilyV1,
    pub analytical_method: AnalyticalMethodV1,
    pub approximation: ApproximationV1,
    pub information_contract: InformationContractV1,
    pub resource: ResourceEnvelopeV1,
    pub provenance: SemanticPayloadProvenanceV1,
    pub result: ClusterEmbodimentResultV1,
}

#[derive(Debug, Clone)]
struct AxisAccumulator {
    count: u64,
    centroid: f64,
    min: f64,
    max: f64,
}

impl AxisAccumulator {
    fn empty() -> Self {
        Self {
            count: 0,
            centroid: 0.0,
            min: f64::INFINITY,
            max: f64::NEG_INFINITY,
        }
    }

    fn push(&mut self, value: f64) -> Result<(), ()> {
        let next_count = self.count.checked_add(1).ok_or(())?;
        self.centroid = if self.count == 0 {
            value
        } else {
            let previous_weight = self.count as f64 / next_count as f64;
            let new_weight = 1.0 / next_count as f64;
            self.centroid * previous_weight + value * new_weight
        };
        if !self.centroid.is_finite() {
            return Err(());
        }
        self.min = self.min.min(value);
        self.max = self.max.max(value);
        self.count = next_count;
        Ok(())
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
    fn new(axis_count: usize) -> Self {
        Self {
            assigned_count: 0,
            coordinate_valid_count: 0,
            coordinate_excluded_count: 0,
            axes: (0..axis_count).map(|_| AxisAccumulator::empty()).collect(),
        }
    }
}

fn validate_short_text(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > MAX_SHORT_TEXT_BYTES {
        return Err(format!(
            "{label} must contain 1..={MAX_SHORT_TEXT_BYTES} UTF-8 bytes"
        ));
    }
    Ok(())
}

fn is_lower_hex_64(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
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
    validate_short_text(&request.partition_field, "cluster partitionField")?;
    if request.partition_field.trim() != request.partition_field {
        return Err("cluster partitionField must not contain surrounding whitespace".to_string());
    }
    if !(2..=3).contains(&request.coordinate_fields.len()) {
        return Err("cluster coordinateFields must contain exactly 2 or 3 fields".to_string());
    }
    let mut seen = HashSet::new();
    for field in &request.coordinate_fields {
        validate_short_text(field, "cluster coordinate field")?;
        if field.trim() != field {
            return Err("cluster coordinate fields must not contain surrounding whitespace".to_string());
        }
        if field == &request.partition_field {
            return Err("cluster partitionField must be distinct from coordinateFields".to_string());
        }
        if !seen.insert(field.as_str()) {
            return Err("cluster coordinateFields must be distinct".to_string());
        }
    }
    if let Some(decision_id) = &request.decision_id {
        validate_short_text(decision_id, "cluster decisionId")?;
    }
    if let Some(model_version) = &request.decision_model_version {
        validate_short_text(model_version, "cluster decisionModelVersion")?;
    }
    if let Some(hash) = &request.decision_model_artifact_hash {
        if !is_lower_hex_64(hash) {
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
        "partitionField": request.partition_field,
        "coordinateFields": request.coordinate_fields,
        "membershipAuthority": "source-partition",
        "coordinateValidity": "complete-case-finite",
        "spatialSummary": "arithmetic-centroid-axis-aligned-bounds",
        "maxGroups": MAX_CLUSTER_REGIONS_V1,
    })
}

fn base_envelope(
    fingerprint: String,
    source_row_count: usize,
    represented_row_count: u64,
    element_count: u32,
    request: &ClusterEmbodimentRequestV1,
    result: ClusterEmbodimentResultV1,
) -> ClusterEmbodimentEnvelopeV1 {
    ClusterEmbodimentEnvelopeV1 {
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
                "Bounded source-partition summary with complete-case centroids and descriptive axis-aligned bounds; not a support or confidence boundary"
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
) -> ClusterEmbodimentEnvelopeV1 {
    base_envelope(
        fingerprint,
        source_row_count,
        0,
        0,
        request,
        ClusterEmbodimentResultV1::Refused {
            refusal: SemanticRefusalV1 {
                code,
                message: message.into(),
                estimated_elements,
            },
        },
    )
}

fn semantic_region_id(partition_field: &str, source_partition_value: &str) -> String {
    let preimage = format!(
        "schema={SEMANTIC_EMBODIMENT_SCHEMA_VERSION}\0candidate=CLUSTER_REGIONS\0field={}:{}\0label={}:{}",
        partition_field.len(),
        partition_field,
        source_partition_value.len(),
        source_partition_value,
    );
    format!("cluster-region:{}", sha256_hex(&preimage))
}

fn find_column_index(columns: &[crate::data::column::Column], name: &str) -> Option<usize> {
    columns.iter().position(|column| column.name == name)
}

fn column_value(column: &PrimitiveColumn, row_index: usize) -> Option<f64> {
    let value = *column.values.get(row_index)?;
    let valid = *column.validity.get(row_index)? != 0;
    (valid && value.is_finite()).then_some(value)
}

fn validate_ready_envelope(
    envelope: &ClusterEmbodimentEnvelopeV1,
    request: &ClusterEmbodimentRequestV1,
) -> Result<(), String> {
    if !is_lower_hex_64(&envelope.dataset_fingerprint) {
        return Err("cluster datasetFingerprint must be 64 lowercase hexadecimal characters".to_string());
    }
    if envelope.candidate_id != SemanticRepresentationIdV1::ClusterRegions
        || envelope.representation_family != SemanticEmbodimentFamilyV1::Cluster
    {
        return Err(
            "CLUSTER_REGIONS envelope requires candidateId=CLUSTER_REGIONS and representationFamily=CLUSTER"
                .to_string(),
        );
    }
    if envelope.analytical_method.name != CLUSTER_METHOD_NAME_V1
        || envelope.analytical_method.version != CLUSTER_METHOD_VERSION_V1
        || envelope.analytical_method.parameters != analytical_parameters(request)
    {
        return Err("cluster analyticalMethod must match the reviewed V1 method contract".to_string());
    }
    if envelope.approximation.mode != ApproximationModeV1::Bounded {
        return Err("CLUSTER_REGIONS approximation mode must be BOUNDED".to_string());
    }
    if envelope.information_contract != information_contract() {
        return Err("CLUSTER_REGIONS informationContract must match RFC 0001".to_string());
    }
    if envelope.resource.max_element_count != MAX_CLUSTER_REGIONS_V1 {
        return Err(format!(
            "CLUSTER_REGIONS maxElementCount must equal {MAX_CLUSTER_REGIONS_V1}"
        ));
    }

    let ClusterEmbodimentResultV1::Ready { payload } = &envelope.result else {
        return Err("expected READY cluster envelope".to_string());
    };
    let ClusterRepresentationPayloadV1::ClusterRegions(payload) = payload;
    if payload.partition_field != request.partition_field
        || payload.coordinate_fields != request.coordinate_fields
    {
        return Err("cluster payload fields must match the explicit request".to_string());
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
    if payload
        .counts
        .assigned_count
        .checked_add(payload.counts.unassigned_count)
        != Some(payload.counts.source_count)
    {
        return Err("cluster assigned/unassigned counts must sum to sourceCount".to_string());
    }
    if payload
        .counts
        .coordinate_valid_count
        .checked_add(payload.counts.coordinate_excluded_count)
        != Some(payload.counts.assigned_count)
    {
        return Err(
            "cluster coordinate valid/excluded counts must sum to assignedCount".to_string(),
        );
    }
    if payload.counts.coordinate_valid_count == 0 {
        return Err("READY cluster payload requires at least one coordinate-valid member".to_string());
    }
    if envelope.approximation.represented_row_count != payload.counts.coordinate_valid_count {
        return Err(
            "cluster representedRowCount must equal coordinateValidCount".to_string(),
        );
    }

    let mut semantic_ids = HashSet::new();
    let mut labels = HashSet::new();
    let mut previous_label: Option<&str> = None;
    let mut assigned_sum = 0u64;
    let mut valid_sum = 0u64;
    let mut excluded_sum = 0u64;
    for region in &payload.regions {
        validate_short_text(&region.semantic_id, "cluster semanticId")?;
        if !semantic_ids.insert(region.semantic_id.as_str()) {
            return Err("cluster semanticId values must be unique".to_string());
        }
        if region.source_partition_value.is_empty() {
            return Err("cluster regions may not serialize empty partition labels".to_string());
        }
        if !labels.insert(region.source_partition_value.as_str()) {
            return Err("cluster source partition labels must be unique".to_string());
        }
        if previous_label.is_some_and(|previous| previous >= region.source_partition_value.as_str()) {
            return Err("cluster regions must use deterministic ascending label order".to_string());
        }
        previous_label = Some(region.source_partition_value.as_str());
        if region.semantic_id
            != semantic_region_id(&payload.partition_field, &region.source_partition_value)
        {
            return Err("cluster semanticId must derive from schema/candidate/partition/label identity".to_string());
        }
        if region.assigned_count == 0 {
            return Err("cluster regions with zero assigned members are not serialized".to_string());
        }
        if region
            .coordinate_valid_count
            .checked_add(region.coordinate_excluded_count)
            != Some(region.assigned_count)
        {
            return Err(
                "cluster region coordinate valid/excluded counts must sum to assignedCount"
                    .to_string(),
            );
        }
        match (&region.spatial_summary, region.coordinate_valid_count) {
            (None, 0) => {}
            (None, _) => {
                return Err(
                    "cluster region with coordinate-valid members requires a spatialSummary"
                        .to_string(),
                )
            }
            (Some(_), 0) => {
                return Err(
                    "cluster region with zero coordinate-valid members must have spatialSummary=null"
                        .to_string(),
                )
            }
            (Some(summary), _) => {
                if summary.axes.len() != payload.coordinate_fields.len() {
                    return Err("cluster spatialSummary axes must match coordinateFields".to_string());
                }
                for (axis, expected_field) in summary.axes.iter().zip(&payload.coordinate_fields) {
                    if &axis.field != expected_field {
                        return Err("cluster spatialSummary axis order must match coordinateFields".to_string());
                    }
                    if !axis.centroid.is_finite()
                        || !axis.min.is_finite()
                        || !axis.max.is_finite()
                        || axis.min > axis.centroid
                        || axis.centroid > axis.max
                    {
                        return Err(
                            "cluster spatialSummary must contain finite ordered min/centroid/max values"
                                .to_string(),
                        );
                    }
                }
            }
        }
        assigned_sum = assigned_sum
            .checked_add(region.assigned_count)
            .ok_or_else(|| "cluster assigned count overflow".to_string())?;
        valid_sum = valid_sum
            .checked_add(region.coordinate_valid_count)
            .ok_or_else(|| "cluster valid count overflow".to_string())?;
        excluded_sum = excluded_sum
            .checked_add(region.coordinate_excluded_count)
            .ok_or_else(|| "cluster excluded count overflow".to_string())?;
    }
    if assigned_sum != payload.counts.assigned_count
        || valid_sum != payload.counts.coordinate_valid_count
        || excluded_sum != payload.counts.coordinate_excluded_count
    {
        return Err("cluster region counts must reconcile with global counts".to_string());
    }
    Ok(())
}

fn cluster_from_columnar(
    fingerprint: String,
    columns: &[crate::data::column::Column],
    columnar: &ColumnarDataset,
    request: &ClusterEmbodimentRequestV1,
) -> ClusterEmbodimentEnvelopeV1 {
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

    let Some(partition_index) = find_column_index(columns, &request.partition_field) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            format!("unknown cluster partitionField {}", request.partition_field),
            None,
        );
    };
    if columns[partition_index].ty != ColumnType::Categorical {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::InvalidParameters,
            "CLUSTER_REGIONS V1 requires a logical-categorical partitionField",
            None,
        );
    }
    let Some(partition_column) = columnar.categorical_column(partition_index) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "cluster partitionField has no resident categorical column",
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
            "resident cluster partition column length does not match sourceCount",
            None,
        );
    }

    let mut coordinate_columns: Vec<&PrimitiveColumn> = Vec::with_capacity(request.coordinate_fields.len());
    for field in &request.coordinate_fields {
        let Some(index) = find_column_index(columns, field) else {
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
                format!("cluster coordinate field {field} must be NUMERIC"),
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
        let Some(label) = partition_column.dictionary.get(code) else {
            return refusal(
                fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::MissingEvidence,
                "cluster partition contains an out-of-range dictionary code",
                None,
            );
        };
        if label.is_empty() {
            unassigned_count += 1;
            continue;
        }
        if !regions.contains_key(label) && regions.len() >= MAX_CLUSTER_REGIONS_V1 as usize {
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
            .entry(label.clone())
            .or_insert_with(|| RegionAccumulator::new(coordinate_columns.len()));
        region.assigned_count += 1;

        let mut tuple = [0.0f64; 3];
        let mut tuple_valid = true;
        for (axis_index, column) in coordinate_columns.iter().enumerate() {
            match column_value(column, row_index) {
                Some(value) => tuple[axis_index] = value,
                None => {
                    tuple_valid = false;
                    break;
                }
            }
        }
        if !tuple_valid {
            coordinate_excluded_count += 1;
            region.coordinate_excluded_count += 1;
            continue;
        }

        coordinate_valid_count += 1;
        region.coordinate_valid_count += 1;
        for axis_index in 0..coordinate_columns.len() {
            if region.axes[axis_index].push(tuple[axis_index]).is_err() {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::ResourceLimit,
                    "cluster centroid accumulation exceeded finite numeric range",
                    None,
                );
            }
        }
    }

    if regions.is_empty() {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "cluster partition contains no assigned non-empty source labels",
            None,
        );
    }
    if coordinate_valid_count == 0 {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "no assigned cluster member has a complete finite coordinate tuple",
            None,
        );
    }

    let payload_regions = regions
        .into_iter()
        .map(|(source_partition_value, region)| {
            let spatial_summary = (region.coordinate_valid_count > 0).then(|| ClusterSpatialSummaryV1 {
                axes: region
                    .axes
                    .into_iter()
                    .enumerate()
                    .map(|(axis_index, axis)| ClusterAxisSummaryV1 {
                        field: request.coordinate_fields[axis_index].clone(),
                        centroid: axis.centroid,
                        min: axis.min,
                        max: axis.max,
                    })
                    .collect(),
            });
            ClusterRegionV1 {
                semantic_id: semantic_region_id(&request.partition_field, &source_partition_value),
                source_partition_value,
                assigned_count: region.assigned_count,
                coordinate_valid_count: region.coordinate_valid_count,
                coordinate_excluded_count: region.coordinate_excluded_count,
                spatial_summary,
            }
        })
        .collect::<Vec<_>>();

    let mut envelope = base_envelope(
        fingerprint,
        source_row_count,
        coordinate_valid_count,
        payload_regions.len() as u32,
        request,
        ClusterEmbodimentResultV1::Ready {
            payload: ClusterRepresentationPayloadV1::ClusterRegions(ClusterRegionsPayloadV1 {
                partition_field: request.partition_field.clone(),
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
    );
    if let Err(error) = validate_ready_envelope(&envelope, request) {
        crate::log_error(&format!("cluster semantic embodiment validation failed: {error}"));
        envelope = refusal(
            envelope.dataset_fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "cluster semantic embodiment failed internal contract validation",
            None,
        );
    }
    envelope
}

pub fn build_cluster_embodiment_v1(
    handle: u32,
    request: &ClusterEmbodimentRequestV1,
) -> Option<ClusterEmbodimentEnvelopeV1> {
    let fingerprint = data::fingerprint_for_handle(handle)?.ok()?;
    data::with_columnar_metadata(handle, |_name, columns, columnar| {
        cluster_from_columnar(fingerprint, columns, columnar, request)
    })
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
            schema_version: 1,
            candidate_id: SemanticRepresentationIdV1::ClusterRegions,
            partition_field: "group".to_string(),
            coordinate_fields: vec!["x".to_string(), "y".to_string()],
            decision_id: Some("decision-cluster-c2".to_string()),
            decision_model_version: Some("bootstrap-fitness-v4".to_string()),
            decision_model_artifact_hash: None,
        }
    }

    fn dataset(name: &str, rows: Vec<HashMap<String, Value>>) -> u32 {
        data::register_dataset(Dataset::new(
            name,
            vec![
                Column::new("group", ColumnType::Categorical),
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
                Column::new("z", ColumnType::Numeric),
            ],
            rows,
        ))
    }

    fn ready_payload(envelope: ClusterEmbodimentEnvelopeV1) -> ClusterRegionsPayloadV1 {
        let ClusterEmbodimentResultV1::Ready { payload } = envelope.result else {
            panic!("expected READY cluster envelope");
        };
        let ClusterRepresentationPayloadV1::ClusterRegions(payload) = payload;
        payload
    }

    fn reference_rows() -> Vec<HashMap<String, Value>> {
        vec![
            HashMap::from([
                ("group".to_string(), Value::Text("A".to_string())),
                ("x".to_string(), Value::Number(0.0)),
                ("y".to_string(), Value::Number(0.0)),
                ("z".to_string(), Value::Number(1.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text("A".to_string())),
                ("x".to_string(), Value::Number(2.0)),
                ("y".to_string(), Value::Number(2.0)),
                ("z".to_string(), Value::Number(3.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text("A".to_string())),
                ("x".to_string(), Value::Null),
                ("y".to_string(), Value::Number(4.0)),
                ("z".to_string(), Value::Number(5.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text("B".to_string())),
                ("x".to_string(), Value::Number(10.0)),
                ("y".to_string(), Value::Number(5.0)),
                ("z".to_string(), Value::Number(7.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text("B".to_string())),
                ("x".to_string(), Value::Null),
                ("y".to_string(), Value::Number(6.0)),
                ("z".to_string(), Value::Number(8.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Null),
                ("x".to_string(), Value::Number(20.0)),
                ("y".to_string(), Value::Number(20.0)),
                ("z".to_string(), Value::Number(20.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text(String::new())),
                ("x".to_string(), Value::Number(30.0)),
                ("y".to_string(), Value::Number(30.0)),
                ("z".to_string(), Value::Number(30.0)),
            ]),
        ]
    }

    #[test]
    fn hand_calculable_summary_uses_complete_case_coordinates_and_preserves_zeroes() {
        let envelope = build_cluster_embodiment_v1(dataset("cluster-reference", reference_rows()), &request())
            .expect("cluster envelope");
        assert_eq!(envelope.approximation.mode, ApproximationModeV1::Bounded);
        assert_eq!(envelope.approximation.represented_row_count, 3);
        assert_eq!(envelope.resource.source_row_count, 7);
        assert_eq!(envelope.resource.element_count, 2);
        assert_eq!(envelope.resource.max_element_count, MAX_CLUSTER_REGIONS_V1);
        let payload = ready_payload(envelope);
        assert_eq!(
            payload.counts,
            ClusterObservationCountsV1 {
                source_count: 7,
                assigned_count: 5,
                unassigned_count: 2,
                coordinate_valid_count: 3,
                coordinate_excluded_count: 2,
            }
        );
        assert_eq!(payload.regions.len(), 2);
        let a = &payload.regions[0];
        assert_eq!(a.source_partition_value, "A");
        assert_eq!((a.assigned_count, a.coordinate_valid_count, a.coordinate_excluded_count), (3, 2, 1));
        let axes = &a.spatial_summary.as_ref().expect("A spatial summary").axes;
        assert_eq!((axes[0].min, axes[0].centroid, axes[0].max), (0.0, 1.0, 2.0));
        assert_eq!((axes[1].min, axes[1].centroid, axes[1].max), (0.0, 1.0, 2.0));
    }

    #[test]
    fn supports_exactly_three_explicit_numeric_coordinate_fields() {
        let mut three_d = request();
        three_d.coordinate_fields.push("z".to_string());
        let payload = ready_payload(
            build_cluster_embodiment_v1(dataset("cluster-3d", reference_rows()), &three_d).unwrap(),
        );
        assert_eq!(payload.coordinate_fields, vec!["x", "y", "z"]);
        assert_eq!(payload.regions[0].spatial_summary.as_ref().unwrap().axes.len(), 3);
    }

    #[test]
    fn retains_spatially_unavailable_group_as_null_when_another_group_is_representable() {
        let rows = vec![
            HashMap::from([
                ("group".to_string(), Value::Text("A".to_string())),
                ("x".to_string(), Value::Number(0.0)),
                ("y".to_string(), Value::Number(0.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text("B".to_string())),
                ("x".to_string(), Value::Null),
                ("y".to_string(), Value::Number(2.0)),
            ]),
        ];
        let payload = ready_payload(build_cluster_embodiment_v1(dataset("cluster-null-summary", rows), &request()).unwrap());
        let b = payload.regions.iter().find(|region| region.source_partition_value == "B").unwrap();
        assert_eq!((b.assigned_count, b.coordinate_valid_count, b.coordinate_excluded_count), (1, 0, 1));
        assert!(b.spatial_summary.is_none());
    }

    #[test]
    fn refuses_when_every_assigned_group_lacks_a_complete_coordinate_tuple() {
        let rows = vec![
            HashMap::from([
                ("group".to_string(), Value::Text("A".to_string())),
                ("x".to_string(), Value::Number(1.0)),
                ("y".to_string(), Value::Null),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text("B".to_string())),
                ("x".to_string(), Value::Null),
                ("y".to_string(), Value::Number(2.0)),
            ]),
        ];
        let envelope = build_cluster_embodiment_v1(dataset("cluster-no-spatial", rows), &request()).unwrap();
        assert!(matches!(
            envelope.result,
            ClusterEmbodimentResultV1::Refused {
                refusal: SemanticRefusalV1 {
                    code: SemanticRefusalCodeV1::MissingEvidence,
                    ..
                }
            }
        ));
    }

    #[test]
    fn refuses_wrong_types_and_wrong_coordinate_dimensionality() {
        let numeric_partition = data::register_dataset(Dataset::new(
            "cluster-numeric-partition",
            vec![
                Column::new("group", ColumnType::Numeric),
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            vec![HashMap::from([
                ("group".to_string(), Value::Number(1.0)),
                ("x".to_string(), Value::Number(0.0)),
                ("y".to_string(), Value::Number(0.0)),
            ])],
        ));
        assert!(matches!(
            build_cluster_embodiment_v1(numeric_partition, &request()).unwrap().result,
            ClusterEmbodimentResultV1::Refused { refusal: SemanticRefusalV1 { code: SemanticRefusalCodeV1::InvalidParameters, .. } }
        ));

        for fields in [vec!["x".to_string()], vec!["x".to_string(), "y".to_string(), "z".to_string(), "w".to_string()]] {
            let mut malformed = request();
            malformed.coordinate_fields = fields;
            assert!(matches!(
                build_cluster_embodiment_v1(dataset("cluster-bad-dims", reference_rows()), &malformed).unwrap().result,
                ClusterEmbodimentResultV1::Refused { refusal: SemanticRefusalV1 { code: SemanticRefusalCodeV1::InvalidParameters, .. } }
            ));
        }
    }

    #[test]
    fn refuses_the_257th_assigned_group_without_truncating_or_merging() {
        let rows = (0..257)
            .map(|index| {
                HashMap::from([
                    ("group".to_string(), Value::Text(format!("g{index:03}"))),
                    ("x".to_string(), Value::Number(index as f64)),
                    ("y".to_string(), Value::Number(0.0)),
                ])
            })
            .collect();
        let envelope = build_cluster_embodiment_v1(dataset("cluster-over-bound", rows), &request()).unwrap();
        assert_eq!(envelope.resource.element_count, 0);
        assert!(matches!(
            envelope.result,
            ClusterEmbodimentResultV1::Refused {
                refusal: SemanticRefusalV1 {
                    code: SemanticRefusalCodeV1::ResourceLimit,
                    estimated_elements: Some(257),
                    ..
                }
            }
        ));
    }

    #[test]
    fn region_ids_and_payload_summaries_survive_row_permutation() {
        let forward_rows = reference_rows();
        let mut reverse_rows = forward_rows.clone();
        reverse_rows.reverse();
        let forward = build_cluster_embodiment_v1(dataset("cluster-order", forward_rows), &request()).unwrap();
        let reverse = build_cluster_embodiment_v1(dataset("cluster-order", reverse_rows), &request()).unwrap();
        assert_ne!(forward.dataset_fingerprint, reverse.dataset_fingerprint);
        assert_eq!(ready_payload(forward), ready_payload(reverse));
    }

    #[test]
    fn unrelated_lexically_earlier_group_does_not_renumber_existing_region_ids() {
        let original = ready_payload(build_cluster_embodiment_v1(dataset("cluster-id-original", reference_rows()), &request()).unwrap());
        let mut extra_rows = reference_rows();
        extra_rows.push(HashMap::from([
            ("group".to_string(), Value::Text("0-earlier".to_string())),
            ("x".to_string(), Value::Number(50.0)),
            ("y".to_string(), Value::Number(50.0)),
        ]));
        let expanded = ready_payload(build_cluster_embodiment_v1(dataset("cluster-id-expanded", extra_rows), &request()).unwrap());
        for label in ["A", "B"] {
            let before = original.regions.iter().find(|region| region.source_partition_value == label).unwrap();
            let after = expanded.regions.iter().find(|region| region.source_partition_value == label).unwrap();
            assert_eq!(before.semantic_id, after.semantic_id);
        }
    }
}
