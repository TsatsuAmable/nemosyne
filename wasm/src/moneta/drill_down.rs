use serde::{Deserialize, Serialize};
use crate::moneta::embodiment::SemanticEmbodimentFamilyV1;
use crate::data::Dataset;
use crate::data::columnar::ColumnarDataset;

pub const SEMANTIC_DETAIL_SCHEMA_VERSION: u32 = 1;
pub const MAX_DETAIL_OBSERVATION_LIMIT_V1: u32 = 1000;
pub const MAX_CONTEXT_TEXT_BYTES: usize = 1024;
pub const MAX_SHORT_TEXT_BYTES: usize = 256;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SemanticTargetIdentityV1 {
    pub dataset_fingerprint: String,
    pub decision_id: String,
    pub representation_family: SemanticEmbodimentFamilyV1,
    pub semantic_object_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SemanticDetailRequestV1 {
    pub schema_version: u32,
    pub target: SemanticTargetIdentityV1,
    pub limit: u32,
    pub offset: u32,
    pub investigation_context: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SemanticDetailErrorCodeV1 {
    StaleGeneration,
    DeletedTarget,
    ChangedDataset,
    UnsupportedMembership,
    ResourceLimit,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SemanticDetailRefusalV1 {
    pub code: SemanticDetailErrorCodeV1,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SemanticDetailResultV1 {
    Ready {
        #[serde(rename = "totalMemberCount")]
        total_member_count: u32,
        #[serde(rename = "returnedCount")]
        returned_count: u32,
        #[serde(rename = "observationIds")]
        observation_ids: Vec<String>,
        #[serde(default, skip_serializing_if = "Option::is_none", rename = "compactViews")]
        compact_views: Option<Vec<serde_json::Value>>,
    },
    Refused {
        refusal: SemanticDetailRefusalV1,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SemanticDetailEnvelopeV1 {
    pub schema_version: u32,
    pub request: SemanticDetailRequestV1,
    pub result: SemanticDetailResultV1,
    pub generation: u32,
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

pub fn validate_detail_envelope(envelope: &mut SemanticDetailEnvelopeV1) -> Result<(), String> {
    if envelope.schema_version != SEMANTIC_DETAIL_SCHEMA_VERSION {
        return Err(format!(
            "unsupported envelope schemaVersion {}",
            envelope.schema_version
        ));
    }
    if envelope.request.schema_version != SEMANTIC_DETAIL_SCHEMA_VERSION {
        return Err(format!(
            "unsupported request schemaVersion {}",
            envelope.request.schema_version
        ));
    }
    if !is_lower_hex_64(&envelope.request.target.dataset_fingerprint) {
        return Err("request.target.datasetFingerprint must be exactly 64 lowercase hexadecimal characters".to_string());
    }

    validate_short_text(&envelope.request.target.decision_id, "request.target.decisionId")?;
    validate_short_text(&envelope.request.target.semantic_object_id, "request.target.semanticObjectId")?;

    if envelope.request.limit == 0 || envelope.request.limit > MAX_DETAIL_OBSERVATION_LIMIT_V1 {
        return Err(format!(
            "request.limit must be 1..={MAX_DETAIL_OBSERVATION_LIMIT_V1}"
        ));
    }
    if envelope.request.investigation_context.len() > MAX_CONTEXT_TEXT_BYTES {
        return Err(format!(
            "request.investigationContext exceeds {MAX_CONTEXT_TEXT_BYTES} UTF-8 bytes"
        ));
    }

    match &envelope.result {
        SemanticDetailResultV1::Ready {
            total_member_count,
            returned_count,
            observation_ids,
            compact_views,
        } => {
            if *returned_count != observation_ids.len() as u32 {
                return Err("result.returnedCount must match result.observationIds.len()".to_string());
            }
            if *returned_count > envelope.request.limit {
                return Err("result.returnedCount must not exceed request.limit".to_string());
            }
            if *total_member_count < *returned_count {
                return Err("result.totalMemberCount must be >= result.returnedCount".to_string());
            }
            for (idx, obs_id) in observation_ids.iter().enumerate() {
                validate_short_text(obs_id, &format!("result.observationIds[{}]", idx))?;
            }
            if let Some(views) = compact_views {
                if views.len() != *returned_count as usize {
                    return Err("result.compactViews.len() must match result.returnedCount".to_string());
                }
            }
        }
        SemanticDetailResultV1::Refused { refusal } => {
            if refusal.message.len() > MAX_CONTEXT_TEXT_BYTES {
                return Err(format!(
                    "result.refusal.message exceeds {MAX_CONTEXT_TEXT_BYTES} UTF-8 bytes"
                ));
            }
        }
    }

    Ok(())
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SemanticDetailQueryV1 {
    pub request: SemanticDetailRequestV1,
    pub embodiment_request: serde_json::Value,
    pub generation: u32,
}

pub fn query_semantic_detail_v1(
    dataset_handle: u32,
    query: SemanticDetailQueryV1,
) -> SemanticDetailEnvelopeV1 {
    // 1. Initial validation of the detail request:
    let mut temp_envelope = SemanticDetailEnvelopeV1 {
        schema_version: SEMANTIC_DETAIL_SCHEMA_VERSION,
        request: query.request.clone(),
        result: SemanticDetailResultV1::Ready {
            total_member_count: 0,
            returned_count: 0,
            observation_ids: vec![],
            compact_views: None,
        },
        generation: query.generation,
    };
    if let Err(error) = validate_detail_envelope(&mut temp_envelope) {
        return SemanticDetailEnvelopeV1 {
            schema_version: SEMANTIC_DETAIL_SCHEMA_VERSION,
            request: query.request,
            result: SemanticDetailResultV1::Refused {
                refusal: SemanticDetailRefusalV1 {
                    code: SemanticDetailErrorCodeV1::ResourceLimit,
                    message: format!("Request validation failed: {error}"),
                },
            },
            generation: query.generation,
        };
    }

    // 2. Fetch dataset and columnar dataset
    let res = crate::data::with_dataset_and_columnar(dataset_handle, |dataset, columnar| {
        // A. Fingerprint check:
        let active_fingerprint = dataset.fingerprint();
        if active_fingerprint != query.request.target.dataset_fingerprint {
            return SemanticDetailResultV1::Refused {
                refusal: SemanticDetailRefusalV1 {
                    code: SemanticDetailErrorCodeV1::ChangedDataset,
                    message: format!(
                        "Dataset fingerprint mismatch: expected {}, got {}",
                        query.request.target.dataset_fingerprint, active_fingerprint
                    ),
                },
            };
        }

        // B. Evaluate membership of observations based on family:
        let matched_indices_res = match query.request.target.representation_family {
            SemanticEmbodimentFamilyV1::Cluster => {
                evaluate_cluster_membership(dataset, columnar, &query.request, &query.embodiment_request)
            }
            SemanticEmbodimentFamilyV1::Aggregate => {
                evaluate_aggregate_membership(dataset, columnar, &query.request, &query.embodiment_request)
            }
            SemanticEmbodimentFamilyV1::Distribution => {
                evaluate_distribution_membership(dataset, columnar, &query.request, &query.embodiment_request)
            }
            SemanticEmbodimentFamilyV1::Density => {
                evaluate_density_membership(dataset, columnar, &query.request, &query.embodiment_request)
            }
            SemanticEmbodimentFamilyV1::Graph => {
                evaluate_graph_membership(dataset, &query.request, &query.embodiment_request)
            }
            _ => Err(SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::UnsupportedMembership,
                message: format!(
                    "Unsupported representation family: {:?}",
                    query.request.target.representation_family
                ),
            }),
        };

        let matched_indices = match matched_indices_res {
            Ok(indices) => indices,
            Err(refusal) => return SemanticDetailResultV1::Refused { refusal },
        };

        let total_member_count = matched_indices.len() as u32;

        // C. Enforce the un-paginated resource limit (1000 observations):
        if total_member_count > MAX_DETAIL_OBSERVATION_LIMIT_V1 {
            return SemanticDetailResultV1::Refused {
                refusal: SemanticDetailRefusalV1 {
                    code: SemanticDetailErrorCodeV1::ResourceLimit,
                    message: format!(
                        "Target matches {} observations, exceeding the maximum progressive disclosure limit of {}",
                        total_member_count, MAX_DETAIL_OBSERVATION_LIMIT_V1
                    ),
                },
            };
        }

        // D. Paginate:
        let offset = query.request.offset;
        let limit = query.request.limit;
        if offset >= total_member_count {
            return SemanticDetailResultV1::Ready {
                total_member_count,
                returned_count: 0,
                observation_ids: vec![],
                compact_views: Some(vec![]),
            };
        }

        let start = offset as usize;
        let end = (offset + limit).min(total_member_count) as usize;
        let page = &matched_indices[start..end];

        let mut observation_ids = Vec::new();
        let mut compact_views = Vec::new();

        for &row_idx in page {
            // Get observation ID:
            let obs_id = if row_idx < dataset.row_ids.len() {
                dataset.row_ids[row_idx].clone()
            } else {
                format!("row-{}", row_idx)
            };
            observation_ids.push(obs_id);

            // Construct compact view:
            let mut row_map = serde_json::Map::new();
            if row_idx < dataset.rows.len() {
                for (k, val) in &dataset.rows[row_idx] {
                    row_map.insert(k.clone(), val.to_js_json_value());
                }
            }
            compact_views.push(serde_json::Value::Object(row_map));
        }

        SemanticDetailResultV1::Ready {
            total_member_count,
            returned_count: observation_ids.len() as u32,
            observation_ids,
            compact_views: Some(compact_views),
        }
    });

    let result = match res {
        Some(val) => val,
        None => SemanticDetailResultV1::Refused {
            refusal: SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::StaleGeneration,
                message: format!("Dataset handle {} not found or stale", dataset_handle),
            },
        },
    };

    SemanticDetailEnvelopeV1 {
        schema_version: SEMANTIC_DETAIL_SCHEMA_VERSION,
        request: query.request,
        result,
        generation: query.generation,
    }
}

fn evaluate_cluster_membership(
    dataset: &Dataset,
    columnar: &ColumnarDataset,
    request: &SemanticDetailRequestV1,
    embodiment_request_json: &serde_json::Value,
) -> Result<Vec<usize>, SemanticDetailRefusalV1> {
    let embodiment_request: crate::moneta::cluster_embodiment::ClusterEmbodimentRequestV1 =
        serde_json::from_value(embodiment_request_json.clone()).map_err(|err| {
            SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::UnsupportedMembership,
                message: format!("Failed to parse ClusterEmbodimentRequestV1: {}", err),
            }
        })?;

    let partition_index = dataset.columns.iter().position(|col| col.name == embodiment_request.partition_field).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: format!("unknown cluster partitionField {}", embodiment_request.partition_field),
        }
    })?;

    let partition_column = columnar.categorical_column(partition_index).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: "cluster partitionField has no resident categorical column".to_string(),
        }
    })?;

    let mut matching_code = None;
    for (code, label) in partition_column.dictionary.iter().enumerate() {
        if label.is_empty() {
            continue;
        }
        let hash_id = semantic_region_id(&embodiment_request.partition_field, label);
        if hash_id == request.target.semantic_object_id {
            matching_code = Some(code);
            break;
        }
    }

    let target_code = matching_code.ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::DeletedTarget,
            message: format!("No cluster region matches semanticObjectId {}", request.target.semantic_object_id),
        }
    })?;

    let source_row_count = columnar.row_count();
    let mut matched = Vec::new();
    for row_idx in 0..source_row_count {
        if row_idx < partition_column.validity.len()
            && partition_column.validity[row_idx] != 0
            && row_idx < partition_column.codes.len()
            && partition_column.codes[row_idx] as usize == target_code
        {
            matched.push(row_idx);
        }
    }

    Ok(matched)
}

