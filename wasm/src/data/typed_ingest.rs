//! Typed-column bulk ingestion for the canonical dataset registry.
//!
//! The binary payload carries the bulk observations and column schema. Dataset
//! name remains metadata/control-plane input so the bulk format can stay focused
//! on column buffers. Typed datasets enter the same handle registry as legacy
//! JSON datasets but do not materialise row HashMaps.

use std::collections::HashMap;

use wasm_bindgen::prelude::*;

use crate::allocator;
use crate::data::column::{Column, ColumnType};
use crate::data::columnar::{CategoricalColumn, ColumnarDataset, PrimitiveColumn};
use crate::data::{destroy_dataset, register_columnar_dataset, with_columnar_dataset, with_columnar_metadata};

const MAGIC: &[u8; 4] = b"NTC1";
const DEFAULT_DATASET_NAME: &str = "typed-column-dataset";

struct Reader<'a> {
    bytes: &'a [u8],
    offset: usize,
}
impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self { Self { bytes, offset: 0 } }
    fn remaining(&self) -> usize { self.bytes.len().saturating_sub(self.offset) }
    fn take(&mut self, len: usize) -> Result<&'a [u8], String> {
        let end = self.offset.checked_add(len).ok_or("typed payload overflow")?;
        if end > self.bytes.len() { return Err("typed payload truncated".into()); }
        let slice = &self.bytes[self.offset..end];
        self.offset = end;
        Ok(slice)
    }
    fn u8(&mut self) -> Result<u8, String> { Ok(self.take(1)?[0]) }
    fn u16(&mut self) -> Result<u16, String> { Ok(u16::from_le_bytes(self.take(2)?.try_into().unwrap())) }
    fn u32(&mut self) -> Result<u32, String> { Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap())) }
    fn string(&mut self) -> Result<String, String> {
        let len = self.u16()? as usize;
        String::from_utf8(self.take(len)?.to_vec()).map_err(|_| "typed payload contains invalid UTF-8".into())
    }
}

struct ParsedTypedDataset {
    columns: Vec<Column>,
    columnar: ColumnarDataset,
}

fn parse_with_schema(bytes: &[u8]) -> Result<ParsedTypedDataset, String> {
    let mut reader = Reader::new(bytes);
    if reader.take(4)? != MAGIC { return Err("typed payload magic mismatch".into()); }
    let row_count = reader.u32()? as usize;
    let column_count = reader.u32()? as usize;
    let mut primitive_columns = HashMap::new();
    let mut categorical_columns = HashMap::new();
    let mut columns = Vec::with_capacity(column_count);

    for column_index in 0..column_count {
        let kind = reader.u8()?;
        let name = reader.string()?;
        match kind {
            1 | 2 => {
                let ty = if kind == 1 { ColumnType::Numeric } else { ColumnType::Temporal };
                columns.push(Column::new(name, ty));
                let raw = reader.take(row_count.checked_mul(8).ok_or("primitive byte size overflow")?)?;
                let mut values = Vec::with_capacity(row_count);
                for chunk in raw.chunks_exact(8) { values.push(f64::from_le_bytes(chunk.try_into().unwrap())); }
                let validity = reader.take(row_count)?.to_vec();
                primitive_columns.insert(column_index, PrimitiveColumn { values, validity });
            }
            3 => {
                columns.push(Column::new(name, ColumnType::Categorical));
                let dictionary_count = reader.u32()? as usize;
                if dictionary_count > reader.remaining() / 2 {
                    return Err("categorical dictionary count exceeds remaining payload".into());
                }
                let mut dictionary = Vec::with_capacity(dictionary_count);
                for _ in 0..dictionary_count { dictionary.push(reader.string()?); }
                let raw_codes = reader.take(row_count.checked_mul(4).ok_or("categorical byte size overflow")?)?;
                let mut codes = Vec::with_capacity(row_count);
                for chunk in raw_codes.chunks_exact(4) { codes.push(u32::from_le_bytes(chunk.try_into().unwrap())); }
                let validity = reader.take(row_count)?.to_vec();
                categorical_columns.insert(column_index, CategoricalColumn { dictionary, codes, validity });
            }
            _ => return Err(format!("unsupported typed column kind {kind}")),
        }
    }
    if reader.offset != bytes.len() { return Err("typed payload contains trailing bytes".into()); }
    let columnar = ColumnarDataset::from_parts(row_count, primitive_columns, categorical_columns)?;
    Ok(ParsedTypedDataset { columns, columnar })
}

