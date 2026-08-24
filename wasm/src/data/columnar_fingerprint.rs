//! Canonical SHA-256 identity for columnar-first datasets.
//!
//! This mirrors `fingerprint::dataset_fingerprint` without materialising row
//! HashMaps. It currently supports the typed data-plane scalar contract:
//! numeric, temporal, and string categorical columns.

use std::cmp::Ordering;
use std::fmt::Write as _;

use sha2::{Digest, Sha256};

use crate::data::column::{Column, ColumnType};
use crate::data::columnar::{CategoricalColumn, ColumnarDataset, PrimitiveColumn};

const HASH_CHUNK_TARGET_BYTES: usize = 64 * 1024;

enum FingerprintColumnSource<'a> {
    Primitive(&'a PrimitiveColumn),
    Categorical {
        column: &'a CategoricalColumn,
        encoded_dictionary: Vec<String>,
    },
}

struct FingerprintColumn<'a> {
    encoded_name: String,
    source: FingerprintColumnSource<'a>,
}

fn cmp_utf16(a: &str, b: &str) -> Ordering {
    a.encode_utf16().cmp(b.encode_utf16())
}

fn write_string(out: &mut String, value: &str) {
    out.push('"');
    for c in value.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 => { let _ = write!(out, "\\u{:04x}", c as u32); }
            c => out.push(c),
        }
    }
    out.push('"');
}

fn write_number(out: &mut String, n: f64) {
    if !n.is_finite() { out.push_str("null"); return; }
    if n == 0.0 { out.push('0'); return; }
    if n.fract() == 0.0 && n.abs() < u64::MAX as f64 {
        if n < 0.0 { out.push('-'); }
        let _ = write!(out, "{}", n.abs() as u64);
        return;
    }
    let neg = n < 0.0;
    let sci = format!("{:e}", n.abs());
    let (mantissa, exp_str) = sci.split_once('e').unwrap_or((sci.as_str(), "0"));
    let exp: i32 = exp_str.parse().unwrap_or(0);
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let k = exp + 1;
    if neg { out.push('-'); }
    if k <= -6 || k > 21 {
        out.push(digits.chars().next().unwrap_or('0'));
        if digits.len() > 1 { out.push('.'); out.push_str(&digits[1..]); }
        let e = k - 1;
        out.push('e');
        if e >= 0 { out.push('+'); }
        let _ = write!(out, "{}", e);
        return;
    }
    if k <= 0 {
        out.push_str("0.");
        for _ in 0..(-k) { out.push('0'); }
        out.push_str(&digits);
    } else if (k as usize) >= digits.len() {
        out.push_str(&digits);
        for _ in 0..((k as usize) - digits.len()) { out.push('0'); }
    } else {
        out.push_str(&digits[..k as usize]);
        out.push('.');
        out.push_str(&digits[k as usize..]);
    }
}

fn update(hasher: &mut Sha256, text: &str) { hasher.update(text.as_bytes()); }

