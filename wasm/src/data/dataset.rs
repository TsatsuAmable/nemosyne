use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::data::column::{Column, ColumnType};
use crate::data::value::Value;

/// A dataset edge. Mirrors the JS `DatasetEdge` open struct: `source`/`target`
/// row indices, an optional `weight`, and any extra string-keyed attributes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Edge {
    pub source: usize,
    pub target: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

impl Edge {
    pub fn new(source: usize, target: usize) -> Self {
        Self {
            source,
            target,
            weight: None,
            extra: HashMap::new(),
        }
    }
}

/// In-memory dataset: schema, row-major records, graph edges, and a durable
/// observation-identity vector owned by the Rust dataset lineage.
///
/// `row_ids` is metadata, not a scientific variable. The canonical analytical
/// fingerprint deliberately ignores it. IDs exist so row-preserving operations
/// can be correlated across the WASM/JSON boundary without depending on JS
/// object identity or value equality.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Dataset {
    pub name: String,
    pub columns: Vec<Column>,
    pub rows: Vec<HashMap<String, Value>>,
    pub edges: Option<Vec<Edge>>,
    #[serde(default, rename = "rowIds", skip_serializing_if = "Vec::is_empty")]
    pub row_ids: Vec<String>,
}

pub type RowIndex = usize;

impl Dataset {
    pub fn new(name: impl Into<String>, columns: Vec<Column>, rows: Vec<HashMap<String, Value>>) -> Self {
        let mut dataset = Self {
            name: name.into(),
            columns,
            rows,
            edges: None,
            row_ids: Vec::new(),
        };
        dataset.reset_row_ids();
        dataset
    }

    pub fn row_count(&self) -> usize {
        self.rows.len()
    }

    pub fn column_count(&self) -> usize {
        self.columns.len()
    }

    pub fn get_column(&self, name: &str) -> Option<&Column> {
        self.columns.iter().find(|c| c.name == name)
    }

    pub fn get_column_values(&self, name: &str) -> Vec<Option<&Value>> {
        self.rows.iter().map(|r| r.get(name)).collect()
    }

    pub fn numeric_columns(&self) -> Vec<&Column> {
        self.columns.iter().filter(|c| c.ty == ColumnType::Numeric).collect()
    }

    pub fn categorical_columns(&self) -> Vec<&Column> {
        self.columns.iter().filter(|c| c.ty == ColumnType::Categorical).collect()
    }

    pub fn temporal_columns(&self) -> Vec<&Column> {
        self.columns.iter().filter(|c| c.ty == ColumnType::Temporal).collect()
    }

    pub fn has_numeric(&self) -> bool {
        self.columns.iter().any(|c| c.ty == ColumnType::Numeric)
    }

    pub fn has_temporal(&self) -> bool {
        self.columns.iter().any(|c| c.ty == ColumnType::Temporal)
    }

    /// Numeric range of a column. Returns (0, 0) when no valid numbers exist.
    pub fn range_of(&self, name: &str) -> (f64, f64) {
        let values: Vec<f64> = self
            .get_column_values(name)
            .into_iter()
            .flatten()
            .filter_map(|v| v.as_number())
            .collect();
        if values.is_empty() {
            return (0.0, 0.0);
        }
        let min = values.iter().copied().fold(f64::INFINITY, f64::min);
        let max = values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        (min, max)
    }

    pub fn cardinality_of(&self, name: &str) -> usize {
        let mut set = HashSet::new();
        for row in &self.rows {
            if let Some(v) = row.get(name) {
                set.insert(v.to_key_string());
            }
        }
        set.len()
    }

    /// Canonical content fingerprint. Row IDs are intentionally excluded.
    pub fn fingerprint(&self) -> String {
        crate::data::fingerprint::dataset_fingerprint(self)
    }

    pub fn fingerprint_seed(&self) -> u32 {
        crate::data::fingerprint::seed_u32(&self.fingerprint())
    }

    /// Append or replace rows for live streams while keeping the identity vector
    /// aligned. Replacement starts a new lineage; append preserves existing IDs
    /// and allocates IDs only for new observations.
    pub fn update_rows(
        &mut self,
        new_rows: Vec<HashMap<String, Value>>,
        mode: RowUpdateMode,
        limit: Option<usize>,
    ) {
        match mode {
            RowUpdateMode::Append => {
                if !self.has_valid_row_ids() {
                    self.reset_row_ids();
                }
                let old_len = self.rows.len();
                self.rows.extend(new_rows);
                let prefix = self.fingerprint();
                for index in old_len..self.rows.len() {
                    self.row_ids.push(format!("{}:{}", prefix, index));
                }
            }
            RowUpdateMode::Replace => {
                self.rows = new_rows;
                self.reset_row_ids();
            }
        }
        if let Some(limit) = limit {
            if self.rows.len() > limit {
                let start = self.rows.len() - limit;
                self.rows = self.rows.split_off(start);
                self.row_ids = self.row_ids.split_off(start);
            }
        }
    }