fn semantic_region_id(partition_field: &str, label: &str) -> String {
    let preimage = format!(
        "schema=1\0candidate=CLUSTER_REGIONS\0field={}:{}\0label={}:{}",
        partition_field.len(),
        partition_field,
        label.len(),
        label,
    );
    format!("cluster-region:{}", crate::data::fingerprint::sha256_hex(&preimage))
}

fn evaluate_aggregate_membership(
    dataset: &Dataset,
    columnar: &ColumnarDataset,
    request: &SemanticDetailRequestV1,
    embodiment_request_json: &serde_json::Value,
) -> Result<Vec<usize>, SemanticDetailRefusalV1> {
    let embodiment_request: crate::moneta::aggregate_embodiment::AggregateEmbodimentRequestV1 =
        serde_json::from_value(embodiment_request_json.clone()).map_err(|err| {
            SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::UnsupportedMembership,
                message: format!("Failed to parse AggregateEmbodimentRequestV1: {}", err),
            }
        })?;

    let grouping_index = dataset.columns.iter().position(|col| col.name == embodiment_request.grouping_field).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: format!("unknown groupingField {}", embodiment_request.grouping_field),
        }
    })?;

    let grouping_column = columnar.categorical_column(grouping_index).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: "groupingField has no resident categorical column".to_string(),
        }
    })?;

    let source_row_count = columnar.row_count();
    let mut matched = Vec::new();

    if request.target.semantic_object_id == "aggregate-group:missing" {
        for row_idx in 0..source_row_count {
            if row_idx < grouping_column.validity.len() && grouping_column.validity[row_idx] == 0 {
                matched.push(row_idx);
            }
        }
    } else if request.target.semantic_object_id.starts_with("aggregate-group:") {
        let index_str = &request.target.semantic_object_id["aggregate-group:".len()..];
        let index = index_str.parse::<usize>().map_err(|_| {
            SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::DeletedTarget,
                message: format!("Invalid aggregate-group index suffix: {}", index_str),
            }
        })?;

        if index >= grouping_column.dictionary.len() {
            return Err(SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::DeletedTarget,
                message: format!(
                    "Aggregate index {} out of bounds for grouping column (dictionary size: {})",
                    index, grouping_column.dictionary.len()
                ),
            });
        }

        for row_idx in 0..source_row_count {
            if row_idx < grouping_column.validity.len()
                && grouping_column.validity[row_idx] != 0
                && row_idx < grouping_column.codes.len()
                && grouping_column.codes[row_idx] as usize == index
            {
                matched.push(row_idx);
            }
        }
    } else {
        return Err(SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::DeletedTarget,
            message: format!("Invalid semanticObjectId {}", request.target.semantic_object_id),
        });
    }

    Ok(matched)
}

