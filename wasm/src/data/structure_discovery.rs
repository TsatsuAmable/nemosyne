use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructureEvidence {
    pub method: String,
    pub parameters: serde_json::Value,
    pub rank: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredStructure {
    pub id: String,
    pub kind: String,
    pub row_indices: Vec<usize>,
    pub datum_ids: Vec<String>,
    pub evidence: StructureEvidence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructureSet {
    pub id: String,
    pub dataset_fingerprint: String,
    pub dataset_version: u32,
    pub algorithm_version: String,
    pub structures: Vec<DiscoveredStructure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapperNode {
    pub id: usize,
    pub row_indices: Vec<usize>,
    pub size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistenceInterval {
    pub birth: f64,
    #[serde(default)]
    pub death: Option<f64>,
}

fn canonical_params(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Array(arr) => {
            let inner: Vec<String> = arr.iter().map(canonical_params).collect();
            format!("[{}]", inner.join(","))
        }
        serde_json::Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let inner: Vec<String> = keys
                .iter()
                .map(|k| format!("\"{}\":{}", k, canonical_params(&map[k.as_str()])))
                .collect();
            format!("{{{}}}", inner.join(","))
        }
        other => serde_json::to_string(other).unwrap_or_else(|_| "null".to_string()),
    }
}

fn structure_id(
    fingerprint: &str,
    method: &str,
    parameters: &serde_json::Value,
    row_indices: &[usize],
    rank: usize,
) -> String {
    let row_str: Vec<String> = row_indices.iter().map(|i| i.to_string()).collect();
    format!(
        "{}:structure-{}-{}-{}-{}",
        fingerprint,
        method,
        rank,
        row_str.join(","),
        canonical_params(parameters)
    )
}

pub fn map_mapper_structures(
    nodes: &[MapperNode],
    datum_ids: &[String],
    fingerprint: &str,
    version: u32,
    algorithm_version: &str,
    parameters: &serde_json::Value,
) -> StructureSet {
    let mut sorted_nodes = nodes.to_vec();
    sorted_nodes.sort_by_key(|n| n.id);

    let structures: Vec<DiscoveredStructure> = sorted_nodes
        .iter()
        .enumerate()
        .map(|(rank, node)| {
            let mut row_indices = node.row_indices.clone();
            row_indices.sort();
            let ids: Vec<String> = row_indices
                .iter()
                .filter_map(|&i| datum_ids.get(i).cloned())
                .collect();
            DiscoveredStructure {
                id: structure_id(fingerprint, "mapper", parameters, &row_indices, rank),
                kind: "mapper-node".to_string(),
                row_indices,
                datum_ids: ids,
                evidence: StructureEvidence {
                    method: "mapper".to_string(),
                    parameters: parameters.clone(),
                    rank,
                    score: Some(node.size as f64),
                },
            }
        })
        .collect();

    StructureSet {
        id: format!(
            "{}:structures-mapper-{}",
            fingerprint,
            canonical_params(parameters)
        ),
        dataset_fingerprint: fingerprint.to_string(),
        dataset_version: version,
        algorithm_version: algorithm_version.to_string(),
        structures,
    }
}

pub fn map_persistence_structures(
    intervals: &[PersistenceInterval],
    fingerprint: &str,
    version: u32,
    algorithm_version: &str,
    parameters: &serde_json::Value,
) -> StructureSet {
    let mut indexed: Vec<(usize, &PersistenceInterval)> =
        intervals.iter().enumerate().collect();
    indexed.sort_by(|(ai, a), (bi, b)| {
        a.birth
            .partial_cmp(&b.birth)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(ai.cmp(bi))
    });

    let structures: Vec<DiscoveredStructure> = indexed
        .iter()
        .enumerate()
        .map(|(rank, (_, interval))| {
            let persistence = (interval.death.unwrap_or(interval.birth)) - interval.birth;
            DiscoveredStructure {
                id: structure_id(fingerprint, "persistence", parameters, &[], rank),
                kind: "persistent-component".to_string(),
                row_indices: vec![],
                datum_ids: vec![],
                evidence: StructureEvidence {
                    method: "persistence".to_string(),
                    parameters: parameters.clone(),
                    rank,
                    score: Some(persistence),
                },
            }
        })
        .collect();

    StructureSet {
        id: format!(
            "{}:structures-persistence-{}",
            fingerprint,
            canonical_params(parameters)
        ),
        dataset_fingerprint: fingerprint.to_string(),
        dataset_version: version,
        algorithm_version: algorithm_version.to_string(),
        structures,
    }
}

pub fn map_cluster_structures(
    assignments: &[i32],
    datum_ids: &[String],
    fingerprint: &str,
    version: u32,
    algorithm_version: &str,
    parameters: &serde_json::Value,
) -> StructureSet {
    let mut groups: BTreeMap<i32, Vec<usize>> = BTreeMap::new();
    for (index, &label) in assignments.iter().enumerate() {
        groups.entry(label).or_default().push(index);
    }

    let structures: Vec<DiscoveredStructure> = groups
        .iter()
        .enumerate()
        .map(|(rank, (&label, row_indices))| {
            let ids: Vec<String> = row_indices
                .iter()
                .filter_map(|&i| datum_ids.get(i).cloned())
                .collect();
            let mut params = parameters.clone();
            if let Some(obj) = params.as_object_mut() {
                obj.insert("label".to_string(), serde_json::json!(label));
            }
            DiscoveredStructure {
                id: structure_id(fingerprint, "cluster", &params, row_indices, rank),
                kind: "cluster".to_string(),
                row_indices: row_indices.clone(),
                datum_ids: ids,
                evidence: StructureEvidence {
                    method: "cluster".to_string(),
                    parameters: params,
                    rank,
                    score: Some(row_indices.len() as f64),
                },
            }
        })
        .collect();

    StructureSet {
        id: format!(
            "{}:structures-cluster-{}",
            fingerprint,
            canonical_params(parameters)
        ),
        dataset_fingerprint: fingerprint.to_string(),
        dataset_version: version,
        algorithm_version: algorithm_version.to_string(),
        structures,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mapper_structures_sorted_and_ranked() {
        let nodes = vec![
            MapperNode { id: 2, row_indices: vec![3, 4], size: 2 },
            MapperNode { id: 0, row_indices: vec![0, 1], size: 2 },
        ];
        let datum_ids = vec!["d0".into(), "d1".into(), "d2".into(), "d3".into(), "d4".into()];
        let params = serde_json::json!({"resolution": 10});
        let result = map_mapper_structures(&nodes, &datum_ids, "fp123", 1, "1.0.0", &params);
        assert_eq!(result.structures.len(), 2);
        assert_eq!(result.structures[0].evidence.rank, 0);
        assert_eq!(result.structures[0].row_indices, vec![0, 1]);
        assert_eq!(result.structures[1].evidence.rank, 1);
        assert_eq!(result.structures[1].row_indices, vec![3, 4]);
    }

    #[test]
    fn cluster_structures_group_by_label() {
        let assignments = vec![0, 1, 0, 1, 2];
        let datum_ids: Vec<String> = (0..5).map(|i| format!("d{}", i)).collect();
        let params = serde_json::json!({"k": 3});
        let result = map_cluster_structures(&assignments, &datum_ids, "fp456", 1, "1.0.0", &params);
        assert_eq!(result.structures.len(), 3);
        assert_eq!(result.structures[0].row_indices, vec![0, 2]);
        assert_eq!(result.structures[1].row_indices, vec![1, 3]);
        assert_eq!(result.structures[2].row_indices, vec![4]);
    }

    #[test]
    fn persistence_structures_sorted_by_birth() {
        let intervals = vec![
            PersistenceInterval { birth: 0.5, death: Some(1.2) },
            PersistenceInterval { birth: 0.1, death: Some(0.9) },
        ];
        let params = serde_json::json!({"dim": 1});
        let result = map_persistence_structures(&intervals, "fp789", 1, "1.0.0", &params);
        assert_eq!(result.structures.len(), 2);
        assert_eq!(result.structures[0].evidence.rank, 0);
        assert!((result.structures[0].evidence.score.unwrap() - 0.8).abs() < 1e-10);
    }
}