fn parse(bytes: &[u8]) -> Result<ColumnarDataset, String> {
    Ok(parse_with_schema(bytes)?.columnar)
}

fn load_named(bytes: &[u8], name: String) -> Result<u32, String> {
    let parsed = parse_with_schema(bytes)?;
    Ok(register_columnar_dataset(name, parsed.columns, parsed.columnar))
}

#[wasm_bindgen]
pub fn data_load_typed_columns(ptr: u32, len: u32) -> u32 {
    let bytes = unsafe { allocator::view(ptr, len) };
    match load_named(bytes, DEFAULT_DATASET_NAME.to_string()) {
        Ok(handle) => handle,
        Err(error) => {
            crate::log_error(&format!("data_load_typed_columns failed: {error}"));
            0
        }
    }
}

/// Load typed bulk observations into the canonical registry with control-plane
/// dataset metadata supplied separately from the bulk data-plane payload.
#[wasm_bindgen]
pub fn data_load_typed_columns_named(ptr: u32, len: u32, name_ptr: u32, name_len: u32) -> u32 {
    let bytes = unsafe { allocator::view(ptr, len) };
    let name_bytes = unsafe { allocator::view(name_ptr, name_len) };
    let name = match std::str::from_utf8(name_bytes) {
        Ok(value) => value.to_string(),
        Err(_) => {
            crate::log_error("data_load_typed_columns_named failed: dataset name is not valid UTF-8");
            return 0;
        }
    };
    match load_named(bytes, name) {
        Ok(handle) => handle,
        Err(error) => {
            crate::log_error(&format!("data_load_typed_columns_named failed: {error}"));
            0
        }
    }
}

#[wasm_bindgen]
pub fn typed_dataset_destroy(handle: u32) { destroy_dataset(handle); }

#[wasm_bindgen]
pub fn typed_dataset_row_count(handle: u32) -> u32 {
    with_columnar_dataset(handle, |d| d.row_count() as u32).unwrap_or(0)
}

fn primitive_meta(handle: u32, column_index: u32) -> Option<(u32, u32, u32)> {
    with_columnar_dataset(handle, |dataset| {
        let column = dataset.primitive_column(column_index as usize)?;
        Some((column.values.as_ptr() as usize as u32, column.validity.as_ptr() as usize as u32, column.values.len() as u32))
    })?
}

#[wasm_bindgen]
pub fn typed_primitive_column_len(handle: u32, column_index: u32) -> u32 {
    primitive_meta(handle, column_index).map(|m| m.2).unwrap_or(0)
}

#[wasm_bindgen]
pub fn typed_primitive_values_ptr(handle: u32, column_index: u32) -> u32 {
    primitive_meta(handle, column_index).map(|m| m.0).unwrap_or(0)
}

#[wasm_bindgen]
pub fn typed_primitive_validity_ptr(handle: u32, column_index: u32) -> u32 {
    primitive_meta(handle, column_index).map(|m| m.1).unwrap_or(0)
}

