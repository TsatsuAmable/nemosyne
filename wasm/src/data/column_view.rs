use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use wasm_bindgen::prelude::*;

#[derive(Debug)]
pub struct PrimitiveColumnView {
    pub values: Vec<f64>,
    pub validity: Vec<u8>,
}

static COLUMN_VIEWS: LazyLock<Mutex<HashMap<(u32, u32), PrimitiveColumnView>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Prepare a contiguous f64 + validity buffer for a numeric/epoch-temporal column.
///
/// The transitional columnar dataset is now built once at dataset registration
/// and kept synchronized after mutable operations. This cache owns a stable copy
/// for the current ABI so returned pointers remain valid until the handle is
/// mutated or destroyed; it no longer rescans row HashMaps to construct views.
pub fn prepare(handle: u32, column_index: u32) -> Option<(u32, u32, u32)> {
    let key = (handle, column_index);

    {
        let views = COLUMN_VIEWS.lock().expect("column view registry poisoned");
        if let Some(view) = views.get(&key) {
            return Some((
                view.values.as_ptr() as usize as u32,
                view.validity.as_ptr() as usize as u32,
                view.values.len() as u32,
            ));
        }
    }

    let view = super::with_columnar_dataset(handle, |columnar| {
        let column = columnar.primitive_column(column_index as usize)?;
        Some(PrimitiveColumnView {
            values: column.values.clone(),
            validity: column.validity.clone(),
        })
    })??;

    let mut views = COLUMN_VIEWS.lock().expect("column view registry poisoned");
    let view = views.entry(key).or_insert(view);
    Some((
        view.values.as_ptr() as usize as u32,
        view.validity.as_ptr() as usize as u32,
        view.values.len() as u32,
    ))
}

/// Element count for a primitive column view, or 0 if the handle/index/type is unsupported.
#[wasm_bindgen]
pub fn dataset_primitive_column_len(handle: u32, column_index: u32) -> u32 {
    prepare(handle, column_index).map(|(_, _, len)| len).unwrap_or(0)
}

/// Pointer to the cached f64 values buffer. Valid until the dataset handle is mutated or destroyed.
#[wasm_bindgen]
pub fn dataset_primitive_column_values_ptr(handle: u32, column_index: u32) -> u32 {
    prepare(handle, column_index)
        .map(|(values_ptr, _, _)| values_ptr)
        .unwrap_or(0)
}

/// Pointer to the cached u8 validity buffer (1 = valid, 0 = missing/non-finite).
#[wasm_bindgen]
pub fn dataset_primitive_column_validity_ptr(handle: u32, column_index: u32) -> u32 {
    prepare(handle, column_index)
        .map(|(_, validity_ptr, _)| validity_ptr)
        .unwrap_or(0)
}

/// Release cached column views when the owning dataset is mutated or destroyed.
pub fn release_dataset(handle: u32) {
    let mut views = COLUMN_VIEWS.lock().expect("column view registry poisoned");
    views.retain(|(dataset_handle, _), _| *dataset_handle != handle);
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::{Dataset, RowUpdateMode};
    use crate::data::value::Value;

    #[test]
    fn primitive_view_preserves_missingness_separately_from_values() {
        let columns = vec![Column::new("value", ColumnType::Numeric)];
        let rows = vec![
            HashMap::from([("value".to_string(), Value::Number(1.5))]),
            HashMap::from([("value".to_string(), Value::Null)]),
            HashMap::from([("value".to_string(), Value::Number(3.5))]),
        ];
        let handle = super::super::register_dataset(Dataset::new("view", columns, rows));
        let (values_ptr, validity_ptr, len) = super::prepare(handle, 0).expect("view");

        assert_ne!(values_ptr, 0);
        assert_ne!(validity_ptr, 0);
        assert_eq!(len, 3);
        assert_eq!(super::dataset_primitive_column_len(handle, 0), 3);

        super::super::destroy_dataset(handle);
    }

    #[test]
    fn categorical_columns_are_not_exposed_as_f64_views() {
        let columns = vec![Column::new("category", ColumnType::Categorical)];
        let rows = vec![HashMap::from([(
            "category".to_string(),
            Value::Text("a".to_string()),
        )])];
        let handle = super::super::register_dataset(Dataset::new("view", columns, rows));
        assert!(super::prepare(handle, 0).is_none());
        assert_eq!(super::dataset_primitive_column_len(handle, 0), 0);
        super::super::destroy_dataset(handle);
    }

    #[test]
    fn mutation_invalidates_and_rebuilds_primitive_view_source() {
        let columns = vec![Column::new("value", ColumnType::Numeric)];
        let rows = vec![HashMap::from([("value".to_string(), Value::Number(1.0))])];
        let handle = super::super::register_dataset(Dataset::new("view", columns, rows));
        assert_eq!(super::dataset_primitive_column_len(handle, 0), 1);

        super::super::with_dataset_mut(handle, |dataset| {
            dataset.update_rows(
                vec![HashMap::from([("value".to_string(), Value::Number(2.0))])],
                RowUpdateMode::Append,
                None,
            );
        })
        .expect("dataset mutation");

        assert_eq!(super::dataset_primitive_column_len(handle, 0), 2);
        super::super::destroy_dataset(handle);
    }
}
