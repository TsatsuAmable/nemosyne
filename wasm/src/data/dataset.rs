use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::data::column::{Column, ColumnType};
use crate::data::value::Value;

/// Source/target identity for an explicit dataset edge.
///
/// Numeric endpoints retain the historical positional-row semantics used by
/// Rust transforms. String endpoints are stable source identities and must stay
/// strings across the JS/WASM boundary; coercing `"0"` into row index `0` would
/// change the scientific graph.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(untagged)]
pub enum EdgeEndpoint {
    Index(usize),
    Id(String),
}

impl From<usize> for EdgeEndpoint {
    fn from(value: usize) -> Self {
        Self::Index(value)
    }
}

impl From<String> for EdgeEndpoint {
    fn from(value: String) -> Self {
        Self::Id(value)
    }
}

impl From<&str> for EdgeEndpoint {
    fn from(value: &str) -> Self {
        Self::Id(value.to_string())
    }
}

/// A dataset edge. Mirrors the JS `DatasetEdge` open struct: `source`/`target`
/// are either positional row indices or stable string IDs, with optional
/// `weight` and arbitrary JSON-compatible attributes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Edge {
    pub source: EdgeEndpoint,
    pub target: EdgeEndpoint,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl Edge {
    pub fn new(source: usize, target: usize) -> Self {
        Self {
            source: EdgeEndpoint::Index(source),
            target: EdgeEndpoint::Index(target),
            weight: None,
            extra: HashMap::new(),
        }
    }

    pub fn new_id(source: impl Into<String>, target: impl Into<String>) -> Self {
        Self {
            source: EdgeEndpoint::Id(source.into()),
            target: EdgeEndpoint::Id(target.into()),
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
    pub fn new(
        name: impl Into<String>,
        columns: Vec<Column>,
        rows: Vec<HashMap<String, Value>>,
    ) -> Self {
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

    /// Append or replace rows for live streams while keeping identity and
    /// positional graph endpoints aligned. Replacement starts a new lineage and
    /// clears topology. Append preserves existing edges; when a rolling limit
    /// drops a prefix, surviving positional edges are remapped to retained rows.
    /// Stable string endpoints are preserved only while all source rows remain,
    /// because Rust has no governed source-ID-column mapping for a subset.
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
                self.edges = None;
                self.reset_row_ids();
            }
        }
        if let Some(limit) = limit {
            if self.rows.len() > limit {
                let start = self.rows.len() - limit;
                let retained_source_indices: Vec<usize> = (start..self.rows.len()).collect();
                self.edges = self.remap_edges_for_source_indices(&retained_source_indices);
                self.rows = self.rows.split_off(start);
                self.row_ids = self.row_ids.split_off(start);
            }
        }
    }

    /// Clone with transformed rows. When every output row corresponds to one
    /// source observation on the original scientific columns, preserve source
    /// IDs and remap positional graph endpoints into output order. Edges whose
    /// positional endpoints were removed are dropped. Stable string endpoints
    /// survive pure reorderings, but are dropped when a subset removes source
    /// rows because no governed Rust mapping says which row a source string ID
    /// names. If output rows are genuinely derived, topology is cleared.
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
        let mut source_indices = Vec::with_capacity(copy.rows.len());
        let can_carry = self.has_valid_row_ids()
            && copy.rows.iter().all(|out_row| {
                if let Some(index) = self.find_matching_source_row(out_row, &used) {
                    used[index] = true;
                    carried.push(self.row_ids[index].clone());
                    source_indices.push(index);
                    true
                } else {
                    false
                }
            });

        if can_carry && carried.len() == copy.rows.len() {
            copy.row_ids = carried;
            copy.edges = self.remap_edges_for_source_indices(&source_indices);
        } else {
            copy.edges = None;
            copy.reset_row_ids();
        }
        copy
    }

    fn remap_endpoint(
        endpoint: &EdgeEndpoint,
        old_to_new: &[Option<usize>],
        preserve_stable_ids: bool,
    ) -> Option<EdgeEndpoint> {
        match endpoint {
            EdgeEndpoint::Index(index) => old_to_new
                .get(*index)
                .copied()
                .flatten()
                .map(EdgeEndpoint::Index),
            EdgeEndpoint::Id(id) if preserve_stable_ids => Some(EdgeEndpoint::Id(id.clone())),
            EdgeEndpoint::Id(_) => None,
        }
    }

    fn remap_edges_for_source_indices(&self, source_indices: &[usize]) -> Option<Vec<Edge>> {
        let edges = self.edges.as_ref()?;
        let mut old_to_new = vec![None; self.rows.len()];
        for (new_index, source_index) in source_indices.iter().copied().enumerate() {
            if source_index < old_to_new.len() {
                old_to_new[source_index] = Some(new_index);
            }
        }
        let preserve_stable_ids = source_indices.len() == self.rows.len()
            && old_to_new.iter().all(Option::is_some);

        Some(
            edges
                .iter()
                .filter_map(|edge| {
                    let source = Self::remap_endpoint(
                        &edge.source,
                        &old_to_new,
                        preserve_stable_ids,
                    )?;
                    let target = Self::remap_endpoint(
                        &edge.target,
                        &old_to_new,
                        preserve_stable_ids,
                    )?;
                    let mut remapped = edge.clone();
                    remapped.source = source;
                    remapped.target = target;
                    Some(remapped)
                })
                .collect(),
        )
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

        let edges = match root.get("edges") {
            None => None,
            Some(JsonValue::Array(entries)) => {
                let mut parsed = Vec::with_capacity(entries.len());
                for (index, entry) in entries.iter().enumerate() {
                    let edge: Edge = serde_json::from_value(entry.clone())
                        .map_err(|error| format!("invalid edge at index {index}: {error}"))?;
                    parsed.push(edge);
                }
                Some(parsed)
            }
            Some(_) => return Err("edges must be an array when present".to_string()),
        };

        let row_ids: Vec<String> = root
            .get("rowIds")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect()
            })
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
                col.insert(
                    "type".to_string(),
                    JsonValue::String(c.ty.as_str().to_string()),
                );
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
            JsonValue::Array(
                self.row_ids
                    .iter()
                    .cloned()
                    .map(JsonValue::String)
                    .collect(),
            ),
        );

        if let Some(edges) = &self.edges {
            let edges_json: Vec<JsonValue> = edges
                .iter()
                .map(|edge| serde_json::to_value(edge).expect("edge serialization cannot fail"))
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
    use serde_json::json;

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

    fn graph_dataset() -> Dataset {
        let mut dataset = Dataset::new(
            "graph",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![row(2.0), row(1.0), row(3.0)],
        );
        dataset.edges = Some(vec![Edge::new(0, 1), Edge::new(1, 2)]);
        dataset
    }

    fn string_graph_dataset() -> Dataset {
        let mut dataset = Dataset::new(
            "string-graph",
            vec![
                Column::new("id", ColumnType::Categorical),
                Column::new("value", ColumnType::Numeric),
            ],
            vec![
                HashMap::from([
                    ("id".to_string(), Value::Text("A".to_string())),
                    ("value".to_string(), Value::Number(2.0)),
                ]),
                HashMap::from([
                    ("id".to_string(), Value::Text("B".to_string())),
                    ("value".to_string(), Value::Number(1.0)),
                ]),
            ],
        );
        dataset.edges = Some(vec![Edge::new_id("A", "B")]);
        dataset
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
        assert_eq!(
            sorted.row_ids,
            vec![
                original[1].clone(),
                original[0].clone(),
                original[2].clone()
            ]
        );
    }

    #[test]
    fn sorting_remaps_positional_graph_endpoints() {
        let ds = graph_dataset();
        let sorted = crate::data::operations::sort(&ds, "value", true);
        assert_eq!(
            sorted.edges,
            Some(vec![Edge::new(1, 0), Edge::new(0, 2)])
        );
    }

    #[test]
    fn sorting_preserves_stable_string_graph_endpoints() {
        let ds = string_graph_dataset();
        let sorted = crate::data::operations::sort(&ds, "value", true);
        assert_eq!(sorted.edges, Some(vec![Edge::new_id("A", "B")]));
    }

    #[test]
    fn filtering_drops_removed_graph_endpoints_and_remaps_survivors() {
        let ds = graph_dataset();
        let filtered = crate::data::operations::filter(&ds, |row| {
            row.get("value").and_then(Value::as_number) != Some(2.0)
        });
        assert_eq!(filtered.edges, Some(vec![Edge::new(0, 1)]));
    }

    #[test]
    fn filtering_drops_stable_string_edges_when_source_membership_changes() {
        let ds = string_graph_dataset();
        let filtered = crate::data::operations::filter(&ds, |row| {
            row.get("id") != Some(&Value::Text("A".to_string()))
        });
        assert_eq!(filtered.edges, Some(vec![]));
    }

    #[test]
    fn genuinely_derived_rows_clear_graph_topology() {
        let ds = graph_dataset();
        let derived = ds.clone_with_rows(vec![row(99.0)], "[derived]");
        assert_eq!(derived.edges, None);
    }

    #[test]
    fn replacing_live_rows_clears_graph_topology() {
        let mut ds = graph_dataset();
        ds.update_rows(vec![row(10.0), row(20.0)], RowUpdateMode::Replace, None);
        assert_eq!(ds.edges, None);
    }

    #[test]
    fn rolling_append_remaps_edges_after_prefix_eviction() {
        let mut ds = graph_dataset();
        ds.update_rows(vec![row(4.0)], RowUpdateMode::Append, Some(3));
        assert_eq!(ds.edges, Some(vec![Edge::new(0, 1)]));
    }

    #[test]
    fn rolling_append_drops_stable_string_edges_after_prefix_eviction() {
        let mut ds = string_graph_dataset();
        ds.update_rows(vec![HashMap::from([
            ("id".to_string(), Value::Text("C".to_string())),
            ("value".to_string(), Value::Number(3.0)),
        ])], RowUpdateMode::Append, Some(2));
        assert_eq!(ds.edges, Some(vec![]));
    }

    #[test]
    fn json_roundtrip_preserves_valid_row_ids() {
        let ds = dataset();
        let json = ds.to_js_json();
        let roundtrip = Dataset::from_js_json(&json).expect("roundtrip");
        assert_eq!(roundtrip.row_ids, ds.row_ids);
    }

    #[test]
    fn json_roundtrip_preserves_edge_attributes_without_value_enum_wrappers() {
        let input = json!({
            "name": "graph",
            "columns": [{"name": "value", "type": "NUMERIC"}],
            "rows": [{"value": 1}, {"value": 2}],
            "edges": [{
                "source": 0,
                "target": 1,
                "weight": 0.75,
                "relation": "observed",
                "active": true,
                "metadata": {"source": "sensor-a", "tags": ["a", "b"]}
            }]
        });
        let ds = Dataset::from_js_json(&input.to_string()).expect("parse graph");
        let output: serde_json::Value =
            serde_json::from_str(&ds.to_js_json()).expect("serialize graph");
        assert_eq!(output["edges"][0]["relation"], json!("observed"));
        assert_eq!(output["edges"][0]["active"], json!(true));
        assert_eq!(
            output["edges"][0]["metadata"],
            json!({"source": "sensor-a", "tags": ["a", "b"]})
        );
    }

    #[test]
    fn json_roundtrip_preserves_string_endpoint_types_exactly() {
        let input = json!({
            "name": "graph",
            "columns": [{"name": "id", "type": "CATEGORICAL"}],
            "rows": [{"id": "A"}, {"id": "B"}],
            "edges": [{"source": "A", "target": "B", "weight": 0.75}]
        });
        let ds = Dataset::from_js_json(&input.to_string()).expect("parse graph");
        assert_eq!(ds.edges, Some(vec![{
            let mut edge = Edge::new_id("A", "B");
            edge.weight = Some(0.75);
            edge
        }]));
        let output: serde_json::Value =
            serde_json::from_str(&ds.to_js_json()).expect("serialize graph");
        assert_eq!(output["edges"][0]["source"], json!("A"));
        assert_eq!(output["edges"][0]["target"], json!("B"));
    }

    #[test]
    fn malformed_edge_endpoint_fails_closed_instead_of_disappearing() {
        let input = json!({
            "name": "graph",
            "columns": [{"name": "id", "type": "CATEGORICAL"}],
            "rows": [{"id": "A"}, {"id": "B"}],
            "edges": [{"source": true, "target": "B"}]
        });
        let error = Dataset::from_js_json(&input.to_string()).expect_err("malformed edge must fail");
        assert!(error.contains("invalid edge at index 0"));
    }
}
