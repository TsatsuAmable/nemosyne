//! Explicit compatibility materialisation for columnar-first datasets.
//!
//! Columnar storage remains authoritative. Row-major `Dataset` values are built
//! only when a compatibility consumer explicitly requests them.

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use crate::allocator;
use crate::data::column::{Column, ColumnType};
use crate::data::columnar::ColumnarDataset;
use crate::data::dataset::Dataset;
use crate::data::value::Value;

pub fn materialize_dataset(
    name: &str,
    columns: &[Column],
    columnar: &ColumnarDataset,
) -> Result<Dataset, String> {
    // Validate complete column buffers up front. A short validity buffer is
    // corruption, not scientific missingness, and must never be normalised to
    // null values by the compatibility layer.
    for (column_index, column) in columns.iter().enumerate() {
        match column.ty {
            ColumnType::Numeric | ColumnType::Temporal => {
                let primitive = columnar
                    .primitive_column(column_index)
                    .ok_or_else(|| format!("missing primitive column {column_index}"))?;
                if primitive.values.len() < columnar.row_count() {
                    return Err(format!("primitive column {column_index} values are shorter than row count"));
                }
                if primitive.validity.len() < columnar.row_count() {
                    return Err(format!("primitive column {column_index} validity is shorter than row count"));
                }
            }
            ColumnType::Categorical => {
                let categorical = columnar
                    .categorical_column(column_index)
                    .ok_or_else(|| format!("missing categorical column {column_index}"))?;
                if categorical.codes.len() < columnar.row_count() {
                    return Err(format!("categorical column {column_index} codes are shorter than row count"));
                }
                if categorical.validity.len() < columnar.row_count() {
                    return Err(format!("categorical column {column_index} validity is shorter than row count"));
                }
            }
            other => {
                return Err(format!(
                    "compatibility materialisation does not yet support {other:?}"
                ));
            }
        }
    }

    let mut rows = Vec::with_capacity(columnar.row_count());
    for row_index in 0..columnar.row_count() {
        let mut row = HashMap::with_capacity(columns.len());
        for (column_index, column) in columns.iter().enumerate() {
            let value = match column.ty {
                ColumnType::Numeric | ColumnType::Temporal => {
                    let primitive = columnar
                        .primitive_column(column_index)
                        .ok_or_else(|| format!("missing primitive column {column_index}"))?;
                    if primitive.validity[row_index] == 0 {
                        Value::Null
                    } else {
                        Value::Number(primitive.values[row_index])
                    }
                }
                ColumnType::Categorical => {
                    let categorical = columnar
                        .categorical_column(column_index)
                        .ok_or_else(|| format!("missing categorical column {column_index}"))?;
                    if categorical.validity[row_index] == 0 {
                        Value::Null
                    } else {
                        let code = categorical.codes[row_index] as usize;
                        Value::Text(
                            categorical
                                .dictionary
                                .get(code)
                                .ok_or_else(|| {
                                    format!("categorical column {column_index} contains out-of-range code")
                                })?
                                .clone(),
                        )
                    }
                }
                other => {
                    return Err(format!(
                        "compatibility materialisation does not yet support {other:?}"
                    ));
                }
            };
            row.insert(column.name.clone(), value);
        }
        rows.push(row);
    }

    // Compatibility rows are a view, not a new scientific lineage. Avoid
    // Dataset::new here because it fingerprints the entire reconstructed row
    // store solely to seed row IDs, doubling O(rows × columns) work. Row IDs
    // remain deferred until a genuinely row-identity-dependent operation asks
    // the Dataset to establish them.
    Ok(Dataset {
        name: name.to_string(),
        columns: columns.to_vec(),
        rows,
        edges: None,
        row_ids: Vec::new(),
    })
}

/// Columnar-native metadata access. These calls must never materialise rows.
#[wasm_bindgen]
pub fn canonical_dataset_row_count(handle: u32) -> u32 {
    crate::data::with_columnar_dataset(handle, |dataset| dataset.row_count() as u32).unwrap_or(0)
}