fn evaluate_distribution_membership(
    dataset: &Dataset,
    columnar: &ColumnarDataset,
    request: &SemanticDetailRequestV1,
    embodiment_request_json: &serde_json::Value,
) -> Result<Vec<usize>, SemanticDetailRefusalV1> {
    let embodiment_request: crate::moneta::embodiment::DistributionEmbodimentRequestV1 =
        serde_json::from_value(embodiment_request_json.clone()).map_err(|err| {
            SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::UnsupportedMembership,
                message: format!("Failed to parse DistributionEmbodimentRequestV1: {}", err),
            }
        })?;

    let measure_index = dataset.columns.iter().position(|col| col.name == embodiment_request.measure_field).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: format!("unknown measureField {}", embodiment_request.measure_field),
        }
    })?;

    let measure_column = columnar.primitive_column(measure_index).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: "measureField has no resident numeric column".to_string(),
        }
    })?;

    if !request.target.semantic_object_id.starts_with("distribution-bin:") {
        return Err(SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: format!(
                "semanticObjectId {} must start with distribution-bin:",
                request.target.semantic_object_id
            ),
        });
    }

    let index_str = &request.target.semantic_object_id["distribution-bin:".len()..];
    let bin_idx = index_str.parse::<usize>().map_err(|_| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::DeletedTarget,
            message: format!("Invalid distribution bin index: {}", index_str),
        }
    })?;

    let bin_count = embodiment_request.histogram_bin_count as usize;
    if bin_idx >= bin_count {
        return Err(SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::DeletedTarget,
            message: format!("Bin index {} out of bounds (count: {})", bin_idx, bin_count),
        });
    }

    let source_row_count = columnar.row_count();
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    let mut has_finite = false;

    for row_idx in 0..source_row_count {
        if row_idx < measure_column.validity.len()
            && measure_column.validity[row_idx] != 0
            && row_idx < measure_column.values.len()
        {
            let val = measure_column.values[row_idx];
            if val.is_finite() {
                min = min.min(val);
                max = max.max(val);
                has_finite = true;
            }
        }
    }

    if !has_finite {
        return Ok(vec![]);
    }

    let mut matched = Vec::new();

    if min == max {
        if bin_idx == 0 {
            for row_idx in 0..source_row_count {
                if row_idx < measure_column.validity.len()
                    && measure_column.validity[row_idx] != 0
                    && row_idx < measure_column.values.len()
                {
                    let val = measure_column.values[row_idx];
                    if val.is_finite() && val == min {
                        matched.push(row_idx);
                    }
                }
            }
        }
        return Ok(matched);
    }

    let lower_bound = stable_lerp(min, max, bin_idx as f64 / bin_count as f64);
    let final_bin = bin_idx + 1 == bin_count;
    let upper_bound = if final_bin {
        max
    } else {
        stable_lerp(min, max, (bin_idx + 1) as f64 / bin_count as f64)
    };

    for row_idx in 0..source_row_count {
        if row_idx < measure_column.validity.len()
            && measure_column.validity[row_idx] != 0
            && row_idx < measure_column.values.len()
        {
            let val = measure_column.values[row_idx];
            if val.is_finite() {
                let matches = if final_bin {
                    val >= lower_bound && val <= upper_bound
                } else {
                    val >= lower_bound && val < upper_bound
                };
                if matches {
                    matched.push(row_idx);
                }
            }
        }
    }

    Ok(matched)
}

