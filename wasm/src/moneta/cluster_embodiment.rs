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
/// Sum of UTF-8 bytes across distinct retained source partition labels.
/// This makes the bounded semantic payload genuinely independent of source N.
pub const MAX_CLUSTER_PARTITION_LABEL_BYTES_V1: usize = 65_536;
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

/// Row-order-independent centroid accumulator.
///
/// Each finite f64 is decomposed as signed_integer_significand * 2^exponent.
/// We sum integer significands exactly inside exponent bins, then convert those
/// bins to the final mean in a fixed exponent order. The number of possible
/// finite f64 exponent bins is fixed, so working memory is bounded by the
/// representation contract rather than source N.
#[derive(Debug, Clone)]
struct AxisAccumulator {
    count: u64,
    significand_bins: BTreeMap<i16, i128>,
    min: f64,
    max: f64,
}

fn finite_f64_components(value: f64) -> (i16, i128) {
    debug_assert!(value.is_finite());
    let bits = value.to_bits();
    let sign = if bits >> 63 == 0 { 1i128 } else { -1i128 };
    let exponent_bits = ((bits >> 52) & 0x7ff) as i16;
    let fraction = bits & ((1u64 << 52) - 1);
    if exponent_bits == 0 {
        (-1074, sign * fraction as i128)
    } else {
        (
            exponent_bits - 1023 - 52,
            sign * ((1u64 << 52) | fraction) as i128,
        )
    }
}

impl AxisAccumulator {
    fn empty() -> Self {
        Self {
            count: 0,
            significand_bins: BTreeMap::new(),
            min: f64::INFINITY,
            max: f64::NEG_INFINITY,
        }
    }

    fn push(&mut self, value: f64) -> Result<(), ()> {
        self.count = self.count.checked_add(1).ok_or(())?;
        let (exponent, significand) = finite_f64_components(value);
        let bin = self.significand_bins.entry(exponent).or_insert(0);
        *bin = bin.checked_add(significand).ok_or(())?;
        self.min = self.min.min(value);
        self.max = self.max.max(value);
        Ok(())
    }