#[wasm_bindgen]
pub fn canonical_dataset_column_count(handle: u32) -> u32 {
    crate::data::with_columnar_metadata(handle, |_name, columns, _dataset| columns.len() as u32).unwrap_or(0)
}

/// Explicit compatibility export. Calling this API is an observable choice to
/// cross from canonical columnar storage into the cached row-major view.
///
/// Uses the standard two-call output-buffer convention: call first with
/// `out_len == 0` to obtain the required byte length, allocate at least that
/// many bytes at `out_ptr`, then call again with the returned size.
#[wasm_bindgen]
pub fn compatibility_dataset_to_json(handle: u32, out_ptr: u32, out_len: u32) -> u32 {
    if let Err(error) = crate::data::materialize_rows(handle) {
        crate::log_error(&format!("compatibility_dataset_to_json failed: {error}"));
        return 0;
    }
    crate::data::with_dataset(handle, |dataset| {
        let json = dataset.to_js_json();
        let bytes = json.as_bytes();
        if out_len == 0 {
            return bytes.len() as u32;
        }
        let write_len = std::cmp::min(bytes.len(), out_len as usize);
        let slice = unsafe { allocator::view_mut(out_ptr, write_len as u32) };
        slice.copy_from_slice(&bytes[..write_len]);
        write_len as u32
    }).unwrap_or(0)
}

/// Diagnostic counter used by host/tests to enforce that columnar-native paths
/// stay row-free. Saturates at u32::MAX for ABI simplicity.
#[wasm_bindgen]
pub fn compatibility_row_materialisation_count() -> u32 {
    crate::data::row_materialisation_count().min(u32::MAX as u64) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::columnar::{CategoricalColumn, PrimitiveColumn};

    #[test]
    fn materialises_typed_scalar_contract_without_changing_values() {
        let columns = vec![
            Column::new("x", ColumnType::Numeric),
            Column::new("cohort", ColumnType::Categorical),
        ];
        let columnar = ColumnarDataset::from_parts(
            2,
            HashMap::from([(
                0,
                PrimitiveColumn {
                    values: vec![1.5, 0.0],
                    validity: vec![1, 0],
                },
            )]),
            HashMap::from([(
                1,
                CategoricalColumn {
                    dictionary: vec!["a".into(), "b".into()],
                    codes: vec![0, 1],
                    validity: vec![1, 1],
                },
            )]),
        )
        .unwrap();
        let dataset = materialize_dataset("compat", &columns, &columnar).unwrap();
        assert_eq!(dataset.rows[0]["x"], Value::Number(1.5));
        assert_eq!(dataset.rows[1]["x"], Value::Null);
        assert_eq!(dataset.rows[1]["cohort"], Value::Text("b".into()));
        assert!(dataset.row_ids.is_empty());
    }

    #[test]
    fn metadata_calls_remain_row_free_and_export_materialises_cached_view() {
        let columns = vec![Column::new("x", ColumnType::Numeric)];
        let columnar = ColumnarDataset::from_parts(
            2,
            HashMap::from([(
                0,
                PrimitiveColumn { values: vec![1.0, 2.0], validity: vec![1, 1] },
            )]),
            HashMap::new(),
        ).unwrap();
        let handle = crate::data::register_columnar_dataset("caller-boundary".into(), columns, columnar);

        assert!(crate::data::with_dataset(handle, |_| ()).is_none());
        assert_eq!(canonical_dataset_row_count(handle), 2);
        assert_eq!(canonical_dataset_column_count(handle), 1);
        assert!(crate::data::with_dataset(handle, |_| ()).is_none());

        assert!(compatibility_dataset_to_json(handle, 0, 0) > 0);
        let first_rows = crate::data::with_dataset(handle, |dataset| dataset.rows.len());
        assert_eq!(first_rows, Some(2));

        assert!(compatibility_dataset_to_json(handle, 0, 0) > 0);
        let second_rows = crate::data::with_dataset(handle, |dataset| dataset.rows.len());
        assert_eq!(second_rows, Some(2));

        crate::data::destroy_dataset(handle);
    }
}
