//! Canonical dataset fingerprint.
//!
//! Replaces the divergent `Dataset::fingerprint` `DefaultHasher` (which hashed
//! only `name + row_count + column_count`) with a content-addressed FNV-1a
//! hash matching the `DatasetSpace` algorithm: a canonical JSON serialisation
//! (object keys sorted by UTF-16 code unit) hashed with the 32-bit FNV-1a
//! prime `16777619` / offset basis `2166136261`, rendered as 8 lowercase hex
//! digits.
//!
//! Byte-for-byte parity with the JS `JSON.stringify(canonicalize(...))` number
//! formatting (ECMAScript `Number::toString` exponent rules) is a Wave 2
//! reconciliation item, landed when `DatasetSpace` delegates its fingerprint to
//! the kernel so there is a single implementation. Within the kernel the
//! fingerprint is canonical and deterministic, which is what Wave 1 needs for
//! provenance `inputFingerprint`/`outputFingerprint` and reproducible RNG
//! seeding.

use std::collections::HashMap;
use std::fmt::Write;

use crate::data::column::Column;
use crate::data::dataset::Dataset;
use crate::data::value::Value;

/// FNV-1a 32-bit over the UTF-16 code units of `text`, matching the JS
/// `DatasetSpace.hash()` primitive (`state ^= charCodeAt; state = imul(state,
/// 16777619); return (state >>> 0).toString(16).padStart(8, '0')`).
pub fn fnv1a_hex(text: &str) -> String {
    let mut state: u32 = 2_166_136_261;
    let mut buf = [0u16; 2];
    for c in text.chars() {
        for unit in c.encode_utf16(&mut buf) {
            state ^= *unit as u32;
            state = state.wrapping_mul(16_777_619);
        }
    }
    format!("{:08x}", state)
}

/// Derive a deterministic non-zero `u32` RNG seed from a fingerprint hex
/// string. Used to pin clustering/anomaly RNG so assignments are reproducible.
pub fn seed_u32(fingerprint: &str) -> u32 {
    let v = u32::from_str_radix(fingerprint, 16).unwrap_or(0);
    // Avoid a zero seed (LCG implementations normalise 0 -> 1, but keep this
    // explicit and stable across consumers).
    if v == 0 {
        0x9e37_79b9
    } else {
        v
    }
}

/// Content fingerprint of a dataset: FNV-1a over its canonical JSON.
pub fn dataset_fingerprint(dataset: &Dataset) -> String {
    let mut buf = String::new();
    write_dataset(&mut buf, dataset);
    fnv1a_hex(&buf)
}

/// Fingerprint of a single row (used for `datumId` derivation). The row is
/// serialised as an object keyed by column name (sorted), matching
/// `DatasetSpace`'s per-row `hash(row)`.
pub fn row_fingerprint(row: &HashMap<String, Value>, columns: &[Column]) -> String {
    let mut buf = String::new();
    write_row(&mut buf, row, columns);
    fnv1a_hex(&buf)
}

// ---------------------------------------------------------------------------
// Canonical JSON writer
// ---------------------------------------------------------------------------

fn write_dataset(buf: &mut String, ds: &Dataset) {
    // Object keys are emitted in UTF-16 code-unit sorted order:
    // columns < edges < name < rows.
    buf.push('{');
    // "columns"
    buf.push_str("\"columns\":[");
    for (i, col) in ds.columns.iter().enumerate() {
        if i > 0 {
            buf.push(',');
        }
        buf.push_str("{\"name\":");
        write_string(buf, &col.name);
        buf.push_str(",\"type\":");
        write_string(buf, col.ty.as_str());
        buf.push('}');
    }
    buf.push(']');
    // "edges" (only if present)
    if let Some(edges) = &ds.edges {
        buf.push_str(",\"edges\":[");
        for (i, edge) in edges.iter().enumerate() {
            if i > 0 {
                buf.push(',');
            }
            write_edge(buf, edge);
        }
        buf.push(']');
    }
    // "name"
    buf.push_str(",\"name\":");
    write_string(buf, &ds.name);
    // "rows"
    buf.push_str(",\"rows\":[");
    for (i, row) in ds.rows.iter().enumerate() {
        if i > 0 {
            buf.push(',');
        }
        write_row(buf, row, &ds.columns);
    }
    buf.push(']');
    buf.push('}');
}

fn write_row(buf: &mut String, row: &HashMap<String, Value>, columns: &[Column]) {
    // Sort column names by UTF-16 code unit (Rust `String` byte order matches
    // UTF-16 code-unit order for BMP keys; supplementary-plane divergence is
    // documented as a Wave 2 reconciliation item).
    let mut names: Vec<&String> = columns.iter().map(|c| &c.name).collect();
    names.sort_by(|a, b| a.cmp(b));
    buf.push('{');
    for (i, name) in names.iter().enumerate() {
        if i > 0 {
            buf.push(',');
        }
        write_string(buf, name);
        buf.push(':');
        let val = row.get(*name).unwrap_or(&Value::Null);
        write_value(buf, val);
    }
    buf.push('}');
}