/// Canonical SHA-256 identity for a typed/columnar-first handle. Empty string
/// signals an invalid handle or unsupported schema.
#[wasm_bindgen]
pub fn typed_dataset_fingerprint(handle: u32) -> String {
    with_columnar_metadata(handle, |name, columns, columnar| {
        crate::data::columnar_fingerprint::columnar_dataset_fingerprint(name, columns, columnar)
    }).and_then(Result::ok).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::fingerprint::dataset_fingerprint;
    use crate::data::dataset::Dataset;
    use crate::data::value::Value;

    fn push_u16(out: &mut Vec<u8>, value: u16) { out.extend_from_slice(&value.to_le_bytes()); }
    fn push_u32(out: &mut Vec<u8>, value: u32) { out.extend_from_slice(&value.to_le_bytes()); }
    fn push_string(out: &mut Vec<u8>, value: &str) {
        push_u16(out, value.len() as u16);
        out.extend_from_slice(value.as_bytes());
    }

    fn one_categorical_payload(code: u32) -> Vec<u8> {
        let mut bytes = MAGIC.to_vec();
        push_u32(&mut bytes, 1);
        push_u32(&mut bytes, 1);
        bytes.push(3);
        push_string(&mut bytes, "c");
        push_u32(&mut bytes, 1);
        push_string(&mut bytes, "a");
        push_u32(&mut bytes, code);
        bytes.push(1);
        bytes
    }

    #[test]
    fn parses_two_rows_of_primitive_and_categorical_buffers_without_row_objects() {
        let mut bytes = MAGIC.to_vec();
        push_u32(&mut bytes, 2);
        push_u32(&mut bytes, 2);
        bytes.push(1);
        push_string(&mut bytes, "x");
        bytes.extend_from_slice(&1.0f64.to_le_bytes());
        bytes.extend_from_slice(&2.0f64.to_le_bytes());
        bytes.extend_from_slice(&[1, 1]);
        bytes.push(3);
        push_string(&mut bytes, "cohort");
        push_u32(&mut bytes, 2);
        push_string(&mut bytes, "a");
        push_string(&mut bytes, "b");
        push_u32(&mut bytes, 0);
        push_u32(&mut bytes, 1);
        bytes.extend_from_slice(&[1, 1]);

        let parsed = parse_with_schema(&bytes).expect("typed payload");
        assert_eq!(parsed.columnar.row_count(), 2);
        assert_eq!(parsed.columns, vec![Column::new("x", ColumnType::Numeric), Column::new("cohort", ColumnType::Categorical)]);
        assert_eq!(parsed.columnar.primitive_column(0).unwrap().values, vec![1.0, 2.0]);
    }

    #[test]
    fn typed_columnar_identity_matches_equivalent_legacy_dataset() {
        let mut bytes = MAGIC.to_vec();
        push_u32(&mut bytes, 1);
        push_u32(&mut bytes, 2);
        bytes.push(1);
        push_string(&mut bytes, "x");
        bytes.extend_from_slice(&1.5f64.to_le_bytes());
        bytes.push(1);
        bytes.push(3);
        push_string(&mut bytes, "cohort");
        push_u32(&mut bytes, 1);
        push_string(&mut bytes, "a");
        push_u32(&mut bytes, 0);
        bytes.push(1);

        let parsed = parse_with_schema(&bytes).unwrap();
        let expected = Dataset::new(
            "identity-parity",
            parsed.columns.clone(),
            vec![HashMap::from([("x".into(), Value::Number(1.5)), ("cohort".into(), Value::Text("a".into()))])],
        );
        assert_eq!(
            crate::data::columnar_fingerprint::columnar_dataset_fingerprint("identity-parity", &parsed.columns, &parsed.columnar).unwrap(),
            dataset_fingerprint(&expected),
        );
    }

    #[test]
    fn typed_primitive_non_finite_values_are_normalized_to_missing() {
        let mut bytes = MAGIC.to_vec();
        push_u32(&mut bytes, 3);
        push_u32(&mut bytes, 1);
        bytes.push(1);
        push_string(&mut bytes, "x");
        bytes.extend_from_slice(&f64::NAN.to_le_bytes());
        bytes.extend_from_slice(&f64::INFINITY.to_le_bytes());
        bytes.extend_from_slice(&1.0f64.to_le_bytes());
        bytes.extend_from_slice(&[1, 1, 1]);
        let dataset = parse(&bytes).expect("typed payload");
        let column = dataset.primitive_column(0).unwrap();
        assert_eq!(column.values, vec![0.0, 0.0, 1.0]);
        assert_eq!(column.validity, vec![0, 0, 1]);
    }

    #[test]
    fn rejects_impossible_dictionary_preallocation_before_allocating() {
        let mut bytes = MAGIC.to_vec();
        push_u32(&mut bytes, 1);
        push_u32(&mut bytes, 1);
        bytes.push(3);
        push_string(&mut bytes, "c");
        push_u32(&mut bytes, u32::MAX);
        assert!(parse(&bytes).is_err());
    }

    #[test]
    fn accepts_valid_payload_and_rejects_invalid_codes_or_trailing_bytes() {
        let valid = one_categorical_payload(0);
        assert!(parse(&valid).is_ok());
        assert!(parse(&one_categorical_payload(7)).is_err());
        let mut trailing = valid;
        trailing.push(0xff);
        assert!(parse(&trailing).is_err());
    }
}
