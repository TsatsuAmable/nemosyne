use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::data;
use crate::data::dataset::{Dataset, EdgeEndpoint};
use crate::data::fingerprint::sha256_hex;

use super::embodiment::{
    AnalyticalMethodV1, ApproximationModeV1, ApproximationV1, InformationContractV1,
    InformationTypeV1, ResourceEnvelopeV1, SemanticEmbodimentFamilyV1,
    SemanticPayloadProvenanceV1, SemanticRefusalCodeV1, SemanticRefusalV1,
    SemanticRepresentationIdV1, SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
};

pub const MAX_RELATIONSHIP_GRAPH_NODES_V1: u32 = 4096;
pub const MAX_RELATIONSHIP_GRAPH_EDGES_V1: u32 = 16_384;
/// Hard UTF-8 byte bound on the serialized graph embodiment envelope. This is
/// an independent fail-closed transport bound: a graph within the node/edge
/// envelope can still exceed it, in which case the whole payload is refused
/// rather than truncated. Note that for identity-rich worst-case graphs this
/// byte bound binds before the 16,384-edge bound (16,384 full semantic edge
/// entries serialize at ~2.18 MiB), so the reachable edge ceiling under the
/// byte bound is lower than the declared edge envelope.
pub const MAX_RELATIONSHIP_GRAPH_PAYLOAD_BYTES_V1: usize = 2 * 1024 * 1024;
const MAX_SHORT_TEXT_BYTES: usize = 256;
const GRAPH_METHOD_NAME_V1: &str = "source-relationship-graph";
const GRAPH_METHOD_VERSION_V1: &str = "source-relationship-graph-v1";
const GRAPH_ALGORITHM_VERSION_V1: &str = "source-graph-topology-v1";