/// Hash a columnar dataset using the same canonical JSON identity contract as a
/// legacy row-oriented Dataset, without constructing row objects.
pub fn columnar_dataset_fingerprint(
    name: &str,
    columns: &[Column],
    dataset: &ColumnarDataset,
) -> Result<String, String> {
    let mut hasher = Sha256::new();
    update(&mut hasher, "{\"columns\":[");
    for (index, column) in columns.iter().enumerate() {
        if index > 0 { update(&mut hasher, ","); }
        let mut entry = String::from("{\"name\":");
        write_string(&mut entry, &column.name);
        entry.push_str(",\"type\":");
        write_string(&mut entry, column.ty.as_str());
        entry.push('}');
        update(&mut hasher, &entry);
    }
    update(&mut hasher, "],\"name\":");
    let mut encoded_name = String::new();
    write_string(&mut encoded_name, name);
    update(&mut hasher, &encoded_name);
    update(&mut hasher, ",\"rows\":[");

    let mut order: Vec<usize> = (0..columns.len()).collect();
    order.sort_by(|a, b| cmp_utf16(&columns[*a].name, &columns[*b].name));
    let ordered_columns: Result<Vec<FingerprintColumn<'_>>, String> = order
        .into_iter()
        .map(|column_index| {
            let column = &columns[column_index];
            let mut encoded_name = String::new();
            write_string(&mut encoded_name, &column.name);
            let source = match column.ty {
                ColumnType::Numeric | ColumnType::Temporal => FingerprintColumnSource::Primitive(
                    dataset
                        .primitive_column(column_index)
                        .ok_or_else(|| format!("missing primitive column {column_index}"))?,
                ),
                ColumnType::Categorical => {
                    let column = dataset
                        .categorical_column(column_index)
                        .ok_or_else(|| format!("missing categorical column {column_index}"))?;
                    let encoded_dictionary = column
                        .dictionary
                        .iter()
                        .map(|value| {
                            let mut encoded = String::new();
                            write_string(&mut encoded, value);
                            encoded
                        })
                        .collect();
                    FingerprintColumnSource::Categorical {
                        column,
                        encoded_dictionary,
                    }
                }
                _ => {
                    return Err(format!(
                        "columnar identity does not yet support {:?}",
                        column.ty
                    ));
                }
            };
            Ok(FingerprintColumn {
                encoded_name,
                source,
            })
        })
        .collect();
    let ordered_columns = ordered_columns?;

    let mut row_json = String::with_capacity(HASH_CHUNK_TARGET_BYTES + 256);
    for row in 0..dataset.row_count() {
        if row > 0 { row_json.push(','); }
        row_json.push('{');
        for (position, column) in ordered_columns.iter().enumerate() {
            if position > 0 { row_json.push(','); }
            row_json.push_str(&column.encoded_name);
            row_json.push(':');
            match &column.source {
                FingerprintColumnSource::Primitive(primitive) => {
                    if primitive.validity.get(row).copied().unwrap_or(0) == 0 {
                        row_json.push_str("null");
                    } else {
                        write_number(&mut row_json, primitive.values[row]);
                    }
                }
                FingerprintColumnSource::Categorical {
                    column,
                    encoded_dictionary,
                } => {
                    if column.validity.get(row).copied().unwrap_or(0) == 0 {
                        row_json.push_str("null");
                    } else {
                        let code = column.codes[row] as usize;
                        let value = encoded_dictionary.get(code).ok_or_else(|| {
                            "categorical column contains out-of-range code".to_string()
                        })?;
                        row_json.push_str(value);
                    }
                }
            }
        }
        row_json.push('}');
        if row_json.len() >= HASH_CHUNK_TARGET_BYTES {
            update(&mut hasher, &row_json);
            row_json.clear();
        }
    }
    update(&mut hasher, &row_json);
    update(&mut hasher, "]}");
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::columnar::ColumnarDataset;
    use crate::data::dataset::Dataset;
    use crate::data::fingerprint::dataset_fingerprint;
    use crate::data::value::Value;

    use super::columnar_dataset_fingerprint;

    #[test]
    fn columnar_identity_matches_legacy_dataset_identity() {
        let columns = vec![
            Column::new("x", ColumnType::Numeric),
            Column::new("cohort", ColumnType::Categorical),
            Column::new("t", ColumnType::Temporal),
        ];
        let rows = vec![
            HashMap::from([
                ("x".into(), Value::Number(1.5)),
                ("cohort".into(), Value::Text("a".into())),
                ("t".into(), Value::Number(1_700_000_000_000.0)),
            ]),
            HashMap::from([
                ("x".into(), Value::Null),
                ("cohort".into(), Value::Text("b".into())),
                ("t".into(), Value::Number(1_700_000_001_000.0)),
            ]),
        ];
        let dataset = Dataset::new("identity-parity", columns.clone(), rows);
        let columnar = ColumnarDataset::from_dataset(&dataset);
        assert_eq!(
            columnar_dataset_fingerprint("identity-parity", &columns, &columnar).unwrap(),
            dataset_fingerprint(&dataset),
        );
    }

    #[test]
    fn optimized_streaming_identity_preserves_numeric_and_string_edge_cases() {
        let columns = vec![
            Column::new("\u{10000}", ColumnType::Numeric),
            Column::new("\u{e000}", ColumnType::Categorical),
            Column::new("time", ColumnType::Temporal),
        ];
        let numeric_values = [30.0, 1_700_000_000_000.0, -1_000_000_000_000.0, -0.0, 1e20, 1.23e-5];
        let categories = ["quote\"", "slash\\", "line\nfeed", "\u{10000}", "plain", "tab\t"];
        let rows = numeric_values
            .iter()
            .zip(categories)
            .enumerate()
            .map(|(index, (number, category))| {
                HashMap::from([
                    ("\u{10000}".to_string(), Value::Number(*number)),
                    ("\u{e000}".to_string(), Value::Text(category.to_string())),
                    ("time".to_string(), Value::Number(index as f64 * 1_000.0)),
                ])
            })
            .collect();
        let dataset = Dataset::new("identity-edge-cases", columns.clone(), rows);
        let columnar = ColumnarDataset::from_dataset(&dataset);

        assert_eq!(
            columnar_dataset_fingerprint("identity-edge-cases", &columns, &columnar).unwrap(),
            dataset_fingerprint(&dataset),
        );
    }
}