fn stable_lerp(lower: f64, upper: f64, fraction: f64) -> f64 {
    lower * (1.0 - fraction) + upper * fraction
}

fn evaluate_density_membership(
    dataset: &Dataset,
    columnar: &ColumnarDataset,
    request: &SemanticDetailRequestV1,
    embodiment_request_json: &serde_json::Value,
) -> Result<Vec<usize>, SemanticDetailRefusalV1> {
    let embodiment_request: crate::moneta::embodiment::DensityEmbodimentRequestV1 =
        serde_json::from_value(embodiment_request_json.clone()).map_err(|err| {
            SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::UnsupportedMembership,
                message: format!("Failed to parse DensityEmbodimentRequestV1: {}", err),
            }
        })?;

    let idx_x = dataset.columns.iter().position(|col| col.name == embodiment_request.measure_field_x).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: format!("unknown density measureFieldX {}", embodiment_request.measure_field_x),
        }
    })?;

    let idx_y = dataset.columns.iter().position(|col| col.name == embodiment_request.measure_field_y).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: format!("unknown density measureFieldY {}", embodiment_request.measure_field_y),
        }
    })?;

    let col_x = columnar.primitive_column(idx_x).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: "measureFieldX has no resident numeric column".to_string(),
        }
    })?;

    let col_y = columnar.primitive_column(idx_y).ok_or_else(|| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: "measureFieldY has no resident numeric column".to_string(),
        }
    })?;

    if !request.target.semantic_object_id.starts_with("density-cell:") {
        return Err(SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: format!(
                "semanticObjectId {} must start with density-cell:",
                request.target.semantic_object_id
            ),
        });
    }

    let coords_str = &request.target.semantic_object_id["density-cell:".len()..];
    let parts: Vec<&str> = coords_str.split('-').collect();
    if parts.len() != 2 {
        return Err(SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::DeletedTarget,
            message: format!("Invalid density cell coordinates: {}", coords_str),
        });
    }

    let target_x = parts[0].parse::<usize>().map_err(|_| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::DeletedTarget,
            message: format!("Invalid x coord: {}", parts[0]),
        }
    })?;

    let target_y = parts[1].parse::<usize>().map_err(|_| {
        SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::DeletedTarget,
            message: format!("Invalid y coord: {}", parts[1]),
        }
    })?;

    let bx = embodiment_request.bins_x as usize;
    let by = embodiment_request.bins_y as usize;

    if target_x >= bx || target_y >= by {
        return Err(SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::DeletedTarget,
            message: format!(
                "Coordinates ({}, {}) out of bounds (bins: {}x{})",
                target_x, target_y, bx, by
            ),
        });
    }

    let source_row_count = columnar.row_count();
    let mut min_x = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    let mut has_finite = false;

    for row_idx in 0..source_row_count {
        if row_idx < col_x.validity.len()
            && col_x.validity[row_idx] != 0
            && row_idx < col_y.validity.len()
            && col_y.validity[row_idx] != 0
            && row_idx < col_x.values.len()
            && row_idx < col_y.values.len()
        {
            let vx = col_x.values[row_idx];
            let vy = col_y.values[row_idx];
            if vx.is_finite() && vy.is_finite() {
                min_x = min_x.min(vx);
                max_x = max_x.max(vx);
                min_y = min_y.min(vy);
                max_y = max_y.max(vy);
                has_finite = true;
            }
        }
    }

    if !has_finite {
        return Ok(vec![]);
    }

    let domain_x = crate::moneta::embodiment::DensityDomainV1 { min: min_x, max: max_x };
    let domain_y = crate::moneta::embodiment::DensityDomainV1 { min: min_y, max: max_y };

    let mut matched = Vec::new();
    for row_idx in 0..source_row_count {
        if row_idx < col_x.validity.len()
            && col_x.validity[row_idx] != 0
            && row_idx < col_y.validity.len()
            && col_y.validity[row_idx] != 0
            && row_idx < col_x.values.len()
            && row_idx < col_y.values.len()
        {
            let vx = col_x.values[row_idx];
            let vy = col_y.values[row_idx];
            if vx.is_finite() && vy.is_finite() {
                let x_idx = bin_index_u(vx, &domain_x, bx);
                let y_idx = bin_index_u(vy, &domain_y, by);
                if x_idx == target_x && y_idx == target_y {
                    matched.push(row_idx);
                }
            }
        }
    }

    Ok(matched)
}

