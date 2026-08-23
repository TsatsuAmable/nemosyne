use wasm_bindgen::prelude::*;

/// Allocate JS-visible bytes through Rust's own allocator rather than the
/// legacy independent bump arena in `lib.rs`.
///
/// The legacy arena can overlap allocations performed later by Rust because it
/// tracks only its own bump pointer over the same linear memory. These exports
/// provide a migration path that shares allocation ownership with Vec/String/
/// HashMap and can therefore coexist with analytical heap growth safely.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn host_buffer_alloc(len: u32) -> u32 {
    use std::alloc::{alloc_zeroed, handle_alloc_error, Layout};

    if len == 0 {
        return 0;
    }
    let layout = Layout::from_size_align(len as usize, 8).expect("valid host buffer layout");
    let ptr = unsafe { alloc_zeroed(layout) };
    if ptr.is_null() {
        handle_alloc_error(layout);
    }
    ptr as usize as u32
}

/// Release a buffer allocated by `host_buffer_alloc`.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn host_buffer_dealloc(ptr: u32, len: u32) {
    use std::alloc::{dealloc, Layout};

    if ptr == 0 || len == 0 {
        return;
    }
    let layout = Layout::from_size_align(len as usize, 8).expect("valid host buffer layout");
    unsafe { dealloc(ptr as usize as *mut u8, layout) };
}

/// Borrow the existing contiguous f64 + validity buffers for a
/// numeric/epoch-temporal column.
///
/// The returned addresses point directly into the registered `ColumnarDataset`;
/// no additional stable-view cache or vector clone is created. The pointers are
/// valid until that dataset handle is mutated or destroyed. Both operations take
/// the dataset-registry lock before replacing/dropping the columnar vectors, so
/// `prepare` cannot race with a rebuild while deriving the addresses.
pub fn prepare(handle: u32, column_index: u32) -> Option<(u32, u32, u32)> {
    super::with_columnar_dataset(handle, |columnar| {
        let column = columnar.primitive_column(column_index as usize)?;
        Some((
            column.values.as_ptr() as usize as u32,
            column.validity.as_ptr() as usize as u32,
            column.values.len() as u32,
        ))
    })?
}

/// Element count for a primitive column view, or 0 if the handle/index/type is unsupported.
#[wasm_bindgen]
pub fn dataset_primitive_column_len(handle: u32, column_index: u32) -> u32 {
    prepare(handle, column_index).map(|(_, _, len)| len).unwrap_or(0)
}

/// Pointer to the Rust-owned f64 values buffer. Valid until the dataset handle is mutated or destroyed.
#[wasm_bindgen]
pub fn dataset_primitive_column_values_ptr(handle: u32, column_index: u32) -> u32 {
    prepare(handle, column_index)
        .map(|(values_ptr, _, _)| values_ptr)
        .unwrap_or(0)
}

/// Pointer to the Rust-owned u8 validity buffer (1 = valid, 0 = missing/non-finite).
#[wasm_bindgen]
pub fn dataset_primitive_column_validity_ptr(handle: u32, column_index: u32) -> u32 {
    prepare(handle, column_index)
        .map(|(_, validity_ptr, _)| validity_ptr)
        .unwrap_or(0)
}

/// Compatibility hook retained for mutation/destruction call sites.
///
/// Primitive views are now direct borrows into `ColumnarDataset`, so there is no
/// auxiliary cache to release. Mutation still rebuilds the sidecar before the
/// registry lock is released, which naturally invalidates previously returned
/// addresses at the documented lifetime boundary.
pub fn release_dataset(_handle: u32) {}

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
    fn primitive_view_points_directly_at_registered_columnar_storage() {
        let columns = vec![Column::new("value", ColumnType::Numeric)];
        let rows = vec![
            HashMap::from([("value".to_string(), Value::Number(1.0))]),
            HashMap::from([("value".to_string(), Value::Number(2.0))]),
        ];
        let handle = super::super::register_dataset(Dataset::new("direct-view", columns, rows));
        let prepared = super::prepare(handle, 0).expect("view");
        let source = super::super::with_columnar_dataset(handle, |columnar| {
            let column = columnar.primitive_column(0).expect("numeric column");
            (
                column.values.as_ptr() as usize as u32,
                column.validity.as_ptr() as usize as u32,
                column.values.len() as u32,
            )
        })
        .expect("columnar dataset");

        assert_eq!(prepared, source);
        assert_eq!(super::prepare(handle, 0), Some(source));
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
    fn mutation_rebuilds_direct_primitive_view_source() {
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

        let (_, _, len) = super::prepare(handle, 0).expect("rebuilt view");
        assert_eq!(len, 2);
        let values = super::super::with_columnar_dataset(handle, |columnar| {
            columnar
                .primitive_column(0)
                .expect("numeric column")
                .values
                .clone()
        })
        .expect("columnar dataset");
        assert_eq!(values, vec![1.0, 2.0]);
        super::super::destroy_dataset(handle);
    }
}
