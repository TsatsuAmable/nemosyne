use serde::{Deserialize, Serialize};

/// A single cell value in a Nemosyne dataset.
///
/// This is intentionally a simple enum rather than a typed column store.
/// Phase 1 correctness comes first; later phases can move to column-major
/// storage once the JS integration is proven.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Value {
    Null,
    Number(f64),
    Text(String),
    Bool(bool),
}

impl Value {
    /// Interpret as a number, coercing booleans and parsing text.
    pub fn as_number(&self) -> Option<f64> {
        match self {
            Value::Number(n) => Some(*n),
            Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
            Value::Text(s) => s.parse().ok(),
            Value::Null => None,
        }
    }

    /// Render to a string key for sorting/grouping.
    pub fn to_key_string(&self) -> String {
        match self {
            Value::Null => String::new(),
            Value::Number(n) => format!("{}", n),
            Value::Text(s) => s.clone(),
            Value::Bool(b) => (if *b { "true" } else { "false" }).to_string(),
        }
    }

    /// Return a borrowed string when the value is already text.
    pub fn as_text(&self) -> Option<&str> {
        match self {
            Value::Text(s) => Some(s.as_str()),
            _ => None,
        }
    }
}