    /// Clone with transformed rows. When every output row corresponds to one
    /// source observation on the original scientific columns, preserve the
    /// source IDs in output order. Otherwise the output is a genuinely derived
    /// dataset and receives a fresh deterministic identity lineage.
    pub fn clone_with_rows(
        &self,
        rows: Vec<HashMap<String, Value>>,
        suffix: impl AsRef<str>,
    ) -> Self {
        let mut copy = self.clone();
        copy.rows = rows;
        copy.name = format!("{} {}", self.name, suffix.as_ref());

        let mut used = vec![false; self.rows.len()];
        let mut carried = Vec::with_capacity(copy.rows.len());
        let can_carry = self.has_valid_row_ids()
            && copy.rows.iter().all(|out_row| {
                if let Some(index) = self.find_matching_source_row(out_row, &used) {
                    used[index] = true;
                    carried.push(self.row_ids[index].clone());
                    true
                } else {
                    false
                }
            });

        if can_carry && carried.len() == copy.rows.len() {
            copy.row_ids = carried;
        } else {
            copy.reset_row_ids();
        }
        copy
    }

    fn find_matching_source_row(
        &self,
        candidate: &HashMap<String, Value>,
        used: &[bool],
    ) -> Option<usize> {
        self.rows.iter().enumerate().find_map(|(index, source)| {
            if used[index] {
                return None;
            }
            let same = self.columns.iter().all(|column| {
                source.get(&column.name).unwrap_or(&Value::Null)
                    == candidate.get(&column.name).unwrap_or(&Value::Null)
            });
            same.then_some(index)
        })
    }

    fn has_valid_row_ids(&self) -> bool {
        if self.row_ids.len() != self.rows.len() || self.row_ids.iter().any(|id| id.is_empty()) {
            return false;
        }
        let unique: HashSet<&String> = self.row_ids.iter().collect();
        unique.len() == self.row_ids.len()
    }

    fn reset_row_ids(&mut self) {
        let prefix = self.fingerprint();
        self.row_ids = (0..self.rows.len())
            .map(|index| format!("{}:{}", prefix, index))
            .collect();
    }

