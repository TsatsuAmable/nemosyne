use serde::{Deserialize, Serialize};
use crate::moneta::embodiment::SemanticEmbodimentFamilyV1;

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
