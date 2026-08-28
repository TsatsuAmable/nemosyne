use std::collections::HashMap;

use proptest::prelude::*;
use serde_json::json;

use crate::data::column::{Column, ColumnType};
use crate::data::dataset::{Dataset, Edge};
use crate::data::fingerprint::dataset_fingerprint;
use crate::data::value::Value;

fn scalar_value() -> impl Strategy<Value = Value> {
    prop_oneof![
        Just(Value::Null),
        any::<bool>().prop_map(Value::Bool),
        (-1_000_000i32..=1_000_000i32).prop_map(|value| Value::Number(value as f64)),
        "[A-Za-z0-9 _-]{0,20}".prop_map(Value::Text),
    ]
}

fn two_row_dataset(name: &str) -> Dataset {
    let columns = vec![Column::new("x", ColumnType::Numeric)];
    let rows = vec![
        HashMap::from([("x".to_string(), Value::Number(1.0))]),
        HashMap::from([("x".to_string(), Value::Number(2.0))]),
    ];
    Dataset::new(name, columns, rows)
}

proptest! {
    #[test]
    fn q2_proptest_row_map_insertion_order_cannot_change_identity(
        left in scalar_value(),
        right in scalar_value(),
    ) {
        let columns = vec![
            Column::new("left", ColumnType::Unknown),
            Column::new("right", ColumnType::Unknown),
        ];
        let mut row_a = HashMap::new();
        row_a.insert("left".to_string(), left.clone());
        row_a.insert("right".to_string(), right.clone());
        let mut row_b = HashMap::new();
        row_b.insert("right".to_string(), right);
        row_b.insert("left".to_string(), left);

        let a = Dataset::new("map-order", columns.clone(), vec![row_a]);
        let b = Dataset::new("map-order", columns, vec![row_b]);
        prop_assert_eq!(dataset_fingerprint(&a), dataset_fingerprint(&b));
    }

    #[test]
    fn q2_proptest_undeclared_row_values_cannot_change_identity(
        declared in scalar_value(),
        extra in scalar_value(),
        suffix in "[A-Za-z0-9]{1,12}",
    ) {
        let columns = vec![Column::new("declared", ColumnType::Unknown)];
        let base_row = HashMap::from([("declared".to_string(), declared.clone())]);
        let mut decorated_row = base_row.clone();
        decorated_row.insert(format!("presentation_{suffix}"), extra);

        let base = Dataset::new("undeclared", columns.clone(), vec![base_row]);
        let decorated = Dataset::new("undeclared", columns, vec![decorated_row]);
        prop_assert_eq!(dataset_fingerprint(&base), dataset_fingerprint(&decorated));
    }

    #[test]
    fn q2_proptest_missing_declared_value_and_null_share_identity(
        x in scalar_value(),
    ) {
        let columns = vec![
            Column::new("x", ColumnType::Unknown),
            Column::new("y", ColumnType::Unknown),
        ];
        let missing = Dataset::new(
            "missing-null",
            columns.clone(),
            vec![HashMap::from([("x".to_string(), x.clone())])],
        );
        let explicit_null = Dataset::new(
            "missing-null",
            columns,
            vec![HashMap::from([
                ("x".to_string(), x),
                ("y".to_string(), Value::Null),
            ])],
        );
        prop_assert_eq!(dataset_fingerprint(&missing), dataset_fingerprint(&explicit_null));
    }

    #[test]
    fn q2_proptest_row_ids_are_non_scientific_metadata(
        replacement_id in "[A-Za-z0-9_-]{0,24}",
    ) {
        let mut a = two_row_dataset("row-ids");
        let mut b = a.clone();
        a.row_ids = vec!["left-a".to_string(), "left-b".to_string()];
        b.row_ids = vec![replacement_id.clone(), format!("{replacement_id}-other")];
        prop_assert_eq!(dataset_fingerprint(&a), dataset_fingerprint(&b));
    }

    #[test]
    fn q2_proptest_edge_extra_map_order_cannot_change_identity(
        first in -10_000i32..=10_000i32,
        second in any::<bool>(),
    ) {
        let mut a = two_row_dataset("edge-extra-order");
        let mut edge_a = Edge::new(0, 1);
        edge_a.extra.insert("meta_alpha".to_string(), json!(first));
        edge_a.extra.insert("meta_beta".to_string(), json!(second));
        a.edges = Some(vec![edge_a]);

        let mut b = two_row_dataset("edge-extra-order");
        let mut edge_b = Edge::new(0, 1);
        edge_b.extra.insert("meta_beta".to_string(), json!(second));
        edge_b.extra.insert("meta_alpha".to_string(), json!(first));
        b.edges = Some(vec![edge_b]);

        prop_assert_eq!(dataset_fingerprint(&a), dataset_fingerprint(&b));
    }

    #[test]
    fn q2_proptest_numeric_and_string_endpoints_remain_distinct(
        source in 0usize..=1usize,
        target in 0usize..=1usize,
    ) {
        let mut numeric = two_row_dataset("endpoint-type");
        numeric.edges = Some(vec![Edge::new(source, target)]);

        let mut string = two_row_dataset("endpoint-type");
        string.edges = Some(vec![Edge::new_id(source.to_string(), target.to_string())]);

        prop_assert_ne!(dataset_fingerprint(&numeric), dataset_fingerprint(&string));
    }

    #[test]
    fn q2_proptest_supplementary_plane_row_keys_are_order_stable(
        bmp_value in scalar_value(),
        supplementary_value in scalar_value(),
    ) {
        let bmp = "\u{e000}";
        let supplementary = "\u{10000}";
        let columns = vec![
            Column::new(bmp, ColumnType::Unknown),
            Column::new(supplementary, ColumnType::Unknown),
        ];
        let mut row_a = HashMap::new();
        row_a.insert(bmp.to_string(), bmp_value.clone());
        row_a.insert(supplementary.to_string(), supplementary_value.clone());
        let mut row_b = HashMap::new();
        row_b.insert(supplementary.to_string(), supplementary_value);
        row_b.insert(bmp.to_string(), bmp_value);

        let a = Dataset::new("utf16-order", columns.clone(), vec![row_a]);
        let b = Dataset::new("utf16-order", columns, vec![row_b]);
        prop_assert_eq!(dataset_fingerprint(&a), dataset_fingerprint(&b));
    }

    /// Deliberately false and ignored in ordinary pilot execution. The hosted
    /// pilot invokes it separately and requires proptest to shrink to x = 10.
    #[test]
    #[ignore]
    fn q2_proptest_shrink_probe(x in 10u16..=10_000u16) {
        prop_assert!(x < 10);
    }
}
