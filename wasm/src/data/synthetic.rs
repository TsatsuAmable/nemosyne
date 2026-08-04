use std::collections::HashMap;

use crate::data::column::{Column, ColumnType};
use crate::data::dataset::Dataset;
use crate::data::value::Value;

/// Available built-in sample datasets in Phase 1.
pub fn make_sample(key: &str) -> Option<Dataset> {
    match key {
        "supply-chain" => Some(supply_chain_hierarchy()),
        "fraud-graph" => Some(fraud_graph()),
        "sensor-stream" => Some(sensor_stream()),
        _ => None,
    }
}

fn supply_chain_hierarchy() -> Dataset {
    let columns = vec![
        Column::new("name", ColumnType::Categorical),
        Column::new("level", ColumnType::Numeric),
        Column::new("region", ColumnType::Categorical),
        Column::new("inventory", ColumnType::Numeric),
        Column::new("riskScore", ColumnType::Numeric),
    ];
    let rows = vec![
        ("North America Hub", 0.0, "Americas", 12000.0, 0.2),
        ("EU Hub", 0.0, "Europe", 9800.0, 0.35),
        ("Asia Hub", 0.0, "Asia", 15400.0, 0.15),
        ("NYC Warehouse", 1.0, "Americas", 3400.0, 0.4),
        ("LA Warehouse", 1.0, "Americas", 2800.0, 0.3),
        ("Berlin Warehouse", 1.0, "Europe", 4100.0, 0.25),
        ("Paris Warehouse", 1.0, "Europe", 2900.0, 0.5),
        ("Tokyo Warehouse", 1.0, "Asia", 5200.0, 0.18),
        ("Singapore Warehouse", 1.0, "Asia", 4700.0, 0.22),
        ("Seoul DC", 2.0, "Asia", 1500.0, 0.6),
        ("Miami DC", 2.0, "Americas", 1100.0, 0.45),
        ("Munich DC", 2.0, "Europe", 1300.0, 0.28),
    ]
    .into_iter()
    .map(|(name, level, region, inventory, risk)| {
        let mut row = HashMap::new();
        row.insert("name".to_string(), Value::Text(name.to_string()));
        row.insert("level".to_string(), Value::Number(level));
        row.insert("region".to_string(), Value::Text(region.to_string()));
        row.insert("inventory".to_string(), Value::Number(inventory));
        row.insert("riskScore".to_string(), Value::Number(risk));
        row
    })
    .collect();
    let mut ds = Dataset::new("Global Supply Chain", columns, rows);
    ds.edges = Some(vec![]); // placeholder until parent/child edges are modelled
    ds
}

fn fraud_graph() -> Dataset {
    let columns = vec![
        Column::new("id", ColumnType::Categorical),
        Column::new("amount", ColumnType::Numeric),
        Column::new("isFraud", ColumnType::Categorical),
        Column::new("hour", ColumnType::Numeric),
    ];
    let rows = vec![
        ("A", 120.0, false, 9.0),
        ("B", 8500.0, true, 2.0),
        ("C", 300.0, false, 14.0),
        ("D", 9200.0, true, 3.0),
        ("E", 150.0, false, 11.0),
        ("F", 7800.0, true, 4.0),
        ("G", 200.0, false, 16.0),
        ("H", 11000.0, true, 1.0),
    ]
    .into_iter()
    .map(|(id, amount, is_fraud, hour)| {
        let mut row = HashMap::new();
        row.insert("id".to_string(), Value::Text(id.to_string()));
        row.insert("amount".to_string(), Value::Number(amount));
        row.insert("isFraud".to_string(), Value::Text((if is_fraud { "true" } else { "false" }).to_string()));
        row.insert("hour".to_string(), Value::Number(hour));
        row
    })
    .collect();
    let mut ds = Dataset::new("Transaction Fraud Graph", columns, rows);
    ds.edges = Some(vec![
        (0, 1),
        (1, 3),
        (2, 4),
        (3, 5),
        (4, 6),
        (5, 7),
        (0, 2),
    ]);
    ds
}

fn sensor_stream() -> Dataset {
    let columns = vec![
        Column::new("time", ColumnType::Temporal),
        Column::new("sensorId", ColumnType::Categorical),
        Column::new("temperature", ColumnType::Numeric),
        Column::new("vibration", ColumnType::Numeric),
    ];
    let rows = vec![
        ("2026-07-28T00:00:00", "S1", 22.1, 0.04),
        ("2026-07-28T01:00:00", "S1", 22.4, 0.05),
        ("2026-07-28T02:00:00", "S1", 23.0, 0.08),
        ("2026-07-28T03:00:00", "S1", 24.2, 0.12),
        ("2026-07-28T00:00:00", "S2", 19.5, 0.02),
        ("2026-07-28T01:00:00", "S2", 19.8, 0.03),
        ("2026-07-28T02:00:00", "S2", 20.2, 0.06),
        ("2026-07-28T03:00:00", "S2", 21.0, 0.09),
    ]
    .into_iter()
    .map(|(time, sensor, temp, vib)| {
        let mut row = HashMap::new();
        row.insert("time".to_string(), Value::Text(time.to_string()));
        row.insert("sensorId".to_string(), Value::Text(sensor.to_string()));
        row.insert("temperature".to_string(), Value::Number(temp));
        row.insert("vibration".to_string(), Value::Number(vib));
        row
    })
    .collect();
    Dataset::new("IoT Sensor Stream", columns, rows)
}
