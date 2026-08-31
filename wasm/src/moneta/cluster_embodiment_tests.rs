use std::collections::HashMap;

use crate::data;
use crate::data::column::{Column, ColumnType};
use crate::data::dataset::Dataset;
use crate::data::value::Value;

use super::cluster_embodiment::{
    build_cluster_embodiment_v1, ClusterEmbodimentRequestV1, ClusterEmbodimentResultV1,
    ClusterRepresentationPayloadV1,
};
use super::embodiment::{SemanticRefusalCodeV1, SemanticRepresentationIdV1};

fn request(coordinates: &[&str]) -> ClusterEmbodimentRequestV1 {
    ClusterEmbodimentRequestV1 {
        schema_version: 1,
        candidate_id: SemanticRepresentationIdV1::ClusterRegions,
        partition_field: "group".to_string(),
        coordinate_fields: coordinates.iter().map(|field| (*field).to_string()).collect(),
        decision_id: None,
        decision_model_version: Some("bootstrap-fitness-v4".to_string()),
        decision_model_artifact_hash: None,
    }
}

fn dataset(
    name: &str,
    columns: Vec<Column>,
    rows: Vec<HashMap<String, Value>>,
) -> u32 {
    data::register_dataset(Dataset::new(name, columns, rows))
}

#[test]
fn supports_exactly_three_explicit_numeric_coordinates() {
    let handle = dataset(
        "cluster-c2-three-d",
        vec![
            Column::new("group", ColumnType::Categorical),
            Column::new("x", ColumnType::Numeric),
            Column::new("y", ColumnType::Numeric),
            Column::new("z", ColumnType::Numeric),
        ],
        vec![
            HashMap::from([
                ("group".to_string(), Value::Text("A".to_string())),
                ("x".to_string(), Value::Number(0.0)),
                ("y".to_string(), Value::Number(2.0)),
                ("z".to_string(), Value::Number(4.0)),
            ]),
            HashMap::from([
                ("group".to_string(), Value::Text("A".to_string())),
                ("x".to_string(), Value::Number(2.0)),
                ("y".to_string(), Value::Number(4.0)),
                ("z".to_string(), Value::Number(8.0)),
            ]),
        ],
    );
    let envelope = build_cluster_embodiment_v1(handle, &request(&["x", "y", "z"]))
        .expect("C2 cluster envelope");
    let ClusterEmbodimentResultV1::Ready { payload } = envelope.result else {
        panic!("expected READY C2 cluster payload");
    };
    let ClusterRepresentationPayloadV1::ClusterRegions(payload) = payload;
    let axes = &payload.regions[0]
        .spatial_summary
        .as_ref()
        .expect("3D spatial summary")
        .axes;
    assert_eq!(axes.len(), 3);
    assert_eq!(axes[0].centroid, 1.0);
    assert_eq!(axes[1].centroid, 3.0);
    assert_eq!(axes[2].centroid, 6.0);
}

#[test]
fn refuses_numeric_partition_authority_and_non_numeric_coordinates() {
    let numeric_partition = dataset(
        "cluster-c2-numeric-partition",
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
    );
    let result = build_cluster_embodiment_v1(numeric_partition, &request(&["x", "y"]))
        .expect("C2 refusal envelope")
        .result;
    assert!(matches!(
        result,
        ClusterEmbodimentResultV1::Refused { refusal }
            if refusal.code == SemanticRefusalCodeV1::InvalidParameters
    ));

    let categorical_coordinate = dataset(
        "cluster-c2-categorical-coordinate",
        vec![
            Column::new("group", ColumnType::Categorical),
            Column::new("x", ColumnType::Categorical),
            Column::new("y", ColumnType::Numeric),
        ],
        vec![HashMap::from([
            ("group".to_string(), Value::Text("A".to_string())),
            ("x".to_string(), Value::Text("left".to_string())),
            ("y".to_string(), Value::Number(0.0)),
        ])],
    );
    let result = build_cluster_embodiment_v1(categorical_coordinate, &request(&["x", "y"]))
        .expect("C2 refusal envelope")
        .result;
    assert!(matches!(
        result,
        ClusterEmbodimentResultV1::Refused { refusal }
            if refusal.code == SemanticRefusalCodeV1::InvalidParameters
    ));
}

#[test]
fn refuses_invalid_coordinate_declarations_without_substitution() {
    let handle = dataset(
        "cluster-c2-coordinate-contract",
        vec![
            Column::new("group", ColumnType::Categorical),
            Column::new("x", ColumnType::Numeric),
            Column::new("y", ColumnType::Numeric),
            Column::new("z", ColumnType::Numeric),
            Column::new("w", ColumnType::Numeric),
        ],
        vec![HashMap::from([
            ("group".to_string(), Value::Text("A".to_string())),
            ("x".to_string(), Value::Number(0.0)),
            ("y".to_string(), Value::Number(0.0)),
            ("z".to_string(), Value::Number(0.0)),
            ("w".to_string(), Value::Number(0.0)),
        ])],
    );

    for coordinates in [
        vec!["x"],
        vec!["x", "x"],
        vec!["group", "y"],
        vec!["x", "y", "z", "w"],
    ] {
        let result = build_cluster_embodiment_v1(handle, &request(&coordinates))
            .expect("C2 refusal envelope")
            .result;
        assert!(matches!(
            result,
            ClusterEmbodimentResultV1::Refused { refusal }
                if refusal.code == SemanticRefusalCodeV1::InvalidParameters
        ));
    }
}

#[test]
fn preserves_non_empty_source_labels_exactly_including_whitespace() {
    let handle = dataset(
        "cluster-c2-source-label-identity",
        vec![
            Column::new("group", ColumnType::Categorical),
            Column::new("x", ColumnType::Numeric),
            Column::new("y", ColumnType::Numeric),
        ],
        vec![HashMap::from([
            ("group".to_string(), Value::Text(" A ".to_string())),
            ("x".to_string(), Value::Number(1.0)),
            ("y".to_string(), Value::Number(2.0)),
        ])],
    );
    let envelope = build_cluster_embodiment_v1(handle, &request(&["x", "y"]))
        .expect("C2 cluster envelope");
    let ClusterEmbodimentResultV1::Ready { payload } = envelope.result else {
        panic!("expected READY C2 cluster payload");
    };
    let ClusterRepresentationPayloadV1::ClusterRegions(payload) = payload;
    assert_eq!(payload.regions[0].source_partition_value, " A ");
}