/// Strict Rust mirror of the B1 `SOURCE_EDGES` authority contract
/// (`src/moneta/representation/RelationshipGraphAuthority.ts`). The fixed V1
/// policies are single-variant enums and `deny_unknown_fields` refuses any
/// widened or unknown authority vocabulary at the ABI boundary, so a weaker
/// parallel parser cannot exist on the kernel side.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GraphAuthorityKindV1 {
    SourceEdges,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GraphDirectionalityV1 {
    Directed,
    Undirected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GraphNodeIdentityV1 {
    DatasetRow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GraphMissingEndpointPolicyV1 {
    Refuse,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GraphParallelEdgePolicyV1 {
    Preserve,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GraphSelfLoopPolicyV1 {
    Preserve,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceGraphAuthorityV1 {
    pub kind: GraphAuthorityKindV1,
    pub directionality: GraphDirectionalityV1,
    pub node_identity: GraphNodeIdentityV1,
    pub missing_endpoint_policy: GraphMissingEndpointPolicyV1,
    pub parallel_edge_policy: GraphParallelEdgePolicyV1,
    pub self_loop_policy: GraphSelfLoopPolicyV1,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GraphEmbodimentRequestV1 {
    pub schema_version: u32,
    pub candidate_id: SemanticRepresentationIdV1,
    pub graph_authority: SourceGraphAuthorityV1,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_model_artifact_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GraphObservationCountsV1 {
    pub source_node_count: u64,
    pub source_edge_count: u64,
    pub retained_node_count: u64,
    pub retained_edge_count: u64,
    pub refused_edge_count: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GraphNodeV1 {
    pub semantic_id: String,
    pub source_row_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GraphEdgeV1 {
    pub semantic_id: String,
    pub source_node_index: u32,
    pub target_node_index: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RelationshipGraphPayloadV1 {
    pub directionality: GraphDirectionalityV1,
    pub counts: GraphObservationCountsV1,
    pub nodes: Vec<GraphNodeV1>,
    pub edges: Vec<GraphEdgeV1>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GraphRepresentationPayloadV1 {
    RelationshipGraph(RelationshipGraphPayloadV1),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GraphEmbodimentResultV1 {
    Ready {
        payload: GraphRepresentationPayloadV1,
    },
    Refused {
        refusal: SemanticRefusalV1,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GraphEmbodimentEnvelopeV1 {
    pub schema_version: u32,
    pub dataset_fingerprint: String,
    pub candidate_id: SemanticRepresentationIdV1,
    pub representation_family: SemanticEmbodimentFamilyV1,
    pub analytical_method: AnalyticalMethodV1,
    pub approximation: ApproximationV1,
    pub information_contract: InformationContractV1,
    pub resource: ResourceEnvelopeV1,
    pub provenance: SemanticPayloadProvenanceV1,
    pub result: GraphEmbodimentResultV1,
}

/// Sort key for a resolved edge. Weight is keyed by its exact f64 bit pattern
/// (with an absent-weight flag) so ordering is total and deterministic; no
/// float comparison participates in edge identity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct EdgeSortKey {
    source_canon: u32,
    target_canon: u32,
    weight_present: u8,
    weight_bits: u64,
    original_position: usize,
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

fn directionality_token(directionality: GraphDirectionalityV1) -> &'static str {
    match directionality {
        GraphDirectionalityV1::Directed => "DIRECTED",
        GraphDirectionalityV1::Undirected => "UNDIRECTED",
    }
}

fn validate_request(request: &GraphEmbodimentRequestV1) -> Result<(), String> {
    if request.schema_version != SEMANTIC_EMBODIMENT_SCHEMA_VERSION {
        return Err(format!(
            "unsupported graph request schemaVersion {}",
            request.schema_version
        ));
    }
    if request.candidate_id != SemanticRepresentationIdV1::RelationshipGraph {
        return Err("graph request requires candidateId=RELATIONSHIP_GRAPH".to_string());
    }
    // The fixed V1 authority policies must all hold. `deny_unknown_fields`
    // already refuses widened vocabulary at the ABI boundary; these checks
    // keep the kernel mirror explicit if a future variant is added.
    if !matches!(
        request.graph_authority.kind,
        GraphAuthorityKindV1::SourceEdges
    ) {
        return Err("graph authority kind must be SOURCE_EDGES".to_string());
    }
    if !matches!(
        request.graph_authority.node_identity,
        GraphNodeIdentityV1::DatasetRow
    ) {
        return Err("graph authority nodeIdentity must be DATASET_ROW".to_string());
    }
    if !matches!(
        request.graph_authority.missing_endpoint_policy,
        GraphMissingEndpointPolicyV1::Refuse
    ) {
        return Err("graph authority missingEndpointPolicy must be REFUSE".to_string());
    }
    if !matches!(
        request.graph_authority.parallel_edge_policy,
        GraphParallelEdgePolicyV1::Preserve
    ) {
        return Err("graph authority parallelEdgePolicy must be PRESERVE".to_string());
    }
    if !matches!(
        request.graph_authority.self_loop_policy,
        GraphSelfLoopPolicyV1::Preserve
    ) {
        return Err("graph authority selfLoopPolicy must be PRESERVE".to_string());
    }
    if let Some(value) = &request.decision_id {
        validate_short_text(value, "graph decisionId")?;
    }
    if let Some(value) = &request.decision_model_version {
        validate_short_text(value, "graph decisionModelVersion")?;
    }
    if let Some(value) = &request.decision_model_artifact_hash {
        if !is_lower_hex_64(value) {
            return Err(
                "graph decisionModelArtifactHash must be 64 lowercase hexadecimal characters"
                    .to_string(),
            );
        }
    }
    Ok(())
}

fn information_contract() -> InformationContractV1 {
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

fn analytical_parameters(request: &GraphEmbodimentRequestV1) -> serde_json::Value {
    // `nonFiniteWeightPolicy: "refuse-payload"` is enforced at this kernel
    // boundary. The JSON transport layer must not let a non-finite source
    // weight reach this module demoted to "absent" (`JSON.stringify` maps
    // NaN/Infinity to null); the production loader refuses such datasets
    // before registration so the declared policy holds end to end.
    serde_json::json!({
        "authorityKind": "SOURCE_EDGES",
        "nodeIdentity": "DATASET_ROW",
        "missingEndpointPolicy": "REFUSE",
        "parallelEdgePolicy": "PRESERVE",
        "selfLoopPolicy": "PRESERVE",
        "directionality": directionality_token(request.graph_authority.directionality),
        "endpointVocabulary": "numeric-row-position-or-durable-row-id",
        "edgeAttributes": ["weight"],
        "missingWeightPolicy": "absent",
        "nonFiniteWeightPolicy": "refuse-payload",
        "maxNodes": MAX_RELATIONSHIP_GRAPH_NODES_V1,
        "maxEdges": MAX_RELATIONSHIP_GRAPH_EDGES_V1,
        "maxPayloadBytes": MAX_RELATIONSHIP_GRAPH_PAYLOAD_BYTES_V1,
    })
}

fn base_envelope(
    fingerprint: String,
    source_row_count: usize,
    represented_row_count: u64,
    element_count: u32,
    request: &GraphEmbodimentRequestV1,
    result: GraphEmbodimentResultV1,
) -> GraphEmbodimentEnvelopeV1 {
    GraphEmbodimentEnvelopeV1 {
        schema_version: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
        dataset_fingerprint: fingerprint,
        candidate_id: SemanticRepresentationIdV1::RelationshipGraph,
        representation_family: SemanticEmbodimentFamilyV1::Graph,
        analytical_method: AnalyticalMethodV1 {
            name: GRAPH_METHOD_NAME_V1.to_string(),
            version: GRAPH_METHOD_VERSION_V1.to_string(),
            parameters: analytical_parameters(request),
        },
        approximation: ApproximationV1 {
            mode: ApproximationModeV1::Exact,
            represented_row_count,
            description: Some(
                "Exact source-authoritative graph topology: every source row is retained as a node and layout, proximity or correlation are never derived or implied"
                    .to_string(),
            ),
        },
        information_contract: information_contract(),
        resource: ResourceEnvelopeV1 {
            source_row_count: source_row_count as u64,
            element_count,
            max_element_count: MAX_RELATIONSHIP_GRAPH_EDGES_V1,
        },
        provenance: SemanticPayloadProvenanceV1 {
            kernel_version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: GRAPH_ALGORITHM_VERSION_V1.to_string(),
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
    request: &GraphEmbodimentRequestV1,
    code: SemanticRefusalCodeV1,
    message: impl Into<String>,
    estimated_elements: Option<u64>,
) -> GraphEmbodimentEnvelopeV1 {
    base_envelope(
        fingerprint,
        source_row_count,
        0,
        0,
        request,
        GraphEmbodimentResultV1::Refused {
            refusal: SemanticRefusalV1 {
                code,
                message: message.into(),
                estimated_elements,
            },
        },
    )
}

fn semantic_node_id(row_id: &str) -> String {
    let preimage = format!(
        "schema={SEMANTIC_EMBODIMENT_SCHEMA_VERSION}\0candidate=RELATIONSHIP_GRAPH\0nodeIdentity=DATASET_ROW\0rowId={}:{}",
        row_id.len(),
        row_id,
    );
    format!("graph-node:{}", sha256_hex(&preimage))
}

fn weight_token(weight: Option<f64>) -> String {
    match weight {
        None => "absent".to_string(),
        Some(value) => format!("f64-bits:{:016x}", value.to_bits()),
    }
}

fn semantic_edge_id(
    directionality: GraphDirectionalityV1,
    source_node_semantic_id: &str,
    target_node_semantic_id: &str,
    weight: Option<f64>,
    occurrence: u32,
) -> String {
    let preimage = format!(
        "schema={SEMANTIC_EMBODIMENT_SCHEMA_VERSION}\0candidate=RELATIONSHIP_GRAPH\0directionality={}\0sourceNode={}\0targetNode={}\0weight={}\0occurrence={}",
        directionality_token(directionality),
        source_node_semantic_id,
        target_node_semantic_id,
        weight_token(weight),
        occurrence,
    );
    format!("graph-edge:{}", sha256_hex(&preimage))
}

fn weight_sort_parts(weight: Option<f64>) -> (u8, u64) {
    match weight {
        None => (0, 0),
        Some(value) => (1, value.to_bits()),
    }
}

// Self-consistency validator for a freshly built READY envelope: it re-derives
// node and edge identity, ordering, bounds and count reconciliation from the
// payload alone. It is an internal invariant check, not a trust boundary — it
// cannot detect a payload whose row IDs and every derived ID were recomputed
// consistently by a tamperer, because it never sees the source dataset.
fn validate_ready_envelope(
    envelope: &GraphEmbodimentEnvelopeV1,
    request: &GraphEmbodimentRequestV1,
) -> Result<(), String> {
    if !is_lower_hex_64(&envelope.dataset_fingerprint) {
        return Err("graph datasetFingerprint must be 64 lowercase hexadecimal characters".to_string());
    }
    if envelope.candidate_id != SemanticRepresentationIdV1::RelationshipGraph
        || envelope.representation_family != SemanticEmbodimentFamilyV1::Graph
    {
        return Err("RELATIONSHIP_GRAPH envelope identity mismatch".to_string());
    }
    if envelope.analytical_method.name != GRAPH_METHOD_NAME_V1
        || envelope.analytical_method.version != GRAPH_METHOD_VERSION_V1
        || envelope.analytical_method.parameters != analytical_parameters(request)
    {
        return Err("graph analyticalMethod must match reviewed V1 method".to_string());
    }
    if envelope.approximation.mode != ApproximationModeV1::Exact {
        return Err("RELATIONSHIP_GRAPH approximation mode must be EXACT".to_string());
    }
    if envelope.information_contract != information_contract() {
        return Err("RELATIONSHIP_GRAPH informationContract must match the B1 ontology".to_string());
    }
    if envelope.resource.max_element_count != MAX_RELATIONSHIP_GRAPH_EDGES_V1 {
        return Err("RELATIONSHIP_GRAPH maxElementCount mismatch".to_string());
    }

    let GraphEmbodimentResultV1::Ready { payload } = &envelope.result else {
        return Err("expected READY graph envelope".to_string());
    };
    let GraphRepresentationPayloadV1::RelationshipGraph(payload) = payload;
    if payload.directionality != request.graph_authority.directionality {
        return Err("graph payload directionality must match the declared authority".to_string());
    }

    // Node contract: every source row is retained as exactly one node, in
    // deterministic ascending durable-row-ID order, with re-derivable semantic
    // identity that is independent of source row position.
    if payload.nodes.is_empty() || payload.nodes.len() > MAX_RELATIONSHIP_GRAPH_NODES_V1 as usize
    {
        return Err("READY graph payload node count out of bounds".to_string());
    }
    if payload.counts.source_node_count != envelope.resource.source_row_count
        || payload.counts.retained_node_count != payload.nodes.len() as u64
        || payload.counts.source_node_count != payload.counts.retained_node_count
        || envelope.approximation.represented_row_count != payload.counts.retained_node_count
    {
        return Err("graph node counts do not reconcile".to_string());
    }
    let mut node_ids = HashSet::new();
    let mut row_ids = HashSet::new();
    let mut previous_row_id: Option<&str> = None;
    for node in &payload.nodes {
        validate_short_text(&node.semantic_id, "graph node semanticId")?;
        if node.source_row_id.is_empty() {
            return Err("graph nodes may not serialize empty durable row IDs".to_string());
        }
        if !node_ids.insert(node.semantic_id.as_str()) {
            return Err("graph node semanticId values must be unique".to_string());
        }
        if !row_ids.insert(node.source_row_id.as_str()) {
            return Err("graph source row IDs must be unique".to_string());
        }
        if previous_row_id.is_some_and(|previous| previous >= node.source_row_id.as_str()) {
            return Err("graph nodes must use deterministic ascending row-ID order".to_string());
        }
        previous_row_id = Some(node.source_row_id.as_str());
        if node.semantic_id != semantic_node_id(&node.source_row_id) {
            return Err("graph node semanticId does not match durable row identity".to_string());
        }
    }

    // Edge contract: no partial payloads, exact multiplicity, deterministic
    // canonical ordering, endpoint indexes inside the node list, and semantic
    // identity re-derivable from node identity + directionality + weight token
    // + parallel-edge occurrence.
    if payload.edges.is_empty() || payload.edges.len() > MAX_RELATIONSHIP_GRAPH_EDGES_V1 as usize
    {
        return Err("READY graph payload edge count out of bounds".to_string());
    }
    if payload.counts.source_edge_count != payload.counts.retained_edge_count
        || payload.counts.retained_edge_count != payload.edges.len() as u64
        || payload.counts.refused_edge_count != 0
        || envelope.resource.element_count != payload.edges.len() as u32
    {
        return Err("graph edge counts do not reconcile".to_string());
    }
    let undirected = payload.directionality == GraphDirectionalityV1::Undirected;
    let mut edge_ids = HashSet::new();
    let mut previous_key: Option<(u32, u32, u8, u64)> = None;
    let mut occurrence = 0u32;
    for edge in &payload.edges {
        if edge.source_node_index >= payload.nodes.len() as u32
            || edge.target_node_index >= payload.nodes.len() as u32
        {
            return Err("graph edge endpoints must reference retained nodes".to_string());
        }
        if let Some(weight) = edge.weight {
            if !weight.is_finite() {
                return Err("graph edge weight must be finite".to_string());
            }
        }
        if undirected && edge.source_node_index > edge.target_node_index {
            return Err("undirected graph edges must use canonical endpoint order".to_string());
        }
        let (weight_present, weight_bits) = weight_sort_parts(edge.weight);
        let key = (
            edge.source_node_index,
            edge.target_node_index,
            weight_present,
            weight_bits,
        );
        if previous_key.is_some_and(|previous| key < previous) {
            return Err("graph edges must use deterministic canonical order".to_string());
        }
        occurrence = if previous_key == Some(key) {
            occurrence
                .checked_add(1)
                .ok_or_else(|| "graph parallel-edge occurrence overflow".to_string())?
        } else {
            0
        };
        previous_key = Some(key);
        validate_short_text(&edge.semantic_id, "graph edge semanticId")?;
        if !edge_ids.insert(edge.semantic_id.as_str()) {
            return Err("graph edge semanticId values must be unique".to_string());
        }
        let expected = semantic_edge_id(
            payload.directionality,
            &payload.nodes[edge.source_node_index as usize].semantic_id,
            &payload.nodes[edge.target_node_index as usize].semantic_id,
            edge.weight,
            occurrence,
        );
        if edge.semantic_id != expected {
            return Err("graph edge semanticId does not match source identity".to_string());
        }
    }
    Ok(())
}

/// Builds the deterministic graph envelope for a resident dataset. `pub(crate)`
/// so the B3 drill-down can re-run the exact builder for membership instead of
/// maintaining a parallel topology parser.
pub(crate) fn graph_from_dataset(
    fingerprint: String,
    dataset: &Dataset,
    request: &GraphEmbodimentRequestV1,
) -> GraphEmbodimentEnvelopeV1 {
    let source_row_count = dataset.rows.len();
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

    // Node identity is the durable row ID. JSON registration mints synthetic
    // `fingerprint:index` IDs only when the source-declared row IDs are absent
    // or invalid (duplicates/empties), so the resident dataset always carries
    // exactly one unique ID per row — but those IDs may not be the ones the
    // source declared. Re-check uniqueness here so direct kernel callers
    // cannot smuggle in positional identity.
    if dataset.row_ids.len() != source_row_count
        || dataset.row_ids.iter().any(|id| id.is_empty())
        || dataset.row_ids.iter().collect::<HashSet<_>>().len() != source_row_count
    {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "graph node identity requires a unique durable row ID for every source row",
            None,
        );
    }

    // A graph with zero source edges is refused rather than emitted as an
    // all-isolated-node graph: B1 disqualifies explicit authority when the
    // source edge count is zero, and V1 topology exists only when the source
    // declares it. Isolated nodes are retained exactly when at least one
    // source edge exists.
    let Some(source_edges) = dataset.edges.as_ref().filter(|edges| !edges.is_empty()) else {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "source-authoritative graph requires at least one source-provided edge",
            None,
        );
    };

    // Node and edge bounds are enforced before any output growth. The payload
    // byte bound is necessarily checked after serialization, but a payload
    // that exceeds it is refused wholesale and never crosses the boundary.
    if source_row_count > MAX_RELATIONSHIP_GRAPH_NODES_V1 as usize {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::ResourceLimit,
            format!(
                "graph node count {source_row_count} exceeds hard V1 bound {MAX_RELATIONSHIP_GRAPH_NODES_V1}"
            ),
            Some(source_row_count as u64),
        );
    }
    if source_edges.len() > MAX_RELATIONSHIP_GRAPH_EDGES_V1 as usize {
        return refusal(
            fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::ResourceLimit,
            format!(
                "graph edge count {} exceeds hard V1 bound {MAX_RELATIONSHIP_GRAPH_EDGES_V1}",
                source_edges.len()
            ),
            Some(source_edges.len() as u64),
        );
    }

    // Canonical node order: durable row IDs ascending. This makes node list
    // order and every edge endpoint index stable under row-preserving source
    // reorders, so semantic identity never depends on presentation or row order.
    let mut canonical_rows: Vec<usize> = (0..source_row_count).collect();
    canonical_rows.sort_by(|&a, &b| dataset.row_ids[a].cmp(&dataset.row_ids[b]));
    let nodes: Vec<GraphNodeV1> = canonical_rows
        .iter()
        .map(|&row| GraphNodeV1 {
            semantic_id: semantic_node_id(&dataset.row_ids[row]),
            source_row_id: dataset.row_ids[row].clone(),
        })
        .collect();
    let mut canonical_index_of_row = vec![0u32; source_row_count];
    for (canonical, &row) in canonical_rows.iter().enumerate() {
        canonical_index_of_row[row] = canonical as u32;
    }
    let row_position_of_id: HashMap<&str, usize> = dataset
        .row_ids
        .iter()
        .enumerate()
        .map(|(position, id)| (id.as_str(), position))
        .collect();

    let undirected = request.graph_authority.directionality == GraphDirectionalityV1::Undirected;
    let mut records: Vec<EdgeSortKey> = Vec::with_capacity(source_edges.len());
    let mut resolved: Vec<Option<f64>> = Vec::with_capacity(source_edges.len());
    for (position, edge) in source_edges.iter().enumerate() {
        let resolve = |endpoint: &EdgeEndpoint| -> Result<usize, String> {
            match endpoint {
                EdgeEndpoint::Index(index) => {
                    if *index < source_row_count {
                        Ok(*index)
                    } else {
                        Err(format!(
                            "numeric endpoint {index} does not resolve to a source row (0..{source_row_count})"
                        ))
                    }
                }
                EdgeEndpoint::Id(id) => row_id_to_position(&row_position_of_id, id).ok_or_else(|| {
                    format!("string endpoint does not match any durable row ID: {id}")
                }),
            }
        };
        let source_row = match resolve(&edge.source) {
            Ok(row) => row,
            Err(error) => {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::MissingEvidence,
                    format!("graph edge {position} source endpoint refused: {error}"),
                    Some(source_edges.len() as u64),
                );
            }
        };
        let target_row = match resolve(&edge.target) {
            Ok(row) => row,
            Err(error) => {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::MissingEvidence,
                    format!("graph edge {position} target endpoint refused: {error}"),
                    Some(source_edges.len() as u64),
                );
            }
        };
        let weight = match edge.weight {
            Some(weight) if !weight.is_finite() => {
                return refusal(
                    fingerprint,
                    source_row_count,
                    request,
                    SemanticRefusalCodeV1::MissingEvidence,
                    format!(
                        "graph edge {position} has a non-finite weight; V1 refuses the whole payload"
                    ),
                    Some(source_edges.len() as u64),
                );
            }
            other => other,
        };
        let (weight_present, weight_bits) = weight_sort_parts(weight);
        let source_canon = canonical_index_of_row[source_row];
        let target_canon = canonical_index_of_row[target_row];
        // Undirected edges canonicalize endpoint order for identity purposes;
        // directed edges keep the declared orientation, and multiplicity is
        // preserved in both cases.
        let (source_canon, target_canon) = if undirected && source_canon > target_canon {
            (target_canon, source_canon)
        } else {
            (source_canon, target_canon)
        };
        records.push(EdgeSortKey {
            source_canon,
            target_canon,
            weight_present,
            weight_bits,
            original_position: position,
        });
        resolved.push(weight);
    }

    records.sort();

    // Mint edge identity: identical parallel edges are distinguished by an
    // occurrence counter within their exact (endpoints, weight) group, so
    // multiplicity is preserved without collapsing duplicates.
    let mut edges: Vec<GraphEdgeV1> = Vec::with_capacity(records.len());
    let mut previous_key: Option<(u32, u32, u8, u64)> = None;
    let mut occurrence = 0u32;
    for record in &records {
        let key = (
            record.source_canon,
            record.target_canon,
            record.weight_present,
            record.weight_bits,
        );
        occurrence = if previous_key == Some(key) {
            occurrence
                .checked_add(1)
                .expect("edge occurrence overflow within the V1 edge envelope")
        } else {
            0
        };
        previous_key = Some(key);
        let weight = resolved[record.original_position];
        let semantic_id = semantic_edge_id(
            request.graph_authority.directionality,
            &nodes[record.source_canon as usize].semantic_id,
            &nodes[record.target_canon as usize].semantic_id,
            weight,
            occurrence,
        );
        edges.push(GraphEdgeV1 {
            semantic_id,
            source_node_index: record.source_canon,
            target_node_index: record.target_canon,
            weight,
        });
    }

    let retained_edge_count = edges.len() as u64;
    let mut envelope = base_envelope(
        fingerprint,
        source_row_count,
        source_row_count as u64,
        edges.len() as u32,
        request,
        GraphEmbodimentResultV1::Ready {
            payload: GraphRepresentationPayloadV1::RelationshipGraph(RelationshipGraphPayloadV1 {
                directionality: request.graph_authority.directionality,
                counts: GraphObservationCountsV1 {
                    source_node_count: source_row_count as u64,
                    source_edge_count: source_edges.len() as u64,
                    retained_node_count: source_row_count as u64,
                    retained_edge_count: edges.len() as u64,
                    refused_edge_count: 0,
                },
                nodes,
                edges,
            }),
        },
    );
    if let Err(error) = validate_ready_envelope(&envelope, request) {
        crate::log_error(&format!("graph semantic embodiment validation failed: {error}"));
        envelope = refusal(
            envelope.dataset_fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::MissingEvidence,
            "graph semantic embodiment failed internal contract validation",
            None,
        );
        return envelope;
    }
    match serde_json::to_vec(&envelope) {
        Ok(bytes) if bytes.len() <= MAX_RELATIONSHIP_GRAPH_PAYLOAD_BYTES_V1 => envelope,
        Ok(bytes) => refusal(
            envelope.dataset_fingerprint,
            source_row_count,
            request,
            SemanticRefusalCodeV1::ResourceLimit,
            format!(
                "serialized graph payload is {} UTF-8 bytes, exceeding hard V1 bound {MAX_RELATIONSHIP_GRAPH_PAYLOAD_BYTES_V1}",
                bytes.len()
            ),
            Some(retained_edge_count),
        ),
        Err(error) => {
            crate::log_error(&format!("graph semantic embodiment serialization failed: {error}"));
            refusal(
                envelope.dataset_fingerprint,
                source_row_count,
                request,
                SemanticRefusalCodeV1::MissingEvidence,
                "graph semantic embodiment failed internal serialization",
                None,
            )
        }
    }
}

fn row_id_to_position(row_position_of_id: &HashMap<&str, usize>, id: &str) -> Option<usize> {
    row_position_of_id.get(id).copied()
}

pub fn build_graph_embodiment_v1(
    handle: u32,
    request: &GraphEmbodimentRequestV1,
) -> Option<GraphEmbodimentEnvelopeV1> {
    let fingerprint = data::fingerprint_for_handle(handle)?.ok()?;
    data::with_dataset(handle, |dataset| {
        graph_from_dataset(fingerprint.clone(), dataset, request)
    })
    .or_else(|| {
        // Columnar-only registrations carry no row-major source payload and
        // therefore no source-authoritative edges; fail closed with a typed
        // refusal rather than an empty READY graph.
        data::with_columnar_metadata(handle, |_name, _columns, columnar| {
            refusal(
                fingerprint,
                columnar.row_count(),
                request,
                SemanticRefusalCodeV1::MissingEvidence,
                "columnar-only resident datasets do not carry source edges; RELATIONSHIP_GRAPH requires the row-major source payload",
                None,
            )
        })
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
pub fn moneta_build_graph_embodiment_v1(
    handle: u32,
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(input) = copy_host_input(input_ptr, input_len) else {
        return 0;
    };
    let request: GraphEmbodimentRequestV1 = match serde_json::from_slice(&input) {
        Ok(request) => request,
        Err(error) => {
            crate::log_error(&format!("graph semantic embodiment request parse failed: {error}"));
            return 0;
        }
    };
    let Some(envelope) = build_graph_embodiment_v1(handle, &request) else {
        return 0;
    };
    let output = match serde_json::to_vec(&envelope) {
        Ok(output) => output,
        Err(error) => {
            crate::log_error(&format!("graph semantic embodiment serialization failed: {error}"));
            return 0;
        }
    };
    crate::write_bytes_out(&output, out_ptr, out_len)
}

#[cfg(test)]
mod tests {
    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::{Dataset, Edge};
    use crate::data::value::Value;

    use super::*;

    fn authority(directionality: GraphDirectionalityV1) -> SourceGraphAuthorityV1 {
        SourceGraphAuthorityV1 {
            kind: GraphAuthorityKindV1::SourceEdges,
            directionality,
            node_identity: GraphNodeIdentityV1::DatasetRow,
            missing_endpoint_policy: GraphMissingEndpointPolicyV1::Refuse,
            parallel_edge_policy: GraphParallelEdgePolicyV1::Preserve,
            self_loop_policy: GraphSelfLoopPolicyV1::Preserve,
        }
    }

    fn request(directionality: GraphDirectionalityV1) -> GraphEmbodimentRequestV1 {
        GraphEmbodimentRequestV1 {
            schema_version: 1,
            candidate_id: SemanticRepresentationIdV1::RelationshipGraph,
            graph_authority: authority(directionality),
            decision_id: Some("decision-graph-b2".to_string()),
            decision_model_version: Some("bootstrap-fitness-v5".to_string()),
            decision_model_artifact_hash: None,
        }
    }

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

    fn graph_dataset(
        name: &str,
        row_count: usize,
        edges: Vec<Edge>,
        row_ids: Option<Vec<String>>,
    ) -> u32 {
        let mut dataset = Dataset::new(
            name,
            vec![Column::new("value", ColumnType::Numeric)],
            numeric_rows(row_count),
        );
        dataset.edges = Some(edges);
        if let Some(ids) = row_ids {
            dataset.row_ids = ids;
        }
        data::register_dataset(dataset)
    }

    fn ready_payload(envelope: GraphEmbodimentEnvelopeV1) -> RelationshipGraphPayloadV1 {
        match envelope.result {
            GraphEmbodimentResultV1::Ready {
                payload: GraphRepresentationPayloadV1::RelationshipGraph(payload),
            } => payload,
            GraphEmbodimentResultV1::Refused { refusal } => {
                panic!("expected READY graph envelope, got REFUSED: {}", refusal.message);
            }
        }
    }

    fn refused_code(envelope: GraphEmbodimentEnvelopeV1) -> SemanticRefusalV1 {
        let GraphEmbodimentResultV1::Refused { refusal } = envelope.result else {
            panic!("expected REFUSED graph envelope");
        };
        refusal
    }

    #[test]
    fn ready_payload_preserves_source_topology_exactly() {
        let edges = vec![
            Edge {
                source: EdgeEndpoint::Index(0),
                target: EdgeEndpoint::Index(1),
                weight: Some(1.0),
                extra: std::collections::HashMap::new(),
            },
            Edge {
                source: EdgeEndpoint::Id("r1".to_string()),
                target: EdgeEndpoint::Id("r2".to_string()),
                weight: None,
                extra: std::collections::HashMap::new(),
            },
            // exact duplicate parallel edge
            Edge {
                source: EdgeEndpoint::Index(0),
                target: EdgeEndpoint::Index(1),
                weight: Some(1.0),
                extra: std::collections::HashMap::new(),
            },
            // parallel edge with a different weight
            Edge {
                source: EdgeEndpoint::Index(0),
                target: EdgeEndpoint::Index(1),
                weight: Some(2.5),
                extra: std::collections::HashMap::new(),
            },
            // self-loop
            Edge {
                source: EdgeEndpoint::Index(3),
                target: EdgeEndpoint::Index(3),
                weight: None,
                extra: std::collections::HashMap::new(),
            },
        ];
        let envelope = build_graph_embodiment_v1(
            graph_dataset(
                "graph-reference",
                5,
                edges,
                Some((0..5).map(|index| format!("r{index}")).collect()),
            ),
            &request(GraphDirectionalityV1::Directed),
        )
        .expect("graph envelope");
        assert_eq!(envelope.approximation.mode, ApproximationModeV1::Exact);
        assert_eq!(envelope.representation_family, SemanticEmbodimentFamilyV1::Graph);
        assert_eq!(envelope.resource.element_count, 5);
        let payload = ready_payload(envelope);
        assert_eq!(
            payload.counts,
            GraphObservationCountsV1 {
                source_node_count: 5,
                source_edge_count: 5,
                retained_node_count: 5,
                retained_edge_count: 5,
                refused_edge_count: 0,
            }
        );
        // row 4 is isolated and still retained as a node
        assert_eq!(payload.nodes.len(), 5);
        assert!(payload.nodes.iter().all(|node| node
            .semantic_id
            .starts_with("graph-node:")));
        assert!(payload.nodes.windows(2).all(|pair| pair[0].source_row_id < pair[1].source_row_id));

        // canonical positions equal source positions for row IDs r0..r4, and
        // edges are emitted in deterministic (endpoints, weight, position)
        // order: the three 0->1 parallels first, then 1->2, then the 3->3
        // self-loop
        assert_eq!(payload.edges[0].source_node_index, 0);
        assert_eq!(payload.edges[0].target_node_index, 1);
        assert_eq!(payload.edges[0].weight, Some(1.0));
        assert_eq!(payload.edges[1].source_node_index, 0);
        assert_eq!(payload.edges[1].target_node_index, 1);
        assert_eq!(payload.edges[1].weight, Some(1.0));
        assert_eq!(payload.edges[2].source_node_index, 0);
        assert_eq!(payload.edges[2].target_node_index, 1);
        assert_eq!(payload.edges[2].weight, Some(2.5));
        assert_eq!(payload.edges[3].source_node_index, 1);
        assert_eq!(payload.edges[3].target_node_index, 2);
        assert_eq!(payload.edges[3].weight, None);
        // exact duplicate parallel edges keep multiplicity with distinct identity
        assert_ne!(payload.edges[0].semantic_id, payload.edges[1].semantic_id);
        assert_ne!(payload.edges[0].semantic_id, payload.edges[2].semantic_id);
        // self-loop preserved with equal endpoints
        let self_loop = payload
            .edges
            .iter()
            .find(|edge| edge.source_node_index == edge.target_node_index)
            .expect("self-loop retained");
        assert_eq!(self_loop.source_node_index, 3);
    }

    #[test]
    fn row_order_permutation_does_not_change_semantic_identity() {
        let ids = vec!["a", "b", "c", "d"];
        let forward_edges = vec![
            Edge::new_id("a", "b"),
            Edge::new_id("b", "c"),
            Edge::new_id("c", "a"),
        ];
        let reversed_edges = vec![
            Edge::new_id("c", "a"),
            Edge::new_id("b", "c"),
            Edge::new_id("a", "b"),
        ];
        let first = ready_payload(
            build_graph_embodiment_v1(
                graph_dataset(
                    "graph-order-one",
                    4,
                    forward_edges,
                    Some(ids.iter().map(|id| id.to_string()).collect()),
                ),
                &request(GraphDirectionalityV1::Directed),
            )
            .unwrap(),
        );
        let second = ready_payload(
            build_graph_embodiment_v1(
                graph_dataset(
                    "graph-order-two",
                    4,
                    reversed_edges,
                    Some(ids.iter().rev().map(|id| id.to_string()).collect()),
                ),
                &request(GraphDirectionalityV1::Directed),
            )
            .unwrap(),
        );
        assert_eq!(first, second);
    }

    #[test]
    fn refuses_unresolved_endpoints_without_partial_payloads() {
        let numeric = vec![Edge::new(0, 99)];
        let envelope = build_graph_embodiment_v1(
            graph_dataset("graph-numeric-miss", 2, numeric, None),
            &request(GraphDirectionalityV1::Directed),
        )
        .unwrap();
        let refusal = refused_code(envelope);
        assert_eq!(refusal.code, SemanticRefusalCodeV1::MissingEvidence);
        assert!(refusal.message.contains("numeric endpoint 99"));

        let string = vec![
            Edge::new(0, 1),
            Edge::new(0, 1),
            Edge::new_id("b", "nope"),
        ];
        let envelope = build_graph_embodiment_v1(
            graph_dataset("graph-string-miss", 2, string, Some(vec!["a".into(), "b".into()])),
            &request(GraphDirectionalityV1::Directed),
        )
        .unwrap();
        let refusal = refused_code(envelope);
        assert_eq!(refusal.code, SemanticRefusalCodeV1::MissingEvidence);
        assert!(refusal.message.contains("durable row ID"));
        // REFUSE policy rejects the whole payload: no partial edge list. The
        // estimate reports the source edge count (3), not the failing edge's
        // position (2), so the failing edge is named in the message instead.
        assert_eq!(refusal.estimated_elements, Some(3));
    }

    #[test]
    fn refuses_missing_edges_missing_identity_and_non_finite_weight() {
        let no_edges = build_graph_embodiment_v1(
            graph_dataset("graph-no-edges", 2, vec![], None),
            &request(GraphDirectionalityV1::Directed),
        )
        .unwrap();
        assert_eq!(
            refused_code(no_edges).code,
            SemanticRefusalCodeV1::MissingEvidence
        );

        let mut identityless = Dataset::new(
            "graph-no-identity",
            vec![Column::new("value", ColumnType::Numeric)],
            numeric_rows(2),
        );
        identityless.edges = Some(vec![Edge::new(0, 1)]);
        identityless.row_ids = vec![];
        let handle = data::register_dataset(identityless);
        let envelope = build_graph_embodiment_v1(handle, &request(GraphDirectionalityV1::Directed)).unwrap();
        assert_eq!(
            refused_code(envelope).code,
            SemanticRefusalCodeV1::MissingEvidence
        );

        let mut weighted = Dataset::new(
            "graph-nan-weight",
            vec![Column::new("value", ColumnType::Numeric)],
            numeric_rows(2),
        );
        weighted.edges = Some(vec![Edge {
            source: EdgeEndpoint::Index(0),
            target: EdgeEndpoint::Index(1),
            weight: Some(f64::NAN),
            extra: std::collections::HashMap::new(),
        }]);
        let handle = data::register_dataset(weighted);
        let envelope = build_graph_embodiment_v1(handle, &request(GraphDirectionalityV1::Directed)).unwrap();
        let refusal = refused_code(envelope);
        assert_eq!(refusal.code, SemanticRefusalCodeV1::MissingEvidence);
        assert!(refusal.message.contains("non-finite weight"));
    }

    #[test]
    fn refuses_node_and_edge_envelope_overruns_before_growth() {
        let over_nodes = build_graph_embodiment_v1(
            graph_dataset(
                "graph-over-nodes",
                MAX_RELATIONSHIP_GRAPH_NODES_V1 as usize + 1,
                vec![Edge::new(0, 1)],
                None,
            ),
            &request(GraphDirectionalityV1::Directed),
        )
        .unwrap();
        let refusal = refused_code(over_nodes);
        assert_eq!(refusal.code, SemanticRefusalCodeV1::ResourceLimit);
        assert_eq!(refusal.estimated_elements, Some(MAX_RELATIONSHIP_GRAPH_NODES_V1 as u64 + 1));

        let over_edges: Vec<Edge> = (0..=MAX_RELATIONSHIP_GRAPH_EDGES_V1)
            .map(|index| Edge::new((index % 2) as usize, ((index + 1) % 2) as usize))
            .collect();
        let envelope = build_graph_embodiment_v1(
            graph_dataset("graph-over-edges", 2, over_edges, None),
            &request(GraphDirectionalityV1::Directed),
        )
        .unwrap();
        let refusal = refused_code(envelope);
        assert_eq!(refusal.code, SemanticRefusalCodeV1::ResourceLimit);
        assert_eq!(
            refusal.estimated_elements,
            Some(MAX_RELATIONSHIP_GRAPH_EDGES_V1 as u64 + 1)
        );
    }

    #[test]
    fn admits_at_bound_node_and_edge_counts() {
        let at_nodes = build_graph_embodiment_v1(
            graph_dataset(
                "graph-at-nodes",
                MAX_RELATIONSHIP_GRAPH_NODES_V1 as usize,
                vec![Edge::new(0, 1)],
                Some((0..MAX_RELATIONSHIP_GRAPH_NODES_V1).map(|i| format!("n{i}")).collect()),
            ),
            &request(GraphDirectionalityV1::Directed),
        )
        .unwrap();
        let payload = ready_payload(at_nodes);
        assert_eq!(payload.nodes.len(), MAX_RELATIONSHIP_GRAPH_NODES_V1 as usize);

        // The 16,384-edge bound is not itself reachable: a full-envelope graph
        // with 64-hex semantic edge IDs serializes beyond the independent
        // 2 MiB payload bound first (16,384 edges serialize at ~2.18 MiB), so
        // the byte bound binds fail-closed before the edge bound. The largest
        // byte-fitting edge count must still be admitted exactly.
        let large_edges: Vec<Edge> = (0..12_000)
            .map(|index| Edge::new(index % 4, (index + 1) % 4))
            .collect();
        let envelope = build_graph_embodiment_v1(
            graph_dataset("graph-many-edges", 4, large_edges, None),
            &request(GraphDirectionalityV1::Directed),
        )
        .unwrap();
        let payload = ready_payload(envelope);
        assert_eq!(payload.edges.len(), 12_000);
        assert_eq!(payload.counts.retained_edge_count, 12_000);
    }

    #[test]
    fn refuses_payloads_beyond_the_two_mib_byte_bound() {
        // 4096 nodes with long durable row IDs plus 16384 edges serializes
        // beyond the 2 MiB transport bound even though it is inside the
        // node/edge envelope; the whole payload must be refused.
        let suffix = "x".repeat(48);
        let long_ids: Vec<String> = (0..MAX_RELATIONSHIP_GRAPH_NODES_V1)
            .map(|index| format!("durable-row-identity-{index:04}-{suffix}"))
            .collect();
        let edges: Vec<Edge> = (0..MAX_RELATIONSHIP_GRAPH_EDGES_V1 as usize)
            .map(|index| {
                Edge::new(
                    index % MAX_RELATIONSHIP_GRAPH_NODES_V1 as usize,
                    (index * 7 + 3) % MAX_RELATIONSHIP_GRAPH_NODES_V1 as usize,
                )
            })
            .collect();
        let envelope = build_graph_embodiment_v1(
            graph_dataset("graph-over-bytes", MAX_RELATIONSHIP_GRAPH_NODES_V1 as usize, edges, Some(long_ids)),
            &request(GraphDirectionalityV1::Directed),
        )
        .unwrap();
        let refusal = refused_code(envelope);
        assert_eq!(refusal.code, SemanticRefusalCodeV1::ResourceLimit);
        assert!(refusal.message.contains("UTF-8 bytes"));
        assert!(refusal.message.contains(&MAX_RELATIONSHIP_GRAPH_PAYLOAD_BYTES_V1.to_string()));
    }

    #[test]
    fn undirected_edges_canonicalize_endpoint_order_without_collapsing_multiplicity() {
        let edges = vec![Edge::new_id("a", "b"), Edge::new_id("b", "a"), Edge::new_id("b", "c")];
        let payload = ready_payload(
            build_graph_embodiment_v1(
                graph_dataset(
                    "graph-undirected",
                    3,
                    edges,
                    Some(vec!["a".into(), "b".into(), "c".into()]),
                ),
                &request(GraphDirectionalityV1::Undirected),
            )
            .unwrap(),
        );
        assert_eq!(payload.directionality, GraphDirectionalityV1::Undirected);
        assert_eq!(payload.edges.len(), 3);
        assert!(payload
            .edges
            .iter()
            .all(|edge| edge.source_node_index <= edge.target_node_index));
        // the a<->b pair is preserved as two distinct parallel edges
        let pair: Vec<&GraphEdgeV1> = payload
            .edges
            .iter()
            .filter(|edge| {
                edge.source_node_index == 0 && edge.target_node_index == 1
            })
            .collect();
        assert_eq!(pair.len(), 2);
        assert_ne!(pair[0].semantic_id, pair[1].semantic_id);
    }

    #[test]
    fn internal_validator_rejects_tampered_ready_payloads() {
        let edges = vec![Edge::new_id("a", "b"), Edge::new_id("b", "c")];
        let envelope = build_graph_embodiment_v1(
            graph_dataset(
                "graph-tamper",
                3,
                edges,
                Some(vec!["a".into(), "b".into(), "c".into()]),
            ),
            &request(GraphDirectionalityV1::Directed),
        )
        .unwrap();
        let request = request(GraphDirectionalityV1::Directed);
        assert!(validate_ready_envelope(&envelope, &request).is_ok());

        let GraphEmbodimentResultV1::Ready { payload } = &envelope.result else {
            panic!("expected READY");
        };
        let GraphRepresentationPayloadV1::RelationshipGraph(ready) = &payload;

        // swapped node order breaks the deterministic ascending contract
        let mut swapped = envelope.clone();
        let GraphEmbodimentResultV1::Ready {
            payload: GraphRepresentationPayloadV1::RelationshipGraph(inner),
        } = &mut swapped.result
        else {
            panic!();
        };
        inner.nodes.swap(0, 1);
        assert!(validate_ready_envelope(&swapped, &request).is_err());

        // a corrupted edge semantic id no longer matches source identity
        let mut corrupted = envelope.clone();
        let GraphEmbodimentResultV1::Ready {
            payload: GraphRepresentationPayloadV1::RelationshipGraph(inner),
        } = &mut corrupted.result
        else {
            panic!();
        };
        inner.edges[0].semantic_id = format!("graph-edge:{}", "0".repeat(64));
        assert!(validate_ready_envelope(&corrupted, &request).is_err());

        // dropping an edge breaks count reconciliation
        let mut dropped = envelope.clone();
        let GraphEmbodimentResultV1::Ready {
            payload: GraphRepresentationPayloadV1::RelationshipGraph(inner),
        } = &mut dropped.result
        else {
            panic!();
        };
        inner.edges.truncate(ready.edges.len() - 1);
        assert!(validate_ready_envelope(&dropped, &request).is_err());
    }

    #[test]
    fn strict_authority_mirror_refuses_widened_vocabulary() {
        let valid = serde_json::to_value(&request(GraphDirectionalityV1::Directed)).unwrap();
        assert!(serde_json::from_value::<GraphEmbodimentRequestV1>(valid).is_ok());

        let mut widened = serde_json::to_value(&request(GraphDirectionalityV1::Directed)).unwrap();
        widened["graphAuthority"]["inferMissingEdges"] = serde_json::json!(true);
        assert!(serde_json::from_value::<GraphEmbodimentRequestV1>(widened).is_err());

        let mut relaxed = serde_json::to_value(&request(GraphDirectionalityV1::Directed)).unwrap();
        relaxed["graphAuthority"]["missingEndpointPolicy"] = serde_json::json!("DROP");
        assert!(serde_json::from_value::<GraphEmbodimentRequestV1>(relaxed).is_err());

        let mut inferred = serde_json::to_value(&request(GraphDirectionalityV1::Directed)).unwrap();
        inferred["graphAuthority"]["directionality"] = serde_json::json!("INFER");
        assert!(serde_json::from_value::<GraphEmbodimentRequestV1>(inferred).is_err());

        let mut wrong_candidate = serde_json::to_value(&request(GraphDirectionalityV1::Directed)).unwrap();
        wrong_candidate["candidateId"] = serde_json::json!("CLUSTER_REGIONS");
        let parsed = serde_json::from_value::<GraphEmbodimentRequestV1>(wrong_candidate).unwrap();
        let envelope = build_graph_embodiment_v1(
            graph_dataset("graph-wrong-candidate", 2, vec![Edge::new(0, 1)], None),
            &parsed,
        )
        .unwrap();
        assert_eq!(
            refused_code(envelope).code,
            SemanticRefusalCodeV1::InvalidParameters
        );
    }

    #[test]
    fn refuses_columnar_only_handles_without_fabricating_an_empty_graph() {
        use crate::data::columnar::ColumnarDataset;
        use crate::data::columnar::PrimitiveColumn;

        let columnar = ColumnarDataset::from_parts(
            2,
            std::collections::HashMap::from([(
                0,
                PrimitiveColumn {
                    values: vec![0.0, 1.0],
                    validity: vec![1, 1],
                },
            )]),
            std::collections::HashMap::new(),
        )
        .unwrap();
        let handle = crate::data::register_columnar_dataset(
            "graph-columnar-only".to_string(),
            vec![Column::new("value", ColumnType::Numeric)],
            columnar,
        );
        let envelope = build_graph_embodiment_v1(handle, &request(GraphDirectionalityV1::Directed))
            .unwrap();
        let refusal = refused_code(envelope);
        assert_eq!(refusal.code, SemanticRefusalCodeV1::MissingEvidence);
        assert!(refusal.message.contains("columnar-only resident datasets"));
    }
}