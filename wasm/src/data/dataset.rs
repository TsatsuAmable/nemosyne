use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::data::column::{Column, ColumnType};
use crate::data::value::Value;

/// In-memory dataset: a schema plus row-major records.
///
/// Mirrors the JS `Dataset` class but stores values in a compact enum form.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Dataset {
    pub name: String,
    pub columns: Vec<Column>,
    pub rows: Vec<HashMap<String, Value>>,
    pub edges: Option<Vec<(RowIndex, RowIndex)>>,
}

pub type RowIndex = usize;

impl Dataset {
    pub fn new(name: impl Into<String>, columns: Vec<Column>, rows: Vec<HashMap<String, Value>>) -> Self {
        Self {
            name: name.into(),
            columns,
            rows,
            edges: None,
        }
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
        self.columns
            .iter()
            .filter(|c| c.ty == ColumnType::Numeric)
            .collect()
    }

    pub fn categorical_columns(&self) -> Vec<&Column> {
        self.columns
            .iter()
            .filter(|c| c.ty == ColumnType::Categorical)
            .collect()
    }

    pub fn temporal_columns(&self) -> Vec<&Column> {
        self.columns
            .iter()
            .filter(|c| c.ty == ColumnType::Temporal)
            .collect()
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
        let min = values
            .iter()
            .copied()
            .fold(f64::INFINITY, f64::min);
        let max = values
            .iter()
            .copied()
            .fold(f64::NEG_INFINITY, f64::max);
        (min, max)
    }

    pub fn cardinality_of(&self, name: &str) -> usize {
        let mut set = std::collections::HashSet::new();
        for row in &self.rows {
            if let Some(v) = row.get(name) {
                set.insert(v.to_key_string());
            }
        }
        set.len()
    }

    /// Stable hash for deterministic procedural generation.
    pub fn fingerprint(&self) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        self.name.hash(&mut hasher);
        self.row_count().hash(&mut hasher);
        self.column_count().hash(&mut hasher);
        hasher.finish()
    }

    /// Append or replace rows for live streams.
    pub fn update_rows(
        &mut self,
        new_rows: Vec<HashMap<String, Value>>,
        mode: RowUpdateMode,
        limit: Option<usize>,
    ) {
        match mode {
            RowUpdateMode::Append => self.rows.extend(new_rows),
            RowUpdateMode::Replace => self.rows = new_rows,
        }
        if let Some(limit) = limit {
            if self.rows.len() > limit {
                let start = self.rows.len() - limit;
                self.rows = self.rows.split_off(start);
            }
        }
    }

    pub fn clone_with_rows(
        &self,
        rows: Vec<HashMap<String, Value>>,
        suffix: impl AsRef<str>,
    ) -> Self {
        let mut copy = self.clone();
        copy.rows = rows;
        copy.name = format!("{} {}", self.name, suffix.as_ref());
        copy
    }

    /// Parse a JS-compatible JSON string produced by `to_js_json()` (or the JS
    /// `Dataset.toJSON()` method) back into a Rust `Dataset`.
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
                arr
                    .iter()
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
            arr
                .iter()
                .filter_map(|e| {
                    let obj = e.as_object()?;
                    let source = obj.get("source")?.as_u64()? as usize;
                    let target = obj.get("target")?.as_u64()? as usize;
                    Some((source, target))
                })
                .collect()
        });

        Ok(Self {
            name,
            columns,
            rows,
            edges,
        })
    }

    /// Serialize the dataset to a JS-compatible JSON string.
    ///
    /// The format matches `src/data/Dataset.js` `toJSON()` / `fromJSON()` so
    /// the JS host can reconstruct a full `Dataset` object from a Rust handle.
    pub fn to_js_json(&self) -> String {
        use serde_json::{Map as JsonMap, Number, Value as JsonValue};
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

        if let Some(edges) = &self.edges {
            let edges_json: Vec<JsonValue> = edges
                .iter()
                .map(|(a, b)| {
                    let mut e = JsonMap::new();
                    e.insert("source".to_string(), JsonValue::Number(Number::from(*a as u64)));
                    e.insert("target".to_string(), JsonValue::Number(Number::from(*b as u64)));
                    JsonValue::Object(e)
                })
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
        serde_json::Value::Number(n) => {
            Value::Number(n.as_f64().unwrap_or(0.0))
        }
        serde_json::Value::String(s) => Value::Text(s.clone()),
        _ => Value::Text(v.to_string()),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RowUpdateMode {
    Append,
    Replace,
}
