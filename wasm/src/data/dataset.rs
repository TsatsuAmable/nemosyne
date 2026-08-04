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
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RowUpdateMode {
    Append,
    Replace,
}