    fn centroid(&self) -> Option<f64> {
        if self.count == 0 {
            return None;
        }
        let denominator = self.count as f64;
        let centroid = self
            .significand_bins
            .iter()
            .rev()
            .fold(0.0, |sum, (exponent, significand)| {
                sum + (*significand as f64 / denominator) * 2.0_f64.powi(*exponent as i32)
            });
        centroid.is_finite().then_some(centroid)
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

fn semantic_region_id(partition_field: &str, label: &str) -> String {
    let preimage = format!(
        "schema={SEMANTIC_EMBODIMENT_SCHEMA_VERSION}\0candidate=CLUSTER_REGIONS\0field={}:{}\0label={}:{}",
        partition_field.len(),
        partition_field,
        label.len(),
        label,
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
        return Err("CLUSTER_REGIONS envelope identity mismatch".to_string());
    }
    if envelope.analytical_method.name != CLUSTER_METHOD_NAME_V1
        || envelope.analytical_method.version != CLUSTER_METHOD_VERSION_V1
        || envelope.analytical_method.parameters != analytical_parameters(request)
    {
        return Err("cluster analyticalMethod must match reviewed V1 method".to_string());
    }
    if envelope.approximation.mode != ApproximationModeV1::Bounded {
        return Err("CLUSTER_REGIONS approximation mode must be BOUNDED".to_string());
    }
    if envelope.information_contract != information_contract() {
        return Err("CLUSTER_REGIONS informationContract must match RFC 0001".to_string());
    }
    if envelope.resource.max_element_count != MAX_CLUSTER_REGIONS_V1 {
        return Err("CLUSTER_REGIONS maxElementCount mismatch".to_string());
    }

    let ClusterEmbodimentResultV1::Ready { payload } = &envelope.result else {
        return Err("expected READY cluster envelope".to_string());
    };
    let ClusterRepresentationPayloadV1::ClusterRegions(payload) = payload;
    if payload.partition_field != request.partition_field
        || payload.coordinate_fields != request.coordinate_fields
    {
        return Err("cluster payload fields must match explicit request".to_string());
    }
    if payload.regions.is_empty() || payload.regions.len() > MAX_CLUSTER_REGIONS_V1 as usize {
        return Err("READY cluster payload region count out of bounds".to_string());
    }
    if envelope.resource.element_count != payload.regions.len() as u32 {
        return Err("cluster resource.elementCount must equal regions length".to_string());
    }
    if payload.counts.source_count != envelope.resource.source_row_count
        || payload.counts.assigned_count.checked_add(payload.counts.unassigned_count)
            != Some(payload.counts.source_count)
        || payload
            .counts
            .coordinate_valid_count
            .checked_add(payload.counts.coordinate_excluded_count)
            != Some(payload.counts.assigned_count)
    {
        return Err("cluster global counts do not reconcile".to_string());
    }
    if payload.counts.coordinate_valid_count == 0
        || envelope.approximation.represented_row_count != payload.counts.coordinate_valid_count
    {
        return Err("cluster representedRowCount/valid-count mismatch".to_string());
    }

    let mut ids = HashSet::new();
    let mut labels = HashSet::new();
    let mut previous_label: Option<&str> = None;
    let mut assigned_sum = 0u64;
    let mut valid_sum = 0u64;
    let mut excluded_sum = 0u64;
    let mut label_bytes = 0usize;
    for region in &payload.regions {
        validate_short_text(&region.semantic_id, "cluster semanticId")?;
        if !ids.insert(region.semantic_id.as_str()) {
            return Err("cluster semanticId values must be unique".to_string());
        }
        if region.source_partition_value.is_empty() {
            return Err("cluster regions may not serialize empty partition labels".to_string());
        }
        label_bytes = label_bytes
            .checked_add(region.source_partition_value.len())
            .ok_or_else(|| "cluster retained partition-label byte count overflow".to_string())?;
        if label_bytes > MAX_CLUSTER_PARTITION_LABEL_BYTES_V1 {
            return Err("cluster retained partition-label byte budget exceeded".to_string());
        }
        if !labels.insert(region.source_partition_value.as_str()) {
            return Err("cluster source partition labels must be unique".to_string());
        }
        if previous_label.is_some_and(|previous| previous >= region.source_partition_value.as_str()) {
            return Err("cluster regions must use deterministic ascending label order".to_string());
        }
        previous_label = Some(region.source_partition_value.as_str());
        if region.semantic_id != semantic_region_id(&payload.partition_field, &region.source_partition_value) {
            return Err("cluster semanticId does not match source identity".to_string());
        }
        if region.assigned_count == 0
            || region
                .coordinate_valid_count
                .checked_add(region.coordinate_excluded_count)
                != Some(region.assigned_count)
        {
            return Err("cluster region counts do not reconcile".to_string());
        }
        match (&region.spatial_summary, region.coordinate_valid_count) {
            (None, 0) => {}
            (Some(summary), valid) if valid > 0 => {
                if summary.axes.len() != payload.coordinate_fields.len() {
                    return Err("cluster spatialSummary axes mismatch".to_string());
                }
                for (axis, expected_field) in summary.axes.iter().zip(&payload.coordinate_fields) {
                    if &axis.field != expected_field
                        || !axis.centroid.is_finite()
                        || !axis.min.is_finite()
                        || !axis.max.is_finite()
                        || axis.min > axis.centroid
                        || axis.centroid > axis.max
                    {
                        return Err("cluster spatialSummary contains invalid geometry".to_string());
                    }
                }
            }
            _ => return Err("cluster null spatialSummary contract violated".to_string()),
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
        return Err("cluster region/global counts mismatch".to_string());
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
            "resident cluster partition column length mismatch",
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
    let mut retained_label_bytes = 0usize;

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
        if !regions.contains_key(label) {
            if regions.len() >= MAX_CLUSTER_REGIONS_V1 as usize {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::ResourceLimit,
                    format!("cluster region count exceeds hard V1 bound {MAX_CLUSTER_REGIONS_V1}"),
                    Some((regions.len() + 1) as u64),
                );
            }
            let Some(next_label_bytes) = retained_label_bytes.checked_add(label.len()) else {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::ResourceLimit,
                    "cluster retained partition-label byte count overflow",
                    None,
                );
            };
            if next_label_bytes > MAX_CLUSTER_PARTITION_LABEL_BYTES_V1 {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::ResourceLimit,
                    format!(
                        "cluster retained partition labels exceed hard V1 UTF-8 byte budget {MAX_CLUSTER_PARTITION_LABEL_BYTES_V1}"
                    ),
                    None,
                );
            }
            retained_label_bytes = next_label_bytes;
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
                    "cluster deterministic centroid accumulator overflow",
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

    let mut payload_regions = Vec::with_capacity(regions.len());
    for (source_partition_value, region) in regions {
        let spatial_summary = if region.coordinate_valid_count == 0 {
            None
        } else {
            let mut axes = Vec::with_capacity(region.axes.len());
            for (axis_index, axis) in region.axes.into_iter().enumerate() {
                let Some(centroid) = axis.centroid() else {
                    return refusal(
                        fingerprint,
                        source_row_count,
                        request,
                        SemanticRefusalCodeV1::ResourceLimit,
                        "cluster deterministic centroid conversion failed",
                        None,
                    );
                };
                axes.push(ClusterAxisSummaryV1 {
                    field: request.coordinate_fields[axis_index].clone(),
                    centroid,
                    min: axis.min,
                    max: axis.max,
                });
            }
            Some(ClusterSpatialSummaryV1 { axes })
        };
        payload_regions.push(ClusterRegionV1 {
            semantic_id: semantic_region_id(&request.partition_field, &source_partition_value),
            source_partition_value,
            assigned_count: region.assigned_count,
            coordinate_valid_count: region.coordinate_valid_count,
            coordinate_excluded_count: region.coordinate_excluded_count,
            spatial_summary,
        });
    }

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

    fn row(group: Value, x: Value, y: Value) -> HashMap<String, Value> {
        HashMap::from([
            ("group".to_string(), group),
            ("x".to_string(), x),
            ("y".to_string(), y),
        ])
    }

    #[test]
    fn complete_case_summary_preserves_membership_and_null_spatial_groups() {
        let rows = vec![
            row(Value::Text("A".into()), Value::Number(0.0), Value::Number(0.0)),
            row(Value::Text("A".into()), Value::Number(2.0), Value::Number(2.0)),
            row(Value::Text("A".into()), Value::Null, Value::Number(4.0)),
            row(Value::Text("B".into()), Value::Null, Value::Number(6.0)),
            row(Value::Null, Value::Number(9.0), Value::Number(9.0)),
        ];
        let envelope = build_cluster_embodiment_v1(dataset("cluster-reference", rows), &request())
            .expect("cluster envelope");
        assert_eq!(envelope.approximation.mode, ApproximationModeV1::Bounded);
        assert_eq!(envelope.approximation.represented_row_count, 2);
        let payload = ready_payload(envelope);
        assert_eq!(
            payload.counts,
            ClusterObservationCountsV1 {
                source_count: 5,
                assigned_count: 4,
                unassigned_count: 1,
                coordinate_valid_count: 2,
                coordinate_excluded_count: 2,
            }
        );
        let a = &payload.regions[0];
        let axes = &a.spatial_summary.as_ref().unwrap().axes;
        assert_eq!((axes[0].min, axes[0].centroid, axes[0].max), (0.0, 1.0, 2.0));
        let b = payload
            .regions
            .iter()
            .find(|region| region.source_partition_value == "B")
            .unwrap();
        assert!(b.spatial_summary.is_none());
    }

    #[test]
    fn deterministic_centroid_survives_catastrophic_cancellation_permutation() {
        let make_rows = |xs: &[f64]| {
            xs.iter()
                .map(|x| row(Value::Text("A".into()), Value::Number(*x), Value::Number(0.0)))
                .collect::<Vec<_>>()
        };
        let first = ready_payload(
            build_cluster_embodiment_v1(
                dataset("cluster-order", make_rows(&[1e16, -1e16, 1.0])),
                &request(),
            )
            .unwrap(),
        );
        let second = ready_payload(
            build_cluster_embodiment_v1(
                dataset("cluster-order", make_rows(&[1.0, -1e16, 1e16])),
                &request(),
            )
            .unwrap(),
        );
        assert_eq!(first, second);
        assert_eq!(
            first.regions[0].spatial_summary.as_ref().unwrap().axes[0].centroid,
            1.0 / 3.0
        );
    }

    #[test]
    fn refuses_group_and_label_resource_overruns() {
        let too_many = (0..257)
            .map(|index| {
                row(
                    Value::Text(format!("g{index:03}")),
                    Value::Number(index as f64),
                    Value::Number(0.0),
                )
            })
            .collect();
        let envelope = build_cluster_embodiment_v1(dataset("cluster-over-groups", too_many), &request()).unwrap();
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

        let oversized_label = vec![row(
            Value::Text("x".repeat(MAX_CLUSTER_PARTITION_LABEL_BYTES_V1 + 1)),
            Value::Number(0.0),
            Value::Number(0.0),
        )];
        let envelope = build_cluster_embodiment_v1(
            dataset("cluster-over-label-bytes", oversized_label),
            &request(),
        )
        .unwrap();
        assert!(matches!(
            envelope.result,
            ClusterEmbodimentResultV1::Refused {
                refusal: SemanticRefusalV1 {
                    code: SemanticRefusalCodeV1::ResourceLimit,
                    ..
                }
            }
        ));
    }
}