/// B3 graph membership. The resident B2 builder is re-run for the exact
/// retained authority, so drill-down membership can never diverge from the
/// embodied topology: a node target resolves to the one source row whose
/// durable row ID mints that node, an edge target to its two endpoint rows
/// (one for a self-loop), and anything the payload does not justify refuses
/// fail-closed.
fn evaluate_graph_membership(
    dataset: &Dataset,
    request: &SemanticDetailRequestV1,
    embodiment_request_json: &serde_json::Value,
) -> Result<Vec<usize>, SemanticDetailRefusalV1> {
    let embodiment_request: crate::moneta::graph_embodiment::GraphEmbodimentRequestV1 =
        serde_json::from_value(embodiment_request_json.clone()).map_err(|err| {
            SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::UnsupportedMembership,
                message: format!("Failed to parse GraphEmbodimentRequestV1: {}", err),
            }
        })?;

    let semantic_object_id = &request.target.semantic_object_id;
    if !(semantic_object_id.starts_with("graph-node:") || semantic_object_id.starts_with("graph-edge:")) {
        return Err(SemanticDetailRefusalV1 {
            code: SemanticDetailErrorCodeV1::UnsupportedMembership,
            message: format!(
                "semanticObjectId {} must start with graph-node: or graph-edge:",
                semantic_object_id
            ),
        });
    }

    let envelope = crate::moneta::graph_embodiment::graph_from_dataset(
        dataset.fingerprint(),
        dataset,
        &embodiment_request,
    );
    let payload = match envelope.result {
        crate::moneta::graph_embodiment::GraphEmbodimentResultV1::Ready { payload } => payload,
        crate::moneta::graph_embodiment::GraphEmbodimentResultV1::Refused { refusal } => {
            return Err(SemanticDetailRefusalV1 {
                code: SemanticDetailErrorCodeV1::UnsupportedMembership,
                message: format!(
                    "graph membership refused by the resident authority: {}",
                    refusal.message
                ),
            });
        }
    };
    let data = match payload {
        crate::moneta::graph_embodiment::GraphRepresentationPayloadV1::RelationshipGraph(data) => data,
    };

    let row_position_of = |row_id: &str| dataset.row_ids.iter().position(|id| id == row_id);
    let missing_row = |row_id: &str| SemanticDetailRefusalV1 {
        code: SemanticDetailErrorCodeV1::DeletedTarget,
        message: format!("graph endpoint row {} is not resident", row_id),
    };

    if let Some(node) = data
        .nodes
        .iter()
        .find(|node| &node.semantic_id == semantic_object_id)
    {
        let position = row_position_of(&node.source_row_id).ok_or_else(|| {
            missing_row(&node.source_row_id)
        })?;
        return Ok(vec![position]);
    }

    if let Some(edge) = data
        .edges
        .iter()
        .find(|edge| &edge.semantic_id == semantic_object_id)
    {
        let endpoint_row = |node_index: u32| -> Result<String, SemanticDetailRefusalV1> {
            data.nodes
                .get(node_index as usize)
                .map(|node| node.source_row_id.clone())
                .ok_or_else(|| SemanticDetailRefusalV1 {
                    code: SemanticDetailErrorCodeV1::DeletedTarget,
                    message: format!(
                        "graph edge {} has an out-of-bounds payload node index",
                        semantic_object_id
                    ),
                })
        };
        let source_row_id = endpoint_row(edge.source_node_index)?;
        let target_row_id = endpoint_row(edge.target_node_index)?;
        let source = row_position_of(&source_row_id).ok_or_else(|| missing_row(&source_row_id))?;
        let target = row_position_of(&target_row_id).ok_or_else(|| missing_row(&target_row_id))?;
        // A self-loop's two endpoints are the same source row.
        if source == target {
            return Ok(vec![source]);
        }
        return Ok(vec![source, target]);
    }

    Err(SemanticDetailRefusalV1 {
        code: SemanticDetailErrorCodeV1::DeletedTarget,
        message: format!(
            "No graph node or edge matches semanticObjectId {}",
            semantic_object_id
        ),
    })
}