    /// Parse a JS-compatible JSON string produced by `to_js_json()` or
    /// `Dataset.toJSON()` back into a Rust `Dataset`.
    pub fn from_js_json(json: &str) -> Result<Self, String> {
        use serde_json::Value as JsonValue;

        let root: JsonValue = serde_json::from_str(json).map_err(|e| e.to_string())?;
        let name = root
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("dataset")
            .to_string();

        let columns: Vec<Column> = root
            .get("columns")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|c| {
                        let name = c.get("name")?.as_str()?;
                        let ty = parse_column_type(c.get("type")?.as_str()?);
                        Some(Column::new(name, ty))
                    })
                    .collect()
            })
            .unwrap_or_default();

        let rows: Vec<HashMap<String, Value>> = root
            .get("rows")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|r| {
                        let obj = r.as_object()?;
                        let mut row = HashMap::new();
                        for col in &columns {
                            let val = obj.get(&col.name).unwrap_or(&JsonValue::Null);
                            row.insert(col.name.clone(), js_value_to_value(val));
                        }
                        Some(row)
                    })
                    .collect()
            })
            .unwrap_or_default();

        let edges = root.get("edges").and_then(|v| v.as_array()).map(|arr| {
            arr.iter()
                .filter_map(|e| {
                    let obj = e.as_object()?;
                    let source = obj
                        .get("source")
                        .and_then(|v| v.as_u64())
                        .or_else(|| obj.get("source").and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok()))?
                        as usize;
                    let target = obj
                        .get("target")
                        .and_then(|v| v.as_u64())
                        .or_else(|| obj.get("target").and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok()))?
                        as usize;
                    let weight = obj.get("weight").and_then(|v| v.as_f64());
                    let mut extra = HashMap::new();
                    for (k, v) in obj {
                        if k == "source" || k == "target" || k == "weight" {
                            continue;
                        }
                        extra.insert(k.clone(), js_value_to_value(v));
                    }
                    Some(Edge { source, target, weight, extra })
                })
                .collect()
        });

        let row_ids: Vec<String> = root
            .get("rowIds")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
            .unwrap_or_default();

        let mut dataset = Self {
            name,
            columns,
            rows,
            edges,
            row_ids,
        };
        if !dataset.has_valid_row_ids() {
            dataset.reset_row_ids();
        }
        Ok(dataset)
    }

    /// Serialize the dataset to a JS-compatible JSON string. Durable row IDs
    /// travel as a sibling metadata vector and never appear inside observations.
    pub fn to_js_json(&self) -> String {
        use serde_json::{Map as JsonMap, Value as JsonValue};
        let mut root = JsonMap::new();
        root.insert("name".to_string(), JsonValue::String(self.name.clone()));

        let columns: Vec<JsonValue> = self
            .columns
            .iter()
            .map(|c| {
                let mut col = JsonMap::new();
                col.insert("name".to_string(), JsonValue::String(c.name.clone()));
                col.insert("type".to_string(), JsonValue::String(c.ty.as_str().to_string()));
                JsonValue::Object(col)
            })
            .collect();
        root.insert("columns".to_string(), JsonValue::Array(columns));

        let rows: Vec<JsonValue> = self
            .rows
            .iter()
            .map(|r| {
                let mut row = JsonMap::new();
                for col in &self.columns {
                    let value = r.get(&col.name).unwrap_or(&Value::Null);
                    row.insert(col.name.clone(), value.to_js_json_value());
                }
                JsonValue::Object(row)
            })
            .collect();
        root.insert("rows".to_string(), JsonValue::Array(rows));
        root.insert(
            "rowIds".to_string(),
            JsonValue::Array(self.row_ids.iter().cloned().map(JsonValue::String).collect()),
        );

        if let Some(edges) = &self.edges {
            let edges_json: Vec<JsonValue> = edges
                .iter()
                .filter_map(|edge| serde_json::to_value(edge).ok())
                .collect();
            root.insert("edges".to_string(), JsonValue::Array(edges_json));
        }

        serde_json::to_string(&JsonValue::Object(root)).unwrap_or_else(|_| "{}".to_string())
    }
}

fn parse_column_type(s: &str) -> ColumnType {
    match s {
        "NUMERIC" => ColumnType::Numeric,
        "CATEGORICAL" => ColumnType::Categorical,
        "TEMPORAL" => ColumnType::Temporal,
        "TEXT" => ColumnType::Text,
        _ => ColumnType::Unknown,
    }
}

fn js_value_to_value(v: &serde_json::Value) -> Value {
    match v {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::Bool(*b),
        serde_json::Value::Number(n) => Value::Number(n.as_f64().unwrap_or(0.0)),
        serde_json::Value::String(s) => Value::Text(s.clone()),
        _ => Value::Text(v.to_string()),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RowUpdateMode {
    Append,
    Replace,
}

#[cfg(test)]
mod row_identity_tests {
    use super::*;

    fn row(value: f64) -> HashMap<String, Value> {
        let mut row = HashMap::new();
        row.insert("value".to_string(), Value::Number(value));
        row
    }

    fn dataset() -> Dataset {
        Dataset::new(
            "ids",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![row(2.0), row(1.0), row(2.0)],
        )
    }

    #[test]
    fn generated_ids_are_unique_even_for_duplicate_observations() {
        let ds = dataset();
        assert_eq!(ds.row_ids.len(), 3);
        assert_ne!(ds.row_ids[0], ds.row_ids[2]);
    }

    #[test]
    fn row_ids_do_not_change_the_analytical_fingerprint() {
        let mut a = dataset();
        let mut b = a.clone();
        b.row_ids = vec!["x".into(), "y".into(), "z".into()];
        assert_eq!(a.fingerprint(), b.fingerprint());
        a.row_ids = vec!["other-a".into(), "other-b".into(), "other-c".into()];
        assert_eq!(a.fingerprint(), b.fingerprint());
    }

    #[test]
    fn row_preserving_transform_carries_ids_in_output_order() {
        let ds = dataset();
        let original = ds.row_ids.clone();
        let sorted = crate::data::operations::sort(&ds, "value", true);
        assert_eq!(sorted.row_ids, vec![original[1].clone(), original[0].clone(), original[2].clone()]);
    }

    #[test]
    fn json_roundtrip_preserves_valid_row_ids() {
        let ds = dataset();
        let json = ds.to_js_json();
        let roundtrip = Dataset::from_js_json(&json).expect("roundtrip");
        assert_eq!(roundtrip.row_ids, ds.row_ids);
    }
}
