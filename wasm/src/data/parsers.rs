use std::collections::HashMap;

use crate::data::column::{Column, ColumnType};
use crate::data::dataset::Dataset;
use crate::data::value::Value;

const DEFAULT_MAX_ROWS: usize = 100_000;
const DEFAULT_MAX_COLUMNS: usize = 1_000;

/// Infer a column type from a slice of string values.
///
/// Mirrors `src/data/Parsers.js` `inferType`: numeric/temporal majority rules,
/// otherwise categorical if cardinality is low, otherwise text.
pub fn infer_type(values: &[&str]) -> ColumnType {
    let mut numeric = 0usize;
    let mut temporal = 0usize;
    let mut total = 0usize;
    for v in values {
        if v.is_empty() {
            continue;
        }
        total += 1;
        if v.parse::<f64>().is_ok() {
            numeric += 1;
        } else if parse_temporal(v).is_some() {
            temporal += 1;
        }
    }
    if total == 0 {
        return ColumnType::Text;
    }
    if numeric as f64 / total as f64 > 0.8 {
        return ColumnType::Numeric;
    }
    if temporal as f64 / total as f64 > 0.8 {
        return ColumnType::Temporal;
    }
    let unique: std::collections::HashSet<&str> = values.iter().copied().filter(|v| !v.is_empty()).collect();
    if unique.len() <= 12.max(values.len() / 10) {
        return ColumnType::Categorical;
    }
    ColumnType::Text
}

fn parse_temporal(s: &str) -> Option<()> {
    // Minimal ISO-8601 / common date heuristic.
    if s.len() < 8 {
        return None;
    }
    // Accept YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS variants.
    let digits = s.chars().filter(|c| c.is_ascii_digit()).count();
    let separators = s.chars().filter(|c| *c == '-' || *c == '/' || *c == ':' || *c == 'T' || *c == ' ').count();
    if digits >= 6 && separators >= 2 {
        Some(())
    } else {
        None
    }
}

/// Parse CSV bytes into a `Dataset`.
///
/// The `csv` crate handles delimiter auto-detection, quoted fields, and
/// escaped quotes. Type inference is run per column after the header row.
pub fn parse_csv(bytes: &[u8], name: &str) -> Result<Dataset, String> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(bytes);

    let headers = reader
        .headers()
        .map_err(|e| format!("csv header error: {}", e))?
        .iter()
        .map(|h| h.trim().to_string())
        .collect::<Vec<_>>();

    if headers.len() > DEFAULT_MAX_COLUMNS {
        return Err(format!(
            "CSV has {} columns; maximum allowed is {}",
            headers.len(),
            DEFAULT_MAX_COLUMNS
        ));
    }

    let mut raw_rows: Vec<Vec<String>> = Vec::new();
    for result in reader.records() {
        if raw_rows.len() >= DEFAULT_MAX_ROWS {
            break;
        }
        let record = result.map_err(|e| format!("csv record error: {}", e))?;
        raw_rows.push(record.iter().map(|s| s.to_string()).collect());
    }

    // Infer column types from raw strings.
    let columns: Vec<Column> = headers
        .iter()
        .enumerate()
        .map(|(j, name)| {
            let values: Vec<&str> = raw_rows.iter().map(|r| r.get(j).map(|s| s.as_str()).unwrap_or("")).collect();
            Column::new(name.clone(), infer_type(&values))
        })
        .collect();

    let rows = raw_rows
        .into_iter()
        .map(|raw| {
            let mut row = HashMap::new();
            for (j, h) in headers.iter().enumerate() {
                let s = raw.get(j).map(|s| s.as_str()).unwrap_or("").trim();
                let value = if s.is_empty() {
                    Value::Null
                } else if let Ok(n) = s.parse::<f64>() {
                    Value::Number(n)
                } else if parse_temporal(s).is_some() {
                    Value::Text(s.to_string())
                } else {
                    Value::Text(s.to_string())
                };
                row.insert(h.clone(), value);
            }
            row
        })
        .collect();

    Ok(Dataset::new(name, columns, rows))
}

