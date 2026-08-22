//! Canonical dataset fingerprint.
//!
//! Dataset identity is content-addressed with SHA-256 over the canonical JSON
//! representation shared with the JavaScript `DatasetSpace` substrate. Object
//! keys are sorted deterministically and number rendering follows ECMAScript
//! `JSON.stringify` rules so Rust and JS hash identical UTF-8 bytes.

use std::collections::HashMap;
use std::fmt::Write;

use sha2::{Digest, Sha256};

use crate::data::column::Column;
use crate::data::dataset::Dataset;
use crate::data::value::Value;

/// SHA-256 over UTF-8 text, rendered as 64 lowercase hex characters.
pub fn sha256_hex(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}

/// Derive a deterministic non-zero `u32` RNG seed from the first 32 digest bits.
/// The full 256-bit fingerprint remains authoritative for identity; truncation is
/// only for algorithms whose RNG API accepts a u32 seed.
pub fn seed_u32(fingerprint: &str) -> u32 {
    let prefix = fingerprint.get(..8).unwrap_or(fingerprint);
    let v = u32::from_str_radix(prefix, 16).unwrap_or(0);
    if v == 0 {
        0x9e37_79b9
    } else {
        v
    }
}

/// Content fingerprint of a dataset: SHA-256 over its canonical JSON.
pub fn dataset_fingerprint(dataset: &Dataset) -> String {
    let mut buf = String::new();
    write_dataset(&mut buf, dataset);
    sha256_hex(&buf)
}

/// Fingerprint of a single row (used for `datumId` derivation).
pub fn row_fingerprint(row: &HashMap<String, Value>, columns: &[Column]) -> String {
    let mut buf = String::new();
    write_row(&mut buf, row, columns);
    sha256_hex(&buf)
}

// ---------------------------------------------------------------------------
// Canonical JSON writer
// ---------------------------------------------------------------------------

fn write_dataset(buf: &mut String, ds: &Dataset) {
    // Object keys are emitted in UTF-16 code-unit sorted order:
    // columns < edges < name < rows.
    buf.push('{');
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
    buf.push_str(",\"name\":");
    write_string(buf, &ds.name);
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
    // Rust String ordering matches UTF-16 code-unit order for BMP keys;
    // supplementary-plane reconciliation remains a separate canonicalization item.
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
    // Match JS `JSON.stringify` / `Number::toString` number rendering exactly.
    if !n.is_finite() {
        buf.push_str("null");
        return;
    }
    if n == 0.0 {
        buf.push('0');
        return;
    }
    let neg = n < 0.0;
    let sci = format!("{:e}", n.abs());
    let (mantissa, exp_str) = sci.split_once('e').unwrap_or((sci.as_str(), "0"));
    let exp: i32 = exp_str.parse().unwrap_or(0);
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let k = exp + 1;

    if neg {
        buf.push('-');
    }

    if k <= -6 || k > 21 {
        buf.push(digits.chars().next().unwrap_or('0'));
        if digits.len() > 1 {
            buf.push('.');
            buf.push_str(&digits[1..]);
        }
        let e = k - 1;
        buf.push('e');
        if e >= 0 {
            buf.push('+');
        }
        let _ = write!(buf, "{}", e);
        return;
    }

    if k <= 0 {
        buf.push_str("0.");
        for _ in 0..(-k) {
            buf.push('0');
        }
        buf.push_str(&digits);
    } else if (k as usize) >= digits.len() {
        buf.push_str(&digits);
        for _ in 0..((k as usize) - digits.len()) {
            buf.push('0');
        }
    } else {
        buf.push_str(&digits[..k as usize]);
        buf.push('.');
        buf.push_str(&digits[k as usize..]);
    }
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
    fn sha256_matches_known_vector() {
        assert_eq!(
            sha256_hex("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn dataset_fingerprint_is_deterministic() {
        let a = dataset_fingerprint(&ds());
        let b = dataset_fingerprint(&ds());
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
    }

    #[test]
    fn dataset_fingerprint_is_content_addressed() {
        let mut other = ds();
        other.rows[0].insert("age".to_string(), Value::Number(31.0));
        assert_ne!(dataset_fingerprint(&ds()), dataset_fingerprint(&other));
    }

    #[test]
    fn fingerprint_is_row_key_order_independent() {
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
        assert_ne!(seed_u32(&"0".repeat(64)), 0);
        let fingerprint = sha256_hex("seed");
        assert_eq!(seed_u32(&fingerprint), seed_u32(&fingerprint));
    }

    #[test]
    fn write_number_matches_ecmascript_stringify() {
        let cases: [(f64, &str); 20] = [
            (100.0, "100"),
            (0.1, "0.1"),
            (1e-7, "1e-7"),
            (1e-6, "0.000001"),
            (9.9e-7, "9.9e-7"),
            (1e21, "1e+21"),
            (1e20, "100000000000000000000"),
            (123.456, "123.456"),
            (1.5, "1.5"),
            (f64::MAX, "1.7976931348623157e+308"),
            (f64::from_bits(1), "5e-324"),
            (30.0, "30"),
            (250.0, "250"),
            (0.5, "0.5"),
            (1e-5, "0.00001"),
            (2.0, "2"),
            (1.23e-5, "0.0000123"),
            (-1.5, "-1.5"),
            (1.234_567_890_123_456_8e29, "1.2345678901234568e+29"),
            (0.0, "0"),
        ];
        for (val, expected) in cases {
            let mut buf = String::new();
            write_number(&mut buf, val);
            assert_eq!(buf, expected, "write_number({val:?})");
        }
    }

    #[test]
    fn write_number_non_finite_and_zero() {
        let mut buf = String::new();
        write_number(&mut buf, f64::NAN);
        assert_eq!(buf, "null");
        buf.clear();
        write_number(&mut buf, f64::INFINITY);
        assert_eq!(buf, "null");
        buf.clear();
        write_number(&mut buf, f64::NEG_INFINITY);
        assert_eq!(buf, "null");
        buf.clear();
        write_number(&mut buf, -0.0);
        assert_eq!(buf, "0");
    }

    #[test]
    fn canonical_dataset_json_preserves_js_number_rules() {
        let columns = vec![
            Column::new("value", ColumnType::Numeric),
            Column::new("note", ColumnType::Categorical),
        ];
        let rows = vec![
            {
                let mut r = HashMap::new();
                r.insert("value".to_string(), Value::Number(0.000001));
                r.insert("note".to_string(), Value::Text("tiny".to_string()));
                r
            },
            {
                let mut r = HashMap::new();
                r.insert("value".to_string(), Value::Number(1e21));
                r.insert("note".to_string(), Value::Text("big".to_string()));
                r
            },
        ];
        let mut buf = String::new();
        write_dataset(&mut buf, &Dataset::new("parity", columns, rows));
        assert!(buf.contains("0.000001"), "unexpected canonical JSON: {buf}");
        assert!(buf.contains("1e+21"), "unexpected canonical JSON: {buf}");
        assert_eq!(sha256_hex(&buf).len(), 64);
    }
}