fn write_edge(buf: &mut String, edge: &crate::data::dataset::Edge) {
    // Collect all keys (source, target, weight?, extras) and sort by UTF-16
    // code unit so the canonical form is stable regardless of insertion order.
    let mut entries: Vec<(String, EdgeVal)> = Vec::new();
    entries.push(("source".to_string(), EdgeVal::UInt(edge.source)));
    entries.push(("target".to_string(), EdgeVal::UInt(edge.target)));
    if let Some(w) = edge.weight {
        entries.push(("weight".to_string(), EdgeVal::Float(w)));
    }
    for (k, v) in &edge.extra {
        entries.push((k.clone(), EdgeVal::Value(v.clone())));
    }
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    buf.push('{');
    for (i, (k, v)) in entries.iter().enumerate() {
        if i > 0 {
            buf.push(',');
        }
        write_string(buf, k);
        buf.push(':');
        match v {
            EdgeVal::UInt(n) => write_uint(buf, *n),
            EdgeVal::Float(f) => write_number(buf, *f),
            EdgeVal::Value(val) => write_value(buf, val),
        }
    }
    buf.push('}');
}

enum EdgeVal {
    UInt(usize),
    Float(f64),
    Value(Value),
}

fn write_value(buf: &mut String, v: &Value) {
    match v {
        Value::Null => buf.push_str("null"),
        Value::Bool(b) => buf.push_str(if *b { "true" } else { "false" }),
        Value::Number(n) => write_number(buf, *n),
        Value::Text(s) => write_string(buf, s),
    }
}

fn write_uint(buf: &mut String, n: usize) {
    let _ = write!(buf, "{}", n);
}

fn write_number(buf: &mut String, n: f64) {
    // Match JS JSON.stringify number rendering for the common range:
    // - NaN / ±Infinity -> "null"
    // - ±0 -> "0"
    // - otherwise Rust's shortest round-trip Display (no trailing ".0" for
    //   integer-valued floats). Exponential-range divergence from ECMAScript
    //   Number::toString is a Wave 2 reconciliation item.
    if !n.is_finite() {
        buf.push_str("null");
        return;
    }
    if n == 0.0 {
        buf.push('0');
        return;
    }
    let _ = write!(buf, "{}", n);
}

fn write_string(buf: &mut String, s: &str) {
    buf.push('"');
    for c in s.chars() {
        match c {
            '"' => buf.push_str("\\\""),
            '\\' => buf.push_str("\\\\"),
            '\n' => buf.push_str("\\n"),
            '\r' => buf.push_str("\\r"),
            '\t' => buf.push_str("\\t"),
            '\u{08}' => buf.push_str("\\b"),
            '\u{0c}' => buf.push_str("\\f"),
            c if (c as u32) < 0x20 => {
                let _ = write!(buf, "\\u{:04x}", c as u32);
            }
            c => buf.push(c),
        }
    }
    buf.push('"');
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::Dataset;

    fn ds() -> Dataset {
        let columns = vec![
            Column::new("name", ColumnType::Categorical),
            Column::new("age", ColumnType::Numeric),
        ];
        let rows = vec![
            {
                let mut r = HashMap::new();
                r.insert("name".to_string(), Value::Text("Alice".to_string()));
                r.insert("age".to_string(), Value::Number(30.0));
                r
            },
            {
                let mut r = HashMap::new();
                r.insert("name".to_string(), Value::Text("Bob".to_string()));
                r.insert("age".to_string(), Value::Number(25.0));
                r
            },
        ];
        Dataset::new("sample", columns, rows)
    }

    #[test]
    fn fnv1a_matches_known_vector() {
        // FNV-1a 32-bit over the UTF-16 code units of "abc". Verified against
        // the JS `DatasetSpace.hash()` reference implementation (both produce
        // `1a47e90b`), so the Rust kernel and the JS substrate agree.
        assert_eq!(fnv1a_hex("abc"), "1a47e90b");
    }

    #[test]
    fn dataset_fingerprint_is_deterministic() {
        let a = dataset_fingerprint(&ds());
        let b = dataset_fingerprint(&ds());
        assert_eq!(a, b);
        assert_eq!(a.len(), 8);
    }

    #[test]
    fn dataset_fingerprint_is_content_addressed() {
        // The old DefaultHasher fingerprint collided on name+shape; the
        // canonical fingerprint must differ when the data differs.
        let mut other = ds();
        other.rows[0].insert("age".to_string(), Value::Number(31.0));
        assert_ne!(dataset_fingerprint(&ds()), dataset_fingerprint(&other));
    }

    #[test]
    fn fingerprint_is_row_key_order_independent() {
        // Row objects are canonicalised with sorted column-name keys, so two
        // rows built with opposite insertion order (and identical content)
        // produce the same fingerprint. (Column-array order is NOT canonicalised
        // — arrays preserve order, matching `DatasetSpace.canonicalize` — so a
        // column-declaration swap is intentionally *not* order-independent.)
        let columns = vec![
            Column::new("name", ColumnType::Categorical),
            Column::new("age", ColumnType::Numeric),
        ];
        let mut r1 = HashMap::new();
        r1.insert("name".to_string(), Value::Text("Alice".to_string()));
        r1.insert("age".to_string(), Value::Number(30.0));
        let mut r2 = HashMap::new();
        r2.insert("age".to_string(), Value::Number(30.0));
        r2.insert("name".to_string(), Value::Text("Alice".to_string()));
        let a = Dataset::new("sample", columns.clone(), vec![r1]);
        let b = Dataset::new("sample", columns, vec![r2]);
        assert_eq!(dataset_fingerprint(&a), dataset_fingerprint(&b));
    }

    #[test]
    fn seed_u32_is_nonzero_and_stable() {
        assert_ne!(seed_u32("00000000"), 0);
        assert_eq!(seed_u32("deadbeef"), seed_u32("deadbeef"));
    }
}