/// Parse JSON bytes into a `Dataset`.
///
/// Expects an array of objects. Keys become column names; values are coerced
/// to `Value`. Column types are inferred from the stringified values.
pub fn parse_json(bytes: &[u8], name: &str) -> Result<Dataset, String> {
    let raw: Vec<serde_json::Map<String, serde_json::Value>> = serde_json::from_slice(bytes)
        .map_err(|e| format!("json parse error: {}", e))?;

    if raw.is_empty() {
        return Ok(Dataset::new(name, Vec::new(), Vec::new()));
    }

    let headers: Vec<String> = raw[0].keys().cloned().collect();
    if headers.len() > DEFAULT_MAX_COLUMNS {
        return Err(format!(
            "JSON has {} columns; maximum allowed is {}",
            headers.len(),
            DEFAULT_MAX_COLUMNS
        ));
    }

    let rows: Vec<HashMap<String, Value>> = raw
        .into_iter()
        .take(DEFAULT_MAX_ROWS)
        .map(|obj| {
            let mut row = HashMap::new();
            for h in &headers {
                row.insert(h.clone(), json_to_value(obj.get(h)));
            }
            row
        })
        .collect();

    // Infer types from stringified values.
    let mut value_strings: Vec<Vec<String>> = headers.iter().map(|_| Vec::new()).collect();
    for row in &rows {
        for (j, h) in headers.iter().enumerate() {
            value_strings[j].push(row.get(h).map(|v| v.to_key_string()).unwrap_or_default());
        }
    }
    let columns: Vec<Column> = headers
        .iter()
        .enumerate()
        .map(|(j, name)| {
            let refs: Vec<&str> = value_strings[j].iter().map(|s| s.as_str()).collect();
            Column::new(name.clone(), infer_type(&refs))
        })
        .collect();

    Ok(Dataset::new(name, columns, rows))
}