fn bin_index_u(value: f64, domain: &crate::moneta::embodiment::DensityDomainV1, bins: usize) -> usize {
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


#[cfg(test)]
mod tests {
    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::{Dataset, Edge};
    use crate::data::value::Value;
    use crate::data::register_dataset;

    use super::*;

    fn numeric_rows(count: usize) -> Vec<std::collections::HashMap<String, Value>> {
        (0..count)
            .map(|index| {
                std::collections::HashMap::from([(
                    "value".to_string(),
                    Value::Number(index as f64),
                )])
            })
            .collect()
    }

    fn graph_authority() -> crate::moneta::graph_embodiment::SourceGraphAuthorityV1 {
        crate::moneta::graph_embodiment::SourceGraphAuthorityV1 {
            kind: crate::moneta::graph_embodiment::GraphAuthorityKindV1::SourceEdges,
            directionality: crate::moneta::graph_embodiment::GraphDirectionalityV1::Directed,
            node_identity: crate::moneta::graph_embodiment::GraphNodeIdentityV1::DatasetRow,
            missing_endpoint_policy:
                crate::moneta::graph_embodiment::GraphMissingEndpointPolicyV1::Refuse,
            parallel_edge_policy:
                crate::moneta::graph_embodiment::GraphParallelEdgePolicyV1::Preserve,
            self_loop_policy: crate::moneta::graph_embodiment::GraphSelfLoopPolicyV1::Preserve,
        }
    }

    fn graph_embodiment_request() -> crate::moneta::graph_embodiment::GraphEmbodimentRequestV1 {
        crate::moneta::graph_embodiment::GraphEmbodimentRequestV1 {
            schema_version: 1,
            candidate_id: crate::moneta::embodiment::SemanticRepresentationIdV1::RelationshipGraph,
            graph_authority: graph_authority(),
            decision_id: Some("decision-graph-b3".to_string()),
            decision_model_version: Some("bootstrap-fitness-v5".to_string()),
            decision_model_artifact_hash: None,
        }
    }

    fn register_graph_fixture(edges: Vec<Edge>) -> (u32, String) {
        let mut dataset = Dataset::new(
            "drill-down-graph-fixture",
            vec![Column::new("value", ColumnType::Numeric)],
            numeric_rows(3),
        );
        dataset.edges = Some(edges);
        dataset.row_ids = vec![
            "row-alpha".to_string(),
            "row-beta".to_string(),
            "row-gamma".to_string(),
        ];
        let handle = register_dataset(dataset);
        let fingerprint = crate::data::fingerprint_for_handle(handle)
            .expect("handle registered")
            .expect("row-major fingerprint");
        (handle, fingerprint)
    }

    fn graph_payload(handle: u32) -> crate::moneta::graph_embodiment::RelationshipGraphPayloadV1 {
        let envelope = crate::moneta::graph_embodiment::build_graph_embodiment_v1(
            handle,
            &graph_embodiment_request(),
        )
        .expect("graph envelope");
        match envelope.result {
            crate::moneta::graph_embodiment::GraphEmbodimentResultV1::Ready {
                payload:
                    crate::moneta::graph_embodiment::GraphRepresentationPayloadV1::RelationshipGraph(
                        payload,
                    ),
            } => payload,
            crate::moneta::graph_embodiment::GraphEmbodimentResultV1::Refused { refusal } => {
                panic!("expected READY graph envelope, got REFUSED: {}", refusal.message);
            }
        }
    }

    fn detail_query(
        handle: u32,
        fingerprint: &str,
        semantic_object_id: &str,
    ) -> SemanticDetailEnvelopeV1 {
        let request = SemanticDetailRequestV1 {
            schema_version: SEMANTIC_DETAIL_SCHEMA_VERSION,
            target: SemanticTargetIdentityV1 {
                dataset_fingerprint: fingerprint.to_string(),
                decision_id: "decision-graph-b3".to_string(),
                representation_family: SemanticEmbodimentFamilyV1::Graph,
                semantic_object_id: semantic_object_id.to_string(),
            },
            limit: 256,
            offset: 0,
            investigation_context: "drill-down graph membership fixture".to_string(),
        };
        query_semantic_detail_v1(
            handle,
            SemanticDetailQueryV1 {
                request,
                embodiment_request: serde_json::to_value(graph_embodiment_request())
                    .expect("serializable graph request"),
                generation: 1,
            },
        )
    }

    fn ready_observation_ids(envelope: &SemanticDetailEnvelopeV1) -> Vec<String> {
        match &envelope.result {
            SemanticDetailResultV1::Ready { observation_ids, .. } => observation_ids.clone(),
            SemanticDetailResultV1::Refused { refusal } => {
                panic!("expected READY detail, got REFUSED: {}", refusal.message);
            }
        }
    }

    fn refusal_code(envelope: &SemanticDetailEnvelopeV1) -> SemanticDetailErrorCodeV1 {
        match &envelope.result {
            SemanticDetailResultV1::Refused { refusal } => refusal.code,
            SemanticDetailResultV1::Ready { .. } => {
                panic!("expected REFUSED detail, got READY");
            }
        }
    }

    #[test]
    fn graph_membership_binds_nodes_and_edges_to_source_rows() {
        // Mixed endpoint vocabulary: string row IDs, numeric positions and a
        // retained self-loop, all declared by the source.
        let edges = vec![
            Edge::new_id("row-alpha", "row-beta"),
            Edge::new(1, 2),
            Edge::new_id("row-gamma", "row-gamma"),
        ];
        let (handle, fingerprint) = register_graph_fixture(edges);
        let payload = graph_payload(handle);

        // Node target: exactly the one source row minting that node.
        let alpha = payload
            .nodes
            .iter()
            .find(|node| node.source_row_id == "row-alpha")
            .expect("row-alpha node retained");
        let node_detail = detail_query(handle, &fingerprint, &alpha.semantic_id);
        assert_eq!(ready_observation_ids(&node_detail), vec!["row-alpha"]);

        // Edge target: exactly its two endpoint rows.
        let spanning = payload
            .edges
            .iter()
            .find(|edge| edge.source_node_index != edge.target_node_index)
            .expect("spanning edge retained");
        let source_row = payload.nodes[spanning.source_node_index as usize].source_row_id.clone();
        let target_row = payload.nodes[spanning.target_node_index as usize].source_row_id.clone();
        let edge_detail = detail_query(handle, &fingerprint, &spanning.semantic_id);
        assert_eq!(
            ready_observation_ids(&edge_detail),
            vec![source_row, target_row]
        );

        // Self-loop edge target: the single endpoint row, never invented twice.
        let self_loop = payload
            .edges
            .iter()
            .find(|edge| edge.source_node_index == edge.target_node_index)
            .expect("self-loop retained");
        let self_loop_detail = detail_query(handle, &fingerprint, &self_loop.semantic_id);
        assert_eq!(ready_observation_ids(&self_loop_detail), vec!["row-gamma"]);
    }

    #[test]
    fn graph_membership_refuses_unknown_malformed_or_refused_targets() {
        // Unknown and malformed targets are judged against a dataset whose
        // graph the authority can actually embody.
        let (valid_handle, valid_fingerprint) =
            register_graph_fixture(vec![Edge::new_id("row-alpha", "row-beta")]);

        // An unknown graph target refuses with DeletedTarget.
        let unknown = detail_query(valid_handle, &valid_fingerprint, "graph-node:unknown");
        assert_eq!(refusal_code(&unknown), SemanticDetailErrorCodeV1::DeletedTarget);

        // A non-graph target vocabulary refuses with UnsupportedMembership.
        let malformed = detail_query(valid_handle, &valid_fingerprint, "cluster-region:bogus");
        assert_eq!(
            refusal_code(&malformed),
            SemanticDetailErrorCodeV1::UnsupportedMembership
        );

        // A dataset the graph authority itself refuses (unresolved endpoint)
        // fails closed for membership too: no partial membership may leak from
        // a refused graph, whatever the target.
        let (refused_handle, refused_fingerprint) = register_graph_fixture(vec![
            Edge::new_id("row-alpha", "row-beta"),
            Edge::new_id("row-alpha", "row-missing"),
        ]);
        let refused_builder = crate::moneta::graph_embodiment::build_graph_embodiment_v1(
            refused_handle,
            &graph_embodiment_request(),
        )
        .expect("graph envelope");
        assert!(matches!(
            refused_builder.result,
            crate::moneta::graph_embodiment::GraphEmbodimentResultV1::Refused { .. }
        ));

        let refused_membership =
            detail_query(refused_handle, &refused_fingerprint, "graph-edge:whatever");
        assert_eq!(
            refusal_code(&refused_membership),
            SemanticDetailErrorCodeV1::UnsupportedMembership
        );
    }
}
