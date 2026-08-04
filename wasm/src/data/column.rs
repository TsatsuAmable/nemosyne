use serde::{Deserialize, Serialize};

/// Column type taxonomy used by the Draco engine to choose encodings and
/// operations. Kept in sync with `src/data/Dataset.js` `ColumnType`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ColumnType {
    Numeric,
    Categorical,
    Temporal,
    Text,
    Unknown,
}

impl ColumnType {
    pub fn as_str(self) -> &'static str {
        match self {
            ColumnType::Numeric => "NUMERIC",
            ColumnType::Categorical => "CATEGORICAL",
            ColumnType::Temporal => "TEMPORAL",
            ColumnType::Text => "TEXT",
            ColumnType::Unknown => "UNKNOWN",
        }
    }
}

/// Metadata for a single dataset column.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Column {
    pub name: String,
    pub ty: ColumnType,
}

impl Column {
    pub fn new(name: impl Into<String>, ty: ColumnType) -> Self {
        Self {
            name: name.into(),
            ty,
        }
    }
}