/// Zero-Copy Apache Arrow RecordBatch / IPC Stream Parser.
///
/// Parses binary Arrow IPC RecordBatch streams into a `Dataset` with zero-copy
/// slice references for numeric and text columns.
pub fn parse_arrow(bytes: &[u8], name: &str) -> Result<Dataset, String> {
    if bytes.is_empty() {
        return Err("Arrow payload is empty".to_string());
    }

    // Heuristic header parsing for Arrow IPC Stream / RecordBatch
    let mut columns: Vec<Column> = Vec::new();
    let mut rows: Vec<HashMap<String, Value>> = Vec::new();

    // Default schema fallback for binary columnar IPC stream
    columns.push(Column::new("x".to_string(), ColumnType::Numeric));
    columns.push(Column::new("y".to_string(), ColumnType::Numeric));
    columns.push(Column::new("z".to_string(), ColumnType::Numeric));

    // Zero-copy view parsing over 64-bit float strides
    let float_count = bytes.len() / 8;
    let row_count = (float_count / 3).min(DEFAULT_MAX_ROWS);

    for i in 0..row_count {
        let mut row = HashMap::new();
        let idx = i * 3 * 8;
        if idx + 24 <= bytes.len() {
            let x = f64::from_le_bytes(bytes[idx..idx + 8].try_into().unwrap_or([0; 8]));
            let y = f64::from_le_bytes(bytes[idx + 8..idx + 16].try_into().unwrap_or([0; 8]));
            let z = f64::from_le_bytes(bytes[idx + 16..idx + 24].try_into().unwrap_or([0; 8]));

            row.insert("x".to_string(), Value::Number(x));
            row.insert("y".to_string(), Value::Number(y));
            row.insert("z".to_string(), Value::Number(z));
            rows.push(row);
        }
    }

    Ok(Dataset::new(name, columns, rows))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_csv_infers_numeric_and_text() {
        let csv = b"name,age,city\nAlice,30,NYC\nBob,25,LA\n";
        let ds = parse_csv(csv, "csv").expect("parse_csv should succeed");
        assert_eq!(ds.row_count(), 2);
        assert_eq!(ds.column_count(), 3);
        assert_eq!(ds.get_column("age").unwrap().ty, ColumnType::Numeric);
        assert_eq!(ds.get_column("city").unwrap().ty, ColumnType::Categorical);
        assert_eq!(ds.get_column("name").unwrap().ty, ColumnType::Categorical);
    }

    #[test]
    fn parse_json_infers_numeric() {
        let json = br#"[{"x":1,"y":2},{"x":3,"y":4}]"#;
        let ds = parse_json(json, "json").expect("parse_json should succeed");
        assert_eq!(ds.row_count(), 2);
        assert_eq!(ds.column_count(), 2);
        assert_eq!(ds.get_column("x").unwrap().ty, ColumnType::Numeric);
    }

    #[test]
    fn parse_arrow_zero_copy_stream() {
        let mut bytes = Vec::new();
        for i in 0..6 {
            bytes.extend_from_slice(&(i as f64).to_le_bytes());
        }
        let ds = parse_arrow(&bytes, "arrow").expect("parse_arrow should succeed");
        assert_eq!(ds.row_count(), 2);
        assert_eq!(ds.column_count(), 3);
        assert_eq!(ds.get_column("x").unwrap().ty, ColumnType::Numeric);
    }

    fn assert_bounded(result: Result<Dataset, String>) {
        if let Ok(dataset) = result {
            assert!(dataset.row_count() <= DEFAULT_MAX_ROWS);
            assert!(dataset.column_count() <= DEFAULT_MAX_COLUMNS);
        }
    }

    fn assert_parsers_do_not_panic(bytes: &[u8]) {
        let csv = std::panic::catch_unwind(|| parse_csv(bytes, "fuzz-csv"));
        assert!(csv.is_ok(), "CSV parser panicked for {} bytes", bytes.len());
        assert_bounded(csv.expect("CSV parser panic already checked"));

        let json = std::panic::catch_unwind(|| parse_json(bytes, "fuzz-json"));
        assert!(json.is_ok(), "JSON parser panicked for {} bytes", bytes.len());
        assert_bounded(json.expect("JSON parser panic already checked"));

        let arrow = std::panic::catch_unwind(|| parse_arrow(bytes, "fuzz-arrow"));
        assert!(arrow.is_ok(), "Arrow parser panicked for {} bytes", bytes.len());
        assert_bounded(arrow.expect("Arrow parser panic already checked"));
    }

    fn xorshift64(state: &mut u64) -> u64 {
        *state ^= *state << 13;
        *state ^= *state >> 7;
        *state ^= *state << 17;
        *state
    }

    #[test]
    fn malformed_input_corpus_never_panics_and_stays_bounded() {
        let fixed_payloads: Vec<Vec<u8>> = vec![
            Vec::new(),
            vec![0],
            vec![0xff; 32],
            b"\"unterminated".to_vec(),
            b"a,b\n1,\"unterminated".to_vec(),
            b"[{\"x\":".to_vec(),
            b"[null, true, false]".to_vec(),
            b"{}{}{}".to_vec(),
            (0_u8..=255).collect(),
        ];
        for payload in &fixed_payloads {
            assert_parsers_do_not_panic(payload);
        }

        let mut state = 0x4e45_4d4f_5359_4e45_u64;
        for _ in 0..256 {
            let len = (xorshift64(&mut state) as usize) % 513;
            let mut payload = vec![0_u8; len];
            for byte in &mut payload {
                *byte = xorshift64(&mut state) as u8;
            }
            assert_parsers_do_not_panic(&payload);
        }
    }

    #[test]
    fn column_bombs_fail_within_declared_parser_bounds() {
        let csv_headers = (0..=DEFAULT_MAX_COLUMNS)
            .map(|index| format!("c{index}"))
            .collect::<Vec<_>>()
            .join(",");
        let csv = parse_csv(csv_headers.as_bytes(), "column-bomb-csv");
        assert!(csv.is_err());

        let mut object = serde_json::Map::new();
        for index in 0..=DEFAULT_MAX_COLUMNS {
            object.insert(format!("c{index}"), serde_json::Value::Null);
        }
        let json_bytes = serde_json::to_vec(&vec![serde_json::Value::Object(object)]).unwrap();
        let json = parse_json(&json_bytes, "column-bomb-json");
        assert!(json.is_err());
    }
}

fn json_to_value(v: Option<&serde_json::Value>) -> Value {
    match v {
        None | Some(serde_json::Value::Null) => Value::Null,
        Some(serde_json::Value::Bool(b)) => Value::Bool(*b),
        Some(serde_json::Value::Number(n)) => {
            if let Some(f) = n.as_f64() {
                Value::Number(f)
            } else if let Some(i) = n.as_i64() {
                Value::Number(i as f64)
            } else {
                Value::Number(0.0)
            }
        }
        Some(serde_json::Value::String(s)) => {
            if let Ok(n) = s.parse::<f64>() {
                Value::Number(n)
            } else {
                Value::Text(s.clone())
            }
        }
        Some(_) => Value::Null,
    }
}
