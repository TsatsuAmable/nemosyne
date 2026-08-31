use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

pub const SEMANTIC_EMBODIMENT_SCHEMA_VERSION: u32 = 1;
pub const MAX_AGGREGATE_GROUPS_V1: u32 = 4096;
pub const MAX_DISTRIBUTION_BINS_V1: u32 = 256;
pub const MAX_DISTRIBUTION_ECDF_KNOTS_V1: u32 = 256;
pub const MAX_DISTRIBUTION_QUANTILES_V1: u32 = 32;
pub const MAX_DISTRIBUTION_ELEMENTS_V1: u32 =
    MAX_DISTRIBUTION_BINS_V1
        + MAX_DISTRIBUTION_ECDF_KNOTS_V1
        + MAX_DISTRIBUTION_QUANTILES_V1;
pub const MAX_DENSITY_BINS_X_V1: u32 = 20;
pub const MAX_DENSITY_BINS_Y_V1: u32 = 20;
pub const MAX_DENSITY_CELLS_V1: u32 = MAX_DENSITY_BINS_X_V1 * MAX_DENSITY_BINS_Y_V1;
pub const MAX_METHOD_PARAMETERS_JSON_BYTES_V1: usize = 8192;
const MAX_SHORT_TEXT_BYTES: usize = 256;
const MAX_MESSAGE_BYTES: usize = 1024;
const MAX_GROUPING_FIELDS_V1: usize = 4;
const EMPIRICAL_DISTRIBUTION_METHOD_NAME_V1: &str = "univariate-empirical-distribution";
const BINNED_DENSITY_METHOD_NAME_V1: &str = "bivariate-binned-density";
const BINNED_DENSITY_METHOD_VERSION_V1: &str = "binned-density-contract-v1";
pub const BINNED_DENSITY_CONSTANT_DOMAIN_POLICY_V1: &str =
    "assign-final-bin-per-degenerate-axis";

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
    Density,
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
    EmpiricalBivariateBinMass,
    EmpiricalDistributionShape,
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
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DistributionEmbodimentRequestV1 {
    pub schema_version: u32,
    pub candidate_id: SemanticRepresentationIdV1,
    pub measure_field: String,
    pub histogram_bin_count: u32,
    pub ecdf_knot_count: u32,
    pub quantile_probabilities: Vec<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_artifact_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DistributionObservationCountsV1 {
    pub source_count: u64,
    pub valid_count: u64,
    pub excluded_count: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DistributionDomainV1 {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DistributionHistogramBinV1 {
    pub semantic_id: String,
    pub lower_bound: f64,
    pub upper_bound: f64,
    pub count: u64,
    pub upper_inclusive: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DistributionEcdfKnotV1 {
    pub semantic_id: String,
    pub value: f64,
    pub cumulative_count: u64,
    pub cumulative_probability: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DistributionQuantileV1 {
    pub semantic_id: String,
    pub probability: f64,
    pub value: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EmpiricalDistributionPayloadV1 {
    pub measure_field: String,
    pub domain: DistributionDomainV1,
    pub counts: DistributionObservationCountsV1,
    pub histogram: Vec<DistributionHistogramBinV1>,
    pub ecdf: Vec<DistributionEcdfKnotV1>,
    pub quantiles: Vec<DistributionQuantileV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DensityEmbodimentRequestV1 {
    pub schema_version: u32,
    pub candidate_id: SemanticRepresentationIdV1,
    pub measure_field_x: String,
    pub measure_field_y: String,
    pub bins_x: u32,
    pub bins_y: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_artifact_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DensityObservationCountsV1 {
    pub source_count: u64,
    pub valid_count: u64,
    pub excluded_count: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DensityDomainV1 {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DensityGridCellV1 {
    pub semantic_id: String,
    pub x_index: u32,
    pub y_index: u32,
    pub x_lower_bound: f64,
    pub x_upper_bound: f64,
    pub y_lower_bound: f64,
    pub y_upper_bound: f64,
    pub count: u64,
    pub x_upper_inclusive: bool,
    pub y_upper_inclusive: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BinnedDensityPayloadV1 {
    pub measure_field_x: String,
    pub measure_field_y: String,
    pub domain_x: DensityDomainV1,
    pub domain_y: DensityDomainV1,
    pub counts: DensityObservationCountsV1,
    pub grid: Vec<DensityGridCellV1>,
    pub bins_x: u32,
    pub bins_y: u32,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DensityAnalyticalParametersV1 {
    binning: String,
    interval: String,
    excluded_policy: String,
    constant_domain: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DistributionAnalyticalParametersV1 {
    histogram: DistributionHistogramMethodParametersV1,
    ecdf: DistributionEcdfMethodParametersV1,
    quantiles: DistributionQuantileMethodParametersV1,
    excluded_policy: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DistributionHistogramMethodParametersV1 {
    binning: String,
    interval: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DistributionEcdfMethodParametersV1 {
    selection: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DistributionQuantileMethodParametersV1 {
    interpolation: String,
    probabilities: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RepresentationPayloadV1 {
    AggregateVolume(AggregateVolumePayloadV1),
    EmpiricalDistribution(EmpiricalDistributionPayloadV1),
    BinnedDensity(BinnedDensityPayloadV1),
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

fn validate_distribution_information_contract(
    contract: &InformationContractV1,
) -> Result<(), String> {
    let expected_preserves = vec![InformationTypeV1::EmpiricalDistributionShape];
    let expected_loses = vec![
        InformationTypeV1::IndividualObservationIdentity,
        InformationTypeV1::ExactMetricValues,
        InformationTypeV1::PopulationDensityDistribution,
        InformationTypeV1::OutlierBoundaryVisibility,
    ];
    if contract.preserves != expected_preserves || contract.loses != expected_loses {
        return Err(
            "EMPIRICAL_DISTRIBUTION informationContract must match the reviewed candidate ontology"
                .to_string(),
        );
    }
    Ok(())
}

pub fn validate_distribution_request_contract(
    request: &DistributionEmbodimentRequestV1,
) -> Result<(), String> {
    if request.schema_version != SEMANTIC_EMBODIMENT_SCHEMA_VERSION {
        return Err(format!(
            "unsupported distribution request schemaVersion {}",
            request.schema_version
        ));
    }
    if request.candidate_id != SemanticRepresentationIdV1::DistributionField {
        return Err("distribution request requires candidateId=DISTRIBUTION_FIELD".to_string());
    }
    validate_short_text(&request.measure_field, "distribution measureField")?;
    if request.measure_field.trim() != request.measure_field {
        return Err("distribution measureField must not contain surrounding whitespace".to_string());
    }
    if request.histogram_bin_count == 0
        || request.histogram_bin_count > MAX_DISTRIBUTION_BINS_V1
    {
        return Err(format!(
            "histogramBinCount must be in 1..={MAX_DISTRIBUTION_BINS_V1}"
        ));
    }
    if request.ecdf_knot_count < 2
        || request.ecdf_knot_count > MAX_DISTRIBUTION_ECDF_KNOTS_V1
    {
        return Err(format!(
            "ecdfKnotCount must be in 2..={MAX_DISTRIBUTION_ECDF_KNOTS_V1}"
        ));
    }
    if request.quantile_probabilities.is_empty()
        || request.quantile_probabilities.len() > MAX_DISTRIBUTION_QUANTILES_V1 as usize
    {
        return Err(format!(
            "quantileProbabilities must contain 1..={MAX_DISTRIBUTION_QUANTILES_V1} values"
        ));
    }
    let mut previous = None;
    for probability in &request.quantile_probabilities {
        if !probability.is_finite() || !(0.0..=1.0).contains(probability) {
            return Err("quantile probabilities must be finite values in [0, 1]".to_string());
        }
        if previous.is_some_and(|value| *probability <= value) {
            return Err("quantile probabilities must be strictly increasing".to_string());
        }
        previous = Some(*probability);
    }
    if let Some(decision_id) = &request.decision_id {
        validate_short_text(decision_id, "distribution decisionId")?;
    }
    if let Some(model_version) = &request.decision_model_version {
        validate_short_text(model_version, "distribution decisionModelVersion")?;
    }
    if let Some(hash) = &request.decision_model_artifact_hash {
        if !is_lower_hex_64(hash) {
            return Err(
                "distribution decisionModelArtifactHash must be 64 lowercase hexadecimal characters"
                    .to_string(),
            );
        }
    }
    Ok(())
}

fn validate_density_information_contract(contract: &InformationContractV1) -> Result<(), String> {
    let expected_preserves = vec![InformationTypeV1::EmpiricalBivariateBinMass];
    let expected_loses = vec![
        InformationTypeV1::IndividualObservationIdentity,
        InformationTypeV1::ExactMetricValues,
        InformationTypeV1::PopulationDensityDistribution,
        InformationTypeV1::EmpiricalDistributionShape,
        InformationTypeV1::OutlierBoundaryVisibility,
    ];
    if contract.preserves != expected_preserves || contract.loses != expected_loses {
        return Err(
            "BINNED_DENSITY informationContract must match the reviewed candidate ontology".to_string(),
        );
    }
    Ok(())
}

pub fn validate_density_request_contract(
    request: &DensityEmbodimentRequestV1,
) -> Result<(), String> {
    if request.schema_version != SEMANTIC_EMBODIMENT_SCHEMA_VERSION {
        return Err(format!(
            "unsupported density request schemaVersion {}",
            request.schema_version
        ));
    }
    if request.candidate_id != SemanticRepresentationIdV1::DensityField {
        return Err("density request requires candidateId=DENSITY_FIELD".to_string());
    }
    validate_short_text(&request.measure_field_x, "density measureFieldX")?;
    validate_short_text(&request.measure_field_y, "density measureFieldY")?;
    if request.measure_field_x.trim() != request.measure_field_x {
        return Err("density measureFieldX must not contain surrounding whitespace".to_string());
    }
    if request.measure_field_y.trim() != request.measure_field_y {
        return Err("density measureFieldY must not contain surrounding whitespace".to_string());
    }
    if request.measure_field_x == request.measure_field_y {
        return Err("density measureFieldX and measureFieldY must be distinct".to_string());
    }
    if request.bins_x == 0 || request.bins_x > MAX_DENSITY_BINS_X_V1 {
        return Err(format!("binsX must be in 1..={MAX_DENSITY_BINS_X_V1}"));
    }
    if request.bins_y == 0 || request.bins_y > MAX_DENSITY_BINS_Y_V1 {
        return Err(format!("binsY must be in 1..={MAX_DENSITY_BINS_Y_V1}"));
    }
    if let Some(decision_id) = &request.decision_id {
        validate_short_text(decision_id, "density decisionId")?;
    }
    if let Some(model_version) = &request.decision_model_version {
        validate_short_text(model_version, "density decisionModelVersion")?;
    }
    if let Some(hash) = &request.decision_model_artifact_hash {
        if !is_lower_hex_64(hash) {
            return Err(
                "density decisionModelArtifactHash must be 64 lowercase hexadecimal characters"
                    .to_string(),
            );
        }
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

fn stable_linear_position(lower: f64, upper: f64, fraction: f64) -> f64 {
    if fraction <= 0.0 {
        lower
    } else if fraction >= 1.0 {
        upper
    } else {
        lower * (1.0 - fraction) + upper * fraction
    }
}

fn distribution_boundary_matches(actual: f64, expected: f64) -> bool {
    if actual == expected {
        return true;
    }
    let delta = (actual - expected).abs();
    if !delta.is_finite() {
        return false;
    }
    let local_scale = actual.abs().max(expected.abs()).max(1.0);
    delta <= f64::EPSILON * local_scale * 32.0
}

fn validate_empirical_distribution_payload(
    candidate_id: SemanticRepresentationIdV1,
    representation_family: SemanticEmbodimentFamilyV1,
    analytical_method: &AnalyticalMethodV1,
    information_contract: &InformationContractV1,
    approximation: &ApproximationV1,
    resource: &ResourceEnvelopeV1,
    payload: &EmpiricalDistributionPayloadV1,
) -> Result<(), String> {
    if candidate_id != SemanticRepresentationIdV1::DistributionField
        || representation_family != SemanticEmbodimentFamilyV1::Distribution
    {
        return Err(
            "EMPIRICAL_DISTRIBUTION payload requires candidateId=DISTRIBUTION_FIELD and representationFamily=DISTRIBUTION"
                .to_string(),
        );
    }
    validate_distribution_information_contract(information_contract)?;
    let method_name = analytical_method.name.to_ascii_lowercase();
    if method_name != EMPIRICAL_DISTRIBUTION_METHOD_NAME_V1 {
        return Err(
            "empirical distribution analyticalMethod.name must identify the reviewed univariate empirical method"
                .to_string(),
        );
    }
    let method_parameters: DistributionAnalyticalParametersV1 =
        serde_json::from_value(analytical_method.parameters.clone())
            .map_err(|error| format!("invalid empirical distribution method parameters: {error}"))?;
    if method_parameters.histogram.binning != "equal-width"
        || method_parameters.histogram.interval != "left-closed-right-open-final-closed"
        || method_parameters.ecdf.selection != "deterministic-rank-knots"
        || method_parameters.quantiles.interpolation != "linear-r7"
        || method_parameters.excluded_policy != "canonical-invalid-exclude-and-count"
    {
        return Err(
            "empirical distribution method parameters must match the reviewed V1 policies"
                .to_string(),
        );
    }
    if approximation.mode != ApproximationModeV1::Binned {
        return Err("EMPIRICAL_DISTRIBUTION approximation mode must be BINNED".to_string());
    }
    validate_short_text(&payload.measure_field, "distribution measureField")?;
    if payload.measure_field.trim() != payload.measure_field {
        return Err("distribution measureField must not contain surrounding whitespace".to_string());
    }
    if !payload.domain.min.is_finite()
        || !payload.domain.max.is_finite()
        || payload.domain.min > payload.domain.max
    {
        return Err("distribution domain must contain ordered finite min/max values".to_string());
    }

    let counts = &payload.counts;
    let classified_count = counts
        .valid_count
        .checked_add(counts.excluded_count)
        .ok_or_else(|| "distribution observation count overflow".to_string())?;
    if classified_count != counts.source_count {
        return Err(
            "distribution valid/excluded counts must sum to sourceCount".to_string(),
        );
    }
    if counts.source_count != resource.source_row_count {
        return Err("distribution counts.sourceCount must equal resource.sourceRowCount".to_string());
    }
    if counts.valid_count == 0 {
        return Err("READY empirical distribution requires at least one valid observation".to_string());
    }
    if approximation.represented_row_count != counts.valid_count {
        return Err(
            "distribution representedRowCount must equal counts.validCount".to_string(),
        );
    }

    if payload.histogram.is_empty()
        || payload.histogram.len() > MAX_DISTRIBUTION_BINS_V1 as usize
    {
        return Err(format!(
            "distribution histogram must contain 1..={MAX_DISTRIBUTION_BINS_V1} bins"
        ));
    }
    if payload.ecdf.is_empty()
        || payload.ecdf.len() > MAX_DISTRIBUTION_ECDF_KNOTS_V1 as usize
    {
        return Err(format!(
            "distribution ECDF must contain 1..={MAX_DISTRIBUTION_ECDF_KNOTS_V1} knots"
        ));
    }
    if payload.quantiles.is_empty()
        || payload.quantiles.len() > MAX_DISTRIBUTION_QUANTILES_V1 as usize
    {
        return Err(format!(
            "distribution quantiles must contain 1..={MAX_DISTRIBUTION_QUANTILES_V1} values"
        ));
    }

    let element_count = payload
        .histogram
        .len()
        .checked_add(payload.ecdf.len())
        .and_then(|value| value.checked_add(payload.quantiles.len()))
        .ok_or_else(|| "distribution element count overflow".to_string())?;
    if resource.max_element_count != MAX_DISTRIBUTION_ELEMENTS_V1 {
        return Err(format!(
            "EMPIRICAL_DISTRIBUTION maxElementCount must equal contract bound {MAX_DISTRIBUTION_ELEMENTS_V1}"
        ));
    }
    if resource.element_count as usize != element_count {
        return Err(
            "resource.elementCount must equal histogram + ECDF + quantile element count"
                .to_string(),
        );
    }

    let mut semantic_ids = HashSet::new();
    let constant_domain = payload.domain.min == payload.domain.max;
    if constant_domain && payload.histogram.len() != 1 {
        return Err("constant distribution domain must use exactly one histogram bin".to_string());
    }
    let mut histogram_count = 0u64;
    let mut previous_upper = None;
    let bin_count = payload.histogram.len();
    for (index, bin) in payload.histogram.iter().enumerate() {
        validate_short_text(&bin.semantic_id, "distribution histogram semanticId")?;
        if !semantic_ids.insert(bin.semantic_id.clone()) {
            return Err("distribution semanticId values must be unique".to_string());
        }
        if !bin.lower_bound.is_finite()
            || !bin.upper_bound.is_finite()
            || bin.lower_bound > bin.upper_bound
        {
            return Err("distribution histogram bounds must be ordered and finite".to_string());
        }
        if !constant_domain && bin.lower_bound >= bin.upper_bound {
            return Err("non-constant histogram bins must have positive width".to_string());
        }
        if index == 0 && bin.lower_bound != payload.domain.min {
            return Err("first histogram bin must begin at the distribution domain minimum".to_string());
        }
        if previous_upper.is_some_and(|upper| bin.lower_bound != upper) {
            return Err("distribution histogram bins must be contiguous".to_string());
        }
        let final_bin = index + 1 == bin_count;
        if !constant_domain {
            let expected_lower = stable_linear_position(
                payload.domain.min,
                payload.domain.max,
                index as f64 / bin_count as f64,
            );
            let expected_upper = if final_bin {
                payload.domain.max
            } else {
                stable_linear_position(
                    payload.domain.min,
                    payload.domain.max,
                    (index + 1) as f64 / bin_count as f64,
                )
            };
            if !distribution_boundary_matches(bin.lower_bound, expected_lower)
                || !distribution_boundary_matches(bin.upper_bound, expected_upper)
            {
                return Err("distribution histogram bins must be equal-width".to_string());
            }
        }
        if bin.upper_inclusive != final_bin {
            return Err(
                "only the final distribution histogram bin may be upper-inclusive".to_string(),
            );
        }
        if final_bin && bin.upper_bound != payload.domain.max {
            return Err("final histogram bin must end at the distribution domain maximum".to_string());
        }
        histogram_count = histogram_count
            .checked_add(bin.count)
            .ok_or_else(|| "distribution histogram count overflow".to_string())?;
        previous_upper = Some(bin.upper_bound);
    }
    if histogram_count != counts.valid_count {
        return Err("distribution histogram counts must sum to validCount".to_string());
    }

    let mut previous_value = None;
    let mut previous_count = 0u64;
    for knot in &payload.ecdf {
        validate_short_text(&knot.semantic_id, "distribution ECDF semanticId")?;
        if !semantic_ids.insert(knot.semantic_id.clone()) {
            return Err("distribution semanticId values must be unique".to_string());
        }
        if !knot.value.is_finite()
            || knot.value < payload.domain.min
            || knot.value > payload.domain.max
        {
            return Err("distribution ECDF values must be finite and inside the domain".to_string());
        }
        if previous_value.is_some_and(|value| knot.value < value) {
            return Err("distribution ECDF values must be monotone".to_string());
        }
        if knot.cumulative_count <= previous_count || knot.cumulative_count > counts.valid_count {
            return Err("distribution ECDF cumulativeCount must increase within validCount".to_string());
        }
        if !knot.cumulative_probability.is_finite()
            || knot.cumulative_probability <= 0.0
            || knot.cumulative_probability > 1.0
        {
            return Err("distribution ECDF cumulativeProbability must be in (0, 1]".to_string());
        }
        let expected_probability = knot.cumulative_count as f64 / counts.valid_count as f64;
        if (knot.cumulative_probability - expected_probability).abs() > 1e-12 {
            return Err(
                "distribution ECDF probability must equal cumulativeCount / validCount"
                    .to_string(),
            );
        }
        previous_value = Some(knot.value);
        previous_count = knot.cumulative_count;
    }
    let final_knot = payload.ecdf.last().expect("ECDF was checked non-empty");
    if final_knot.cumulative_count != counts.valid_count
        || (final_knot.cumulative_probability - 1.0).abs() > 1e-12
    {
        return Err("distribution ECDF must terminate at validCount and probability 1".to_string());
    }

    let mut previous_probability = None;
    let mut previous_quantile_value = None;
    if method_parameters.quantiles.probabilities.len() != payload.quantiles.len() {
        return Err(
            "distribution method quantile probabilities must match payload quantiles"
                .to_string(),
        );
    }
    for (quantile, requested_probability) in payload
        .quantiles
        .iter()
        .zip(&method_parameters.quantiles.probabilities)
    {
        validate_short_text(&quantile.semantic_id, "distribution quantile semanticId")?;
        if !semantic_ids.insert(quantile.semantic_id.clone()) {
            return Err("distribution semanticId values must be unique".to_string());
        }
        if !quantile.probability.is_finite()
            || !(0.0..=1.0).contains(&quantile.probability)
        {
            return Err("distribution quantile probabilities must be finite values in [0, 1]".to_string());
        }
        if previous_probability.is_some_and(|value| quantile.probability <= value) {
            return Err("distribution quantile probabilities must be strictly increasing".to_string());
        }
        if quantile.probability != *requested_probability {
            return Err(
                "distribution method quantile probabilities must match payload quantiles"
                    .to_string(),
            );
        }
        if !quantile.value.is_finite()
            || quantile.value < payload.domain.min
            || quantile.value > payload.domain.max
        {
            return Err("distribution quantile values must be finite and inside the domain".to_string());
        }
        if previous_quantile_value.is_some_and(|value| quantile.value < value) {
            return Err("distribution quantile values must be monotone".to_string());
        }
        previous_probability = Some(quantile.probability);
        previous_quantile_value = Some(quantile.value);
    }

    Ok(())
}

fn validate_binned_density_payload(
    candidate_id: SemanticRepresentationIdV1,
    representation_family: SemanticEmbodimentFamilyV1,
    analytical_method: &AnalyticalMethodV1,
    information_contract: &InformationContractV1,
    approximation: &ApproximationV1,
    resource: &ResourceEnvelopeV1,
    payload: &mut BinnedDensityPayloadV1,
) -> Result<(), String> {
    if candidate_id != SemanticRepresentationIdV1::DensityField
        || representation_family != SemanticEmbodimentFamilyV1::Density
    {
        return Err(
            "BINNED_DENSITY payload requires candidateId=DENSITY_FIELD and representationFamily=DENSITY"
                .to_string(),
        );
    }
    validate_density_information_contract(information_contract)?;
    if analytical_method.name != BINNED_DENSITY_METHOD_NAME_V1 {
        return Err(
            "binned density analyticalMethod.name must exactly identify the reviewed bivariate binned method"
                .to_string(),
        );
    }
    if analytical_method.version != BINNED_DENSITY_METHOD_VERSION_V1 {
        return Err(format!(
            "binned density analyticalMethod.version must equal {BINNED_DENSITY_METHOD_VERSION_V1}"
        ));
    }
    let method_parameters: DensityAnalyticalParametersV1 =
        serde_json::from_value(analytical_method.parameters.clone())
            .map_err(|error| format!("invalid binned density method parameters: {error}"))?;
    if method_parameters.binning != "equal-width"
        || method_parameters.interval != "left-closed-right-open-final-closed"
        || method_parameters.excluded_policy != "canonical-invalid-exclude-and-count"
        || method_parameters.constant_domain != BINNED_DENSITY_CONSTANT_DOMAIN_POLICY_V1
    {
        return Err(
            "binned density method parameters must match the reviewed V1 policies".to_string(),
        );
    }
    if approximation.mode != ApproximationModeV1::Binned {
        return Err("BINNED_DENSITY approximation mode must be BINNED".to_string());
    }
    validate_short_text(&payload.measure_field_x, "density measureFieldX")?;
    validate_short_text(&payload.measure_field_y, "density measureFieldY")?;
    if payload.measure_field_x.trim() != payload.measure_field_x
        || payload.measure_field_y.trim() != payload.measure_field_y
    {
        return Err("density measure fields must not contain surrounding whitespace".to_string());
    }
    if payload.measure_field_x == payload.measure_field_y {
        return Err("density measure fields must be distinct".to_string());
    }
    if payload.bins_x == 0
        || payload.bins_x > MAX_DENSITY_BINS_X_V1
        || payload.bins_y == 0
        || payload.bins_y > MAX_DENSITY_BINS_Y_V1
    {
        return Err(format!(
            "density bins must be in 1..={MAX_DENSITY_BINS_X_V1} x 1..={MAX_DENSITY_BINS_Y_V1}"
        ));
    }
    if !payload.domain_x.min.is_finite()
        || !payload.domain_x.max.is_finite()
        || !payload.domain_y.min.is_finite()
        || !payload.domain_y.max.is_finite()
        || payload.domain_x.min > payload.domain_x.max
        || payload.domain_y.min > payload.domain_y.max
    {
        return Err("density domains must contain ordered finite min/max values".to_string());
    }
    let counts = &payload.counts;
    let classified = counts
        .valid_count
        .checked_add(counts.excluded_count)
        .ok_or_else(|| "density observation count overflow".to_string())?;
    if classified != counts.source_count {
        return Err("density valid/excluded counts must sum to sourceCount".to_string());
    }
    if counts.source_count != resource.source_row_count {
        return Err("density counts.sourceCount must equal resource.sourceRowCount".to_string());
    }
    if counts.valid_count == 0 {
        return Err("READY binned density requires at least one valid observation".to_string());
    }
    if approximation.represented_row_count != counts.valid_count {
        return Err("density representedRowCount must equal counts.validCount".to_string());
    }
    let expected_cells = (payload.bins_x as usize)
        .checked_mul(payload.bins_y as usize)
        .ok_or_else(|| "density grid size overflow".to_string())?;
    if payload.grid.len() != expected_cells {
        return Err(format!(
            "density grid must contain binsX*binsY={expected_cells} cells"
        ));
    }
    if expected_cells as u32 > MAX_DENSITY_CELLS_V1 {
        return Err(format!(
            "density grid exceeds hard V1 bound {MAX_DENSITY_CELLS_V1}"
        ));
    }
    if resource.max_element_count != MAX_DENSITY_CELLS_V1 {
        return Err(format!(
            "BINNED_DENSITY maxElementCount must equal contract bound {MAX_DENSITY_CELLS_V1}"
        ));
    }
    if resource.element_count as usize != expected_cells {
        return Err("resource.elementCount must equal density grid cell count".to_string());
    }

    let x_constant = payload.domain_x.min == payload.domain_x.max;
    let y_constant = payload.domain_y.min == payload.domain_y.max;
    let mut semantic_ids = HashSet::new();
    let mut coordinates = HashSet::new();
    let mut total_count = 0u64;
    for cell in &payload.grid {
        validate_short_text(&cell.semantic_id, "density cell semanticId")?;
        if !semantic_ids.insert(cell.semantic_id.clone()) {
            return Err("density semanticId values must be unique".to_string());
        }
        if cell.x_index >= payload.bins_x || cell.y_index >= payload.bins_y {
            return Err("density cell indices out of bounds".to_string());
        }
        if !coordinates.insert((cell.x_index, cell.y_index)) {
            return Err("density grid coordinate pairs must be unique".to_string());
        }
        if !cell.x_lower_bound.is_finite()
            || !cell.x_upper_bound.is_finite()
            || !cell.y_lower_bound.is_finite()
            || !cell.y_upper_bound.is_finite()
        {
            return Err("density cell bounds must be finite".to_string());
        }
        let expected_x_lower = stable_linear_position(
            payload.domain_x.min,
            payload.domain_x.max,
            cell.x_index as f64 / payload.bins_x as f64,
        );
        let expected_x_upper = if cell.x_index + 1 == payload.bins_x {
            payload.domain_x.max
        } else {
            stable_linear_position(
                payload.domain_x.min,
                payload.domain_x.max,
                (cell.x_index + 1) as f64 / payload.bins_x as f64,
            )
        };
        let expected_y_lower = stable_linear_position(
            payload.domain_y.min,
            payload.domain_y.max,
            cell.y_index as f64 / payload.bins_y as f64,
        );
        let expected_y_upper = if cell.y_index + 1 == payload.bins_y {
            payload.domain_y.max
        } else {
            stable_linear_position(
                payload.domain_y.min,
                payload.domain_y.max,
                (cell.y_index + 1) as f64 / payload.bins_y as f64,
            )
        };
        if !distribution_boundary_matches(cell.x_lower_bound, expected_x_lower)
            || !distribution_boundary_matches(cell.x_upper_bound, expected_x_upper)
            || !distribution_boundary_matches(cell.y_lower_bound, expected_y_lower)
            || !distribution_boundary_matches(cell.y_upper_bound, expected_y_upper)
        {
            return Err("density grid cells must be equal-width".to_string());
        }
        let x_final = cell.x_index + 1 == payload.bins_x;
        let y_final = cell.y_index + 1 == payload.bins_y;
        if cell.x_upper_inclusive != x_final || cell.y_upper_inclusive != y_final {
            return Err(
                "only final density bins may be upper-inclusive in each dimension".to_string(),
            );
        }
        if x_constant && !x_final && cell.count != 0 {
            return Err(
                "constant density X domains may carry mass only in the final X bin".to_string(),
            );
        }
        if y_constant && !y_final && cell.count != 0 {
            return Err(
                "constant density Y domains may carry mass only in the final Y bin".to_string(),
            );
        }
        total_count = total_count
            .checked_add(cell.count)
            .ok_or_else(|| "density grid count overflow".to_string())?;
    }
    for x_index in 0..payload.bins_x {
        for y_index in 0..payload.bins_y {
            if !coordinates.contains(&(x_index, y_index)) {
                return Err(
                    "density grid must cover every xIndex/yIndex pair exactly once".to_string(),
                );
            }
        }
    }
    if total_count != counts.valid_count {
        return Err("density grid counts must sum to validCount".to_string());
    }
    payload.grid.sort_by(|left, right| {
        left.x_index
            .cmp(&right.x_index)
            .then(left.y_index.cmp(&right.y_index))
    });
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
            RepresentationPayloadV1::EmpiricalDistribution(distribution) => {
                validate_empirical_distribution_payload(
                    candidate_id,
                    representation_family,
                    &envelope.analytical_method,
                    information_contract,
                    approximation,
                    resource,
                    distribution,
                )?;
            }
            RepresentationPayloadV1::BinnedDensity(density) => {
                validate_binned_density_payload(
                    candidate_id,
                    representation_family,
                    &envelope.analytical_method,
                    information_contract,
                    approximation,
                    resource,
                    density,
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

/// A1 semantic detail contract boundary probe. It intentionally performs no analytical work.
/// Rust owns parsing, strict validation, normalization and serialization of the
/// versioned detail request/result contract.
#[wasm_bindgen]
pub fn moneta_semantic_detail_v1_roundtrip(
    in_ptr: u32,
    in_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(bytes) = copy_host_input(in_ptr, in_len) else {
        return 0;
    };
    let mut envelope: super::drill_down::SemanticDetailEnvelopeV1 = match serde_json::from_slice(&bytes) {
        Ok(value) => value,
        Err(error) => {
            crate::log_error(&format!(
                "moneta_semantic_detail_v1_roundtrip parse failed: {error}"
            ));
            return 0;
        }
    };
    if let Err(error) = super::drill_down::validate_detail_envelope(&mut envelope) {
        crate::log_error(&format!(
            "moneta_semantic_detail_v1_roundtrip validation failed: {error}"
        ));
        return 0;
    }
    let json = match serde_json::to_vec(&envelope) {
        Ok(value) => value,
        Err(error) => {
            crate::log_error(&format!(
                "moneta_semantic_detail_v1_roundtrip serialization failed: {error}"
            ));
            return 0;
        }
    };
    crate::write_bytes_out(&json, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn moneta_query_semantic_detail_v1(
    dataset_handle: u32,
    in_ptr: u32,
    in_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(bytes) = copy_host_input(in_ptr, in_len) else {
        return 0;
    };
    let query: super::drill_down::SemanticDetailQueryV1 = match serde_json::from_slice(&bytes) {
        Ok(value) => value,
        Err(error) => {
            crate::log_error(&format!(
                "moneta_query_semantic_detail_v1 query parse failed: {error}"
            ));
            return 0;
        }
    };

    let result_envelope = super::drill_down::query_semantic_detail_v1(
        dataset_handle,
        query,
    );

    let json = match serde_json::to_vec(&result_envelope) {
        Ok(value) => value,
        Err(error) => {
            crate::log_error(&format!(
                "moneta_query_semantic_detail_v1 serialization failed: {error}"
            ));
            return 0;
        }
    };
    crate::write_bytes_out(&json, out_ptr, out_len)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn distribution_request() -> DistributionEmbodimentRequestV1 {
        DistributionEmbodimentRequestV1 {
            schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
            candidate_id: SemanticRepresentationIdV1::DistributionField,
            measure_field: "value".to_string(),
            histogram_bin_count: 2,
            ecdf_knot_count: 4,
            quantile_probabilities: vec![0.0, 0.5, 1.0],
            decision_id: Some("decision_distribution_fixture".to_string()),
            decision_model_version: None,
            decision_model_artifact_hash: None,
        }
    }

    fn distribution_fixture() -> SemanticEmbodimentEnvelopeV1 {
        SemanticEmbodimentEnvelopeV1 {
            schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
            dataset_fingerprint: "d".repeat(64),
            candidate_id: SemanticRepresentationIdV1::DistributionField,
            representation_family: SemanticEmbodimentFamilyV1::Distribution,
            analytical_method: AnalyticalMethodV1 {
                name: "univariate-empirical-distribution".to_string(),
                version: "empirical-distribution-contract-v1".to_string(),
                parameters: serde_json::json!({
                    "histogram": { "binning": "equal-width", "interval": "left-closed-right-open-final-closed" },
                    "ecdf": { "selection": "deterministic-rank-knots" },
                    "quantiles": { "interpolation": "linear-r7", "probabilities": [0.0, 0.5, 1.0] },
                    "excludedPolicy": "canonical-invalid-exclude-and-count"
                }),
            },
            approximation: ApproximationV1 {
                mode: ApproximationModeV1::Binned,
                represented_row_count: 4,
                description: Some(
                    "Equal-width histogram with bounded ECDF knots and explicit quantiles"
                        .to_string(),
                ),
            },
            information_contract: InformationContractV1 {
                preserves: vec![InformationTypeV1::EmpiricalDistributionShape],
                loses: vec![
                    InformationTypeV1::IndividualObservationIdentity,
                    InformationTypeV1::ExactMetricValues,
                    InformationTypeV1::PopulationDensityDistribution,
                    InformationTypeV1::OutlierBoundaryVisibility,
                ],
            },
            resource: ResourceEnvelopeV1 {
                source_row_count: 7,
                element_count: 9,
                max_element_count: MAX_DISTRIBUTION_ELEMENTS_V1,
            },
            provenance: SemanticPayloadProvenanceV1 {
                kernel_version: "0.1.0".to_string(),
                algorithm_version: "empirical-distribution-contract-v1".to_string(),
                decision_id: Some("decision_distribution_fixture".to_string()),
                decision_model_version: None,
                decision_model_artifact_hash: None,
            },
            result: SemanticEmbodimentResultV1::Ready {
                payload: RepresentationPayloadV1::EmpiricalDistribution(
                    EmpiricalDistributionPayloadV1 {
                        measure_field: "value".to_string(),
                        domain: DistributionDomainV1 { min: 1.0, max: 4.0 },
                        counts: DistributionObservationCountsV1 {
                            source_count: 7,
                            valid_count: 4,
                            excluded_count: 3,
                        },
                        histogram: vec![
                            DistributionHistogramBinV1 {
                                semantic_id: "distribution-bin:000".to_string(),
                                lower_bound: 1.0,
                                upper_bound: 2.5,
                                count: 2,
                                upper_inclusive: false,
                            },
                            DistributionHistogramBinV1 {
                                semantic_id: "distribution-bin:001".to_string(),
                                lower_bound: 2.5,
                                upper_bound: 4.0,
                                count: 2,
                                upper_inclusive: true,
                            },
                        ],
                        ecdf: vec![
                            DistributionEcdfKnotV1 { semantic_id: "distribution-ecdf:000".to_string(), value: 1.0, cumulative_count: 1, cumulative_probability: 0.25 },
                            DistributionEcdfKnotV1 { semantic_id: "distribution-ecdf:001".to_string(), value: 2.0, cumulative_count: 2, cumulative_probability: 0.5 },
                            DistributionEcdfKnotV1 { semantic_id: "distribution-ecdf:002".to_string(), value: 3.0, cumulative_count: 3, cumulative_probability: 0.75 },
                            DistributionEcdfKnotV1 { semantic_id: "distribution-ecdf:003".to_string(), value: 4.0, cumulative_count: 4, cumulative_probability: 1.0 },
                        ],
                        quantiles: vec![
                            DistributionQuantileV1 { semantic_id: "distribution-quantile:000".to_string(), probability: 0.0, value: 1.0 },
                            DistributionQuantileV1 { semantic_id: "distribution-quantile:500".to_string(), probability: 0.5, value: 2.5 },
                            DistributionQuantileV1 { semantic_id: "distribution-quantile:1000".to_string(), probability: 1.0, value: 4.0 },
                        ],
                    },
                ),
            },
        }
    }

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
        let RepresentationPayloadV1::AggregateVolume(payload) = payload else {
            panic!("expected aggregate payload");
        };
        assert_eq!(payload.groups[0].semantic_id, "group:a");
        assert_eq!(payload.groups[1].semantic_id, "group:b");
    }

    #[test]
    fn distribution_request_requires_explicit_bounded_ordered_parameters() {
        validate_distribution_request_contract(&distribution_request())
            .expect("valid distribution request");

        let mut blank_measure = distribution_request();
        blank_measure.measure_field.clear();
        assert!(validate_distribution_request_contract(&blank_measure).is_err());

        let mut duplicate_quantile = distribution_request();
        duplicate_quantile.quantile_probabilities = vec![0.0, 0.5, 0.5];
        assert!(validate_distribution_request_contract(&duplicate_quantile).is_err());

        let mut too_many_bins = distribution_request();
        too_many_bins.histogram_bin_count = MAX_DISTRIBUTION_BINS_V1 + 1;
        assert!(validate_distribution_request_contract(&too_many_bins).is_err());
    }

    #[test]
    fn empirical_distribution_contract_is_distinct_bounded_and_count_truthful() {
        let mut envelope = distribution_fixture();
        validate_and_normalize(&mut envelope).expect("valid empirical distribution contract");
        assert_eq!(envelope.resource.max_element_count, MAX_DISTRIBUTION_ELEMENTS_V1);
        assert_eq!(envelope.approximation.represented_row_count, 4);
        assert_eq!(
            envelope.information_contract.preserves,
            vec![InformationTypeV1::EmpiricalDistributionShape]
        );
        assert!(envelope
            .information_contract
            .loses
            .contains(&InformationTypeV1::PopulationDensityDistribution));
        assert!(envelope
            .information_contract
            .loses
            .contains(&InformationTypeV1::OutlierBoundaryVisibility));
        let SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::EmpiricalDistribution(payload),
        } = envelope.result else {
            panic!("expected empirical distribution payload");
        };
        assert_eq!(payload.counts.source_count, 7);
        assert_eq!(payload.counts.valid_count, 4);
        assert_eq!(payload.histogram.iter().map(|bin| bin.count).sum::<u64>(), 4);
        assert_eq!(payload.ecdf.last().map(|knot| knot.cumulative_probability), Some(1.0));
    }

    #[test]
    fn empirical_distribution_contract_rejects_semantic_and_count_drift() {
        let mut density_claim = distribution_fixture();
        density_claim.analytical_method.name = "continuous-density-pdf".to_string();
        assert!(validate_and_normalize(&mut density_claim).is_err());

        let mut density_preservation_claim = distribution_fixture();
        density_preservation_claim.information_contract.preserves =
            vec![InformationTypeV1::PopulationDensityDistribution];
        assert!(validate_and_normalize(&mut density_preservation_claim).is_err());

        let mut wrong_counts = distribution_fixture();
        if let SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::EmpiricalDistribution(payload),
        } = &mut wrong_counts.result
        {
            payload.counts.excluded_count = 2;
        }
        assert!(validate_and_normalize(&mut wrong_counts).is_err());

        let mut duplicate_id = distribution_fixture();
        if let SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::EmpiricalDistribution(payload),
        } = &mut duplicate_id.result
        {
            payload.quantiles[0].semantic_id = payload.histogram[0].semantic_id.clone();
        }
        assert!(validate_and_normalize(&mut duplicate_id).is_err());

        let mut unequal_bins = distribution_fixture();
        if let SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::EmpiricalDistribution(payload),
        } = &mut unequal_bins.result
        {
            payload.histogram[0].upper_bound = 2.0;
            payload.histogram[1].lower_bound = 2.0;
        }
        assert!(validate_and_normalize(&mut unequal_bins).is_err());

        let mut quantile_policy_drift = distribution_fixture();
        quantile_policy_drift.analytical_method.parameters["quantiles"]["probabilities"] =
            serde_json::json!([0.0, 0.25, 1.0]);
        assert!(validate_and_normalize(&mut quantile_policy_drift).is_err());
    }

    #[test]
    fn extreme_finite_domain_equal_width_validation_fails_closed() {
        let mut envelope = distribution_fixture();
        if let SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::EmpiricalDistribution(payload),
        } = &mut envelope.result
        {
            payload.domain = DistributionDomainV1 {
                min: -f64::MAX,
                max: f64::MAX,
            };
            payload.histogram = vec![
                DistributionHistogramBinV1 {
                    semantic_id: "distribution-bin:000".to_string(),
                    lower_bound: -f64::MAX,
                    upper_bound: -1.0,
                    count: 2,
                    upper_inclusive: false,
                },
                DistributionHistogramBinV1 {
                    semantic_id: "distribution-bin:001".to_string(),
                    lower_bound: -1.0,
                    upper_bound: f64::MAX,
                    count: 2,
                    upper_inclusive: true,
                },
            ];
            payload.ecdf = vec![
                DistributionEcdfKnotV1 { semantic_id: "distribution-ecdf:000".to_string(), value: -f64::MAX, cumulative_count: 1, cumulative_probability: 0.25 },
                DistributionEcdfKnotV1 { semantic_id: "distribution-ecdf:001".to_string(), value: -1.0, cumulative_count: 2, cumulative_probability: 0.5 },
                DistributionEcdfKnotV1 { semantic_id: "distribution-ecdf:002".to_string(), value: 0.0, cumulative_count: 3, cumulative_probability: 0.75 },
                DistributionEcdfKnotV1 { semantic_id: "distribution-ecdf:003".to_string(), value: f64::MAX, cumulative_count: 4, cumulative_probability: 1.0 },
            ];
            payload.quantiles = vec![
                DistributionQuantileV1 { semantic_id: "distribution-quantile:000".to_string(), probability: 0.0, value: -f64::MAX },
                DistributionQuantileV1 { semantic_id: "distribution-quantile:500".to_string(), probability: 0.5, value: 0.0 },
                DistributionQuantileV1 { semantic_id: "distribution-quantile:1000".to_string(), probability: 1.0, value: f64::MAX },
            ];
        }
        assert!(validate_and_normalize(&mut envelope).is_err());
    }

    #[test]
    fn constant_distribution_domain_has_one_closed_occupied_bin() {
        let mut envelope = distribution_fixture();
        if let SemanticEmbodimentResultV1::Ready {
            payload: RepresentationPayloadV1::EmpiricalDistribution(payload),
        } = &mut envelope.result
        {
            payload.domain = DistributionDomainV1 { min: 2.0, max: 2.0 };
            payload.histogram = vec![DistributionHistogramBinV1 {
                semantic_id: "distribution-bin:constant".to_string(),
                lower_bound: 2.0,
                upper_bound: 2.0,
                count: 4,
                upper_inclusive: true,
            }];
            for knot in &mut payload.ecdf {
                knot.value = 2.0;
            }
            for quantile in &mut payload.quantiles {
                quantile.value = 2.0;
            }
            envelope.resource.element_count = 8;
        }
        validate_and_normalize(&mut envelope).expect("valid constant distribution contract");
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